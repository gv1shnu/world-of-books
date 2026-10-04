/**
 * =============================================================================
 * Scraper Service
 * =============================================================================
 *
 * Core web scraping logic for extracting book data from World of Books.
 * Uses plain HTTP: server-rendered HTML for menus and product pages, and the
 * site's public Algolia search index for category and search listings.
 *
 * Scrapers:
 *   1. Navigation Scraper - Fetches the main menu structure
 *   2. Category Scraper - Extracts product listings from category pages
 *   3. Product Detail Scraper - Gets full details for individual products
 *   4. Search Scraper - Searches for books by keyword
 *
 * Features:
 *   - Pagination: Automatically scrapes all pages
 *   - Retry logic: Handles transient failures with exponential backoff
 *   - Job tracking: Every scrape is logged to the ScrapeJob table
 *
 * Configuration is centralized in scraper.config.ts
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SCRAPER_CONFIG, sleep, withRetry } from './scraper.config';
import {
  AlgoliaSettings,
  WOB_BASE_URL,
  decodeHtml,
  fetchHtml,
  parseAlgoliaSettings,
  parseCollectionId,
  parseProductDetailHtml,
  queryAlgolia,
} from './wob-http';

/** Extracts menu categories from World of Books homepage HTML. */
export function parseNavigationHtml(html: string): ScrapedNavigation[] {
  const grouped = new Map<string, ScrapedCategory[]>();
  const seen = new Set<string>();

  for (const [tag] of html.matchAll(/<a\b[^>]*data-menu_subcategory[^>]*>/g)) {
    const attr = (name: string) => {
      const match = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
      return match ? decodeHtml(match[1]).trim() : '';
    };
    const title = attr('data-menu_subcategory');
    const parent = attr('data-menu_category');
    const href = attr('href');
    if (!title || !parent || !href.includes('/collections/')) continue;

    const slug = href.split('?')[0].split('/').pop() || '';
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);

    if (!grouped.has(parent)) grouped.set(parent, []);
    grouped.get(parent)!.push({
      title,
      slug,
      url: href.startsWith('http') ? href : `https://www.worldofbooks.com${href}`,
    });
  }

  return [...grouped].map(([title, categories]) => ({
    title,
    slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    categories,
  }));
}

// -----------------------------------------------------------------------------
// Data Types - What we extract from the website
// -----------------------------------------------------------------------------

/** A category link from the navigation menu */
export interface ScrapedCategory {
  title: string;
  slug: string;
  url: string;
}

/** A navigation section containing categories */
export interface ScrapedNavigation {
  title: string;
  slug: string;
  categories: ScrapedCategory[];
}

/** A book/product from a category listing */
export interface ScrapedProduct {
  source_id: string; // World of Books product ID
  title: string;
  author?: string;
  price: number; // Current price in GBP
  original_price?: number; // Original price if discounted
  image_url?: string;
  source_url: string; // Link to product page
  isbn?: string;
  condition?: string; // e.g., "Very Good", "Good"
  publisher?: string;
}

/** A customer review */
export interface ScrapedReview {
  author: string;
  rating: number;
  text: string;
  date?: string;
}

/** Full product details from the product detail page */
export interface ScrapedProductDetail {
  description: string;
  specs: Record<string, string>; // ISBN, pages, etc.
  image_url?: string;
  reviews: ScrapedReview[];
  recommendations: ScrapedProduct[];
}

/** Result wrapper with pagination info and error tracking */
export interface ScrapeResult<T> {
  data: T;
  pagesScraped: number;
  totalItems: number;
  errors: string[];
}

// Prisma enums for job tracking
import { ScrapeTargetType, ScrapeJobStatus } from '@prisma/client';

const PRODUCTS_PER_PAGE = 40; // Same page size as the WoB site

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  constructor(private prisma: PrismaService) { }

  private async trackJob<T>(
    type: ScrapeTargetType,
    url: string,
    action: () => Promise<T>,
  ): Promise<T> {
    const start = Date.now();
    const job = await this.prisma.scrapeJob.create({
      data: {
        target_url: url,
        target_type: type,
        status: ScrapeJobStatus.PENDING,
      },
    });

    try {
      const result = await action();
      const count = Array.isArray(result) ? result.length : 1;

      await this.prisma.scrapeJob.update({
        where: { id: job.id },
        data: {
          status: ScrapeJobStatus.COMPLETED,
          finished_at: new Date(),
          duration_ms: Date.now() - start,
          items_found: count,
        },
      });

      return result;
    } catch (error) {
      await this.prisma.scrapeJob.update({
        where: { id: job.id },
        data: {
          status: ScrapeJobStatus.FAILED,
          finished_at: new Date(),
          duration_ms: Date.now() - start,
          error_log: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }

  // 1. NAVIGATION SCRAPER
  // The menu is server-rendered, so a plain HTTP fetch is enough: no browser,
  // which keeps memory low on small hosts.
  async scrapeNavigation(): Promise<ScrapedNavigation[]> {
    const NAV_URL = 'https://www.worldofbooks.com/en-gb';

    this.logger.log(`Starting navigation scrape...`);
    const startTime = Date.now();

    return this.trackJob(ScrapeTargetType.NAVIGATION, NAV_URL, async () => {
      const html = await withRetry(() => fetchHtml(NAV_URL));

      const navigations = parseNavigationHtml(html);
      if (navigations.length === 0) {
        throw new Error('Navigation scrape found no menu links');
      }

      this.logger.log(
        `Navigation scrape completed (${Date.now() - startTime}ms)`,
      );
      return navigations;
    });
  }

  // Algolia settings read from a WoB page, reused until a query fails.
  private algoliaSettings: AlgoliaSettings | null = null;

  private async getAlgoliaSettings(html?: string): Promise<AlgoliaSettings> {
    const fromPage = html ? parseAlgoliaSettings(html) : null;
    if (fromPage) this.algoliaSettings = fromPage;
    if (!this.algoliaSettings) {
      const homepage = await withRetry(() => fetchHtml(`${WOB_BASE_URL}/en-gb`));
      this.algoliaSettings = parseAlgoliaSettings(homepage);
    }
    if (!this.algoliaSettings) {
      throw new Error('Could not find Algolia settings on World of Books');
    }
    return this.algoliaSettings;
  }

  /**
   * Resolves a collection or search URL to an Algolia query.
   * Collection pages are server-rendered with their Shopify collection id;
   * search URLs carry the query in ?q=.
   */
  private async resolveListing(
    url: string,
  ): Promise<{ settings: AlgoliaSettings; filters?: string; query?: string }> {
    const parsed = new URL(url);
    const query = parsed.searchParams.get('q');
    if (parsed.pathname.endsWith('/search') && query) {
      return { settings: await this.getAlgoliaSettings(), query };
    }

    parsed.searchParams.delete('page');
    const html = await withRetry(() => fetchHtml(parsed.toString()));
    const collectionId = parseCollectionId(html);
    if (!collectionId) {
      throw new Error(`No collection id found on ${parsed.toString()}`);
    }
    return {
      settings: await this.getAlgoliaSettings(html),
      filters: `collection_ids:${collectionId}`,
    };
  }

  private async fetchListingPage(
    listing: { settings: AlgoliaSettings; filters?: string; query?: string },
    page: number,
  ) {
    return withRetry(() =>
      queryAlgolia(listing.settings, {
        filters: listing.filters,
        query: listing.query,
        page: page - 1, // Algolia pages are 0-based
        hitsPerPage: PRODUCTS_PER_PAGE,
      }),
    );
  }

  // 2. CATEGORY SCRAPER - Single Page (for backward compatibility)
  async scrapeCategory(
    url: string,
    pageNumber: number = 1,
  ): Promise<ScrapedProduct[]> {
    const targetUrl = pageNumber > 1 ? `${url}?page=${pageNumber}` : url;

    return this.trackJob(ScrapeTargetType.CATEGORY, targetUrl, async () => {
      const listing = await this.resolveListing(url);
      const result = await this.fetchListingPage(listing, pageNumber);
      return result.products;
    });
  }

  // 2b. CATEGORY SCRAPER - ALL PAGES
  async scrapeCategoryAllPages(
    baseUrl: string,
    onBatch?: (
      products: ScrapedProduct[],
      progress: { current: number; total: number },
    ) => Promise<void>,
    customMaxPages?: number, // Optional override for max pages
  ): Promise<ScrapeResult<ScrapedProduct[]>> {
    this.logger.log(`Starting full category scrape: ${baseUrl}`);
    const startTime = Date.now();

    const allProducts: ScrapedProduct[] = [];
    const errors: string[] = [];
    let pagesScraped = 0;

    return this.trackJob(ScrapeTargetType.CATEGORY, baseUrl, async () => {
      const listing = await this.resolveListing(baseUrl);
      const first = await this.fetchListingPage(listing, 1);
      const totalPages = Math.max(1, first.nbPages);

      // Apply max pages limit - use custom override if provided, else fallback to config
      const maxPages = customMaxPages ?? SCRAPER_CONFIG.maxPagesPerCategory;
      const pagesToScrape =
        maxPages > 0 ? Math.min(totalPages, maxPages) : totalPages;

      this.logger.log(
        `Found ${first.nbHits} products in ${totalPages} pages; scraping ${pagesToScrape}`,
      );

      for (let page = 1; page <= pagesToScrape; page++) {
        try {
          const pageProducts =
            page === 1
              ? first.products
              : (await this.fetchListingPage(listing, page)).products;

          allProducts.push(...pageProducts);
          pagesScraped++;
          this.logger.log(
            `Page ${page}/${pagesToScrape}: ${pageProducts.length} products (total: ${allProducts.length})`,
          );

          if (onBatch) {
            try {
              await onBatch(pageProducts, { current: page, total: pagesToScrape });
            } catch (batchErr) {
              this.logger.error(`Batch save failed for page ${page}: ${batchErr}`);
            }
          }

          // Rate limiting: delay between pages
          if (page < pagesToScrape) {
            const { min, max } = SCRAPER_CONFIG.requestDelayMs;
            await sleep(min, max);
          }
        } catch (error) {
          const msg = `Page ${page} failed after ${SCRAPER_CONFIG.maxRetries} retries: ${error instanceof Error ? error.message : String(error)}`;
          this.logger.error(msg);
          errors.push(msg);
          // Continue to next page - don't abort entire scrape
        }
      }

      this.logger.log(
        `Category scrape complete: ${allProducts.length} products from ${pagesScraped} pages in ${Date.now() - startTime}ms`,
      );
      if (errors.length > 0) {
        this.logger.warn(`Completed with ${errors.length} page errors`);
      }

      return {
        data: allProducts,
        pagesScraped,
        totalItems: allProducts.length,
        errors,
      };
    });
  }

  // 3. PRODUCT DETAIL SCRAPER
  async scrapeProductDetail(url: string): Promise<ScrapedProductDetail> {
    return this.trackJob(ScrapeTargetType.PRODUCT, url, async () => {
      const html = await withRetry(() => fetchHtml(url));
      const detail = parseProductDetailHtml(html);
      return {
        ...detail,
        reviews: [],
        recommendations: [],
      };
    });
  }

  // 4. SEARCH
  async searchProducts(query: string): Promise<ScrapedProduct[]> {
    const encodedQuery = encodeURIComponent(query);
    const searchUrl = `${WOB_BASE_URL}/en-gb/search?q=${encodedQuery}`;
    return this.scrapeCategory(searchUrl);
  }

  // 5. SEARCH - ALL PAGES
  async searchProductsAllPages(
    query: string,
  ): Promise<ScrapeResult<ScrapedProduct[]>> {
    const encodedQuery = encodeURIComponent(query);
    const searchUrl = `${WOB_BASE_URL}/en-gb/search?q=${encodedQuery}`;
    return this.scrapeCategoryAllPages(searchUrl);
  }
}
