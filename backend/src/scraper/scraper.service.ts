/**
 * =============================================================================
 * Scraper Service
 * =============================================================================
 *
 * Core web scraping logic for extracting book data from World of Books.
 * Uses Playwright (via Crawlee) for headless browser automation.
 *
 * Scrapers:
 *   1. Navigation Scraper - Fetches the main menu structure
 *   2. Category Scraper - Extracts product listings from category pages
 *   3. Product Detail Scraper - Gets full details for individual products
 *   4. Search Scraper - Searches for books by keyword
 *
 * Features:
 *   - Turbo mode: Blocks images/fonts to speed up scraping
 *   - Pagination: Automatically scrapes all pages
 *   - Retry logic: Handles transient failures with exponential backoff
 *   - Job tracking: Every scrape is logged to the ScrapeJob table
 *
 * Configuration is centralized in scraper.config.ts
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlaywrightCrawler } from 'crawlee';
import { SCRAPER_CONFIG, SELECTORS, sleep, withRetry } from './scraper.config';

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

  private async enableTurboMode(page: any) {
    await page.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (['image', 'media', 'font'].includes(type)) {
        return route.abort();
      }
      return route.continue();
    });
  }

  /**
   * Try multiple selectors in order until one returns results
   */
  private async trySelectorsOnPage(
    page: any,
    selectors: string[],
  ): Promise<any[]> {
    for (const selector of selectors) {
      try {
        const elements = await page.$$(selector);
        if (elements && elements.length > 0) {
          this.logger.debug(
            `Selector matched: ${selector} (${elements.length} elements)`,
          );
          return elements;
        }
      } catch (e) {
        continue;
      }
    }
    return [];
  }

  /**
   * Detect total page count from pagination
   */
  private async detectTotalPages(page: any): Promise<number> {
    const PRODUCTS_PER_PAGE = 40; // WoB loads 40 products per page

    try {
      // Method 1: Try to find total product count from text like "1315292 products"
      const productCountText = await page.evaluate(() => {
        // Look for text containing "X products" pattern
        const bodyText = document.body.innerText;
        const match = bodyText.match(/(\d[\d,]*)\s*products?/i);
        if (match) {
          return match[1].replace(/,/g, ''); // Remove commas from number
        }

        // Also try "You have seen X products out of Y"
        const progressMatch = bodyText.match(/out of (\d[\d,]*)/i);
        if (progressMatch) {
          return progressMatch[1].replace(/,/g, '');
        }

        return null;
      });

      if (productCountText) {
        const totalProducts = parseInt(productCountText, 10);
        if (totalProducts > 0) {
          const totalPages = Math.ceil(totalProducts / PRODUCTS_PER_PAGE);
          this.logger.log(`\x1b[34mDetected ${totalProducts} total products = ${totalPages} pages\x1b[0m`);
          return totalPages;
        }
      }

      // Method 2: Try to find pagination links with page= parameter
      const pageLinks = await page.$$eval(
        'nav a[href*="page="], .pagination a[href*="page="]',
        (links: Element[]) => {
          return links
            .map((a) => {
              const href = a.getAttribute('href') || '';
              const match = href.match(/page=(\d+)/);
              return match ? parseInt(match[1], 10) : 0;
            })
            .filter((n) => n > 0);
        },
      );

      if (pageLinks.length > 0) {
        return Math.max(...pageLinks);
      }

      // Method 3: Look for page numbers in pagination elements
      const pageNumbers = await page.$$eval(
        '.pagination__item, .page-number',
        (items: Element[]) => {
          return items
            .map((el) => parseInt(el.textContent?.trim() || '0', 10))
            .filter((n) => !isNaN(n) && n > 0);
        },
      );

      if (pageNumbers.length > 0) {
        return Math.max(...pageNumbers);
      }

      return 1; // Default to single page
    } catch (e) {
      this.logger.warn('Could not detect pagination, assuming single page');
      return 1;
    }
  }

  // 1. NAVIGATION SCRAPER
  async scrapeNavigation(): Promise<ScrapedNavigation[]> {
    const NAV_URL = 'https://www.worldofbooks.com/en-gb';

    this.logger.log(`Starting navigation scrape...`);
    const startTime = Date.now();

    return this.trackJob(ScrapeTargetType.NAVIGATION, NAV_URL, async () => {
      const grouped = new Map<string, ScrapedCategory[]>();

      const crawler = new PlaywrightCrawler({
        headless: SCRAPER_CONFIG.headless,
        requestHandlerTimeoutSecs: SCRAPER_CONFIG.navigationTimeoutSecs,
        requestHandler: async ({ page }) => {
          await this.enableTurboMode(page);
          await page.setViewportSize(SCRAPER_CONFIG.viewport);
          await page.setExtraHTTPHeaders({
            'User-Agent': SCRAPER_CONFIG.userAgent,
          });

          try {
            await page.waitForSelector('.menu-drawer__menu, nav', {
              timeout: 8000,
            });
          } catch (e) {
            this.logger.warn('Menu selector timeout - attempting scan anyway');
          }

          const navItems = await page.$$eval(
            'a[data-menu_subcategory]',
            (elements) => {
              return elements.map((el) => ({
                title: el.getAttribute('data-menu_subcategory'),
                parent: el.getAttribute('data-menu_category'),
                href: el.getAttribute('href'),
              }));
            },
          );

          const uniqueSlugs = new Set();
          navItems.forEach((item) => {
            if (
              item.title &&
              item.parent &&
              item.href &&
              item.href.includes('/collections/')
            ) {
              const rawSlug = item.href.split('/').pop() || '';
              const fullSlug = rawSlug;

              if (fullSlug && !uniqueSlugs.has(fullSlug)) {
                uniqueSlugs.add(fullSlug);
                if (!grouped.has(item.parent)) grouped.set(item.parent, []);

                grouped.get(item.parent)?.push({
                  title: item.title,
                  slug: fullSlug,
                  url: item.href.startsWith('http')
                    ? item.href
                    : `https://www.worldofbooks.com${item.href}`,
                });
              }
            }
          });
        },
      });

      await crawler.run([NAV_URL]);

      const navigations: ScrapedNavigation[] = [];
      for (const [parentTitle, categories] of grouped) {
        navigations.push({
          title: parentTitle,
          slug: parentTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          categories: categories,
        });
      }

      this.logger.log(
        `Navigation scrape completed (${Date.now() - startTime}ms)`,
      );
      return navigations;
    });
  }

  // 2. CATEGORY SCRAPER - Single Page (for backward compatibility)
  async scrapeCategory(
    url: string,
    pageNumber: number = 1,
  ): Promise<ScrapedProduct[]> {
    const targetUrl = pageNumber > 1 ? `${url}?page=${pageNumber}` : url;

    return this.trackJob(ScrapeTargetType.CATEGORY, targetUrl, async () => {
      const products: ScrapedProduct[] = [];

      const crawler = new PlaywrightCrawler({
        maxConcurrency: SCRAPER_CONFIG.maxConcurrency,
        maxRequestsPerCrawl: 3,
        requestHandlerTimeoutSecs: SCRAPER_CONFIG.requestTimeoutSecs,

        requestHandler: async ({ page }) => {
          await this.enableTurboMode(page);
          await page.setViewportSize(SCRAPER_CONFIG.viewport);
          await page.setExtraHTTPHeaders({
            'User-Agent': SCRAPER_CONFIG.userAgent,
          });

          // Wait for network to be idle (products are loaded via AJAX)
          try {
            await page.waitForLoadState('networkidle', { timeout: 15000 });
          } catch (e) {
            this.logger.debug('[DEBUG] Network idle timeout - continuing anyway');
          }

          // Try to wait for any of the possible card selectors
          let cardSelector = '';
          for (const selector of SELECTORS.productCard) {
            try {
              await page.waitForSelector(selector, { timeout: 8000 });
              cardSelector = selector;
              this.logger.log(`[DEBUG] Selector matched: "${selector}"`);
              break;
            } catch (e) {
              this.logger.debug(`[DEBUG] Selector "${selector}" did not match`);
            }
          }

          if (!cardSelector) {
            // Dump page info for debugging
            const bodyText = await page.textContent('body');
            const firstChars = bodyText?.substring(0, 500) || 'No body content';
            this.logger.warn(
              `No product cards found on ${targetUrl} (tried: ${SELECTORS.productCard.join(', ')})`,
            );
            this.logger.debug(`[DEBUG] Page body preview: ${firstChars}`);
            return;
          }

          const pageProducts = await page.$$eval(
            cardSelector,
            (items, selectors) => {
              return items.map((item) => {
                // Helper to find text content using multiple selectors within the item
                const findText = (selectorList: string[]) => {
                  for (const selector of selectorList) {
                    const el = item.querySelector(selector);
                    if (el && el.textContent) return el.textContent.trim();
                  }
                  return '';
                };

                // Helper to find attribute using multiple selectors
                const findAttr = (selectorList: string[], attr: string) => {
                  for (const selector of selectorList) {
                    const el = item.querySelector(selector);
                    if (el && el.getAttribute(attr))
                      return el.getAttribute(attr);
                  }
                  return '';
                };

                const title = findText(selectors.productTitle);
                const author = findText(selectors.productAuthor);
                const priceText = findText(selectors.productPrice);
                const imageUrl =
                  findAttr(selectors.productImage, 'src') ||
                  findAttr(selectors.productImage, 'data-src');
                const productUrl = findAttr(selectors.productTitle, 'href'); // Usually title link has the URL

                // Fallback ID from URL if not found in attribute
                // URL format: /products/book-title-book-author-9781234567890 OR /collections/category/products/slug
                let sourceId = '';
                if (productUrl) {
                  const parts = productUrl.split('/');
                  const lastPart = parts[parts.length - 1];
                  // Often the ID is the last part of snake-case slug, or we use the slug itself as ID if unique
                  sourceId = lastPart;
                }

                const rawPrice = priceText.replace(/[^\d.]/g, '') || '0';

                return {
                  source_id: sourceId,
                  title: title || 'Unknown Title',
                  author: author.replace('Author:', '').trim() || undefined,
                  price: parseFloat(rawPrice),
                  image_url: imageUrl || '',
                  source_url: productUrl,
                };
              });
            },
            SELECTORS,
          );

          const validProducts = pageProducts
            .filter((p) => p.title && p.source_url)
            .map(
              (p) =>
                ({
                  ...p,
                  source_url:
                    p.source_url && p.source_url.startsWith('http')
                      ? p.source_url
                      : `https://www.worldofbooks.com${p.source_url || ''}`,
                }) as ScrapedProduct,
            );

          products.push(...validProducts);
        },
      });

      await crawler.run([targetUrl]);
      return products;
    });
  }

  // 2b. CATEGORY SCRAPER - ALL PAGES (new method)
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
    let totalPages = 1;
    let pagesScraped = 0;

    return this.trackJob(ScrapeTargetType.CATEGORY, baseUrl, async () => {
      // First, detect how many pages exist
      const crawler = new PlaywrightCrawler({
        headless: SCRAPER_CONFIG.headless,
        requestHandlerTimeoutSecs: SCRAPER_CONFIG.requestTimeoutSecs,
        requestHandler: async ({ page }) => {
          await this.enableTurboMode(page);
          await page.setViewportSize(SCRAPER_CONFIG.viewport);
          await page.setExtraHTTPHeaders({
            'User-Agent': SCRAPER_CONFIG.userAgent,
          });

          // Wait for network to be idle (products are loaded via AJAX)
          try {
            await page.waitForLoadState('networkidle', { timeout: 15000 });
          } catch (e) {
            this.logger.debug('[DEBUG] Network idle timeout - continuing anyway');
          }

          // Try each selector until one works
          let foundSelector = '';
          for (const selector of SELECTORS.productCard) {
            try {
              await page.waitForSelector(selector, { timeout: 8000 });
              foundSelector = selector;
              this.logger.log(
                `[DEBUG] Page detection matched selector: "${selector}"`,
              );
              break;
            } catch (e) {
              this.logger.debug(
                `[DEBUG] Page detection: "${selector}" did not match`,
              );
            }
          }

          if (!foundSelector) {
            const bodyText = await page.textContent('body');
            const preview = bodyText?.substring(0, 500) || 'No body content';
            this.logger.warn(
              `[scrapeCategoryAllPages] No products found on ${baseUrl}`,
            );
            this.logger.debug(`[DEBUG] Page body preview: ${preview}`);
            return;
          }

          totalPages = await this.detectTotalPages(page);
          this.logger.log(`\x1b[34mDetected ${totalPages} pages for category\x1b[0m`);
        },
      });

      await crawler.run([baseUrl]);

      // Apply max pages limit - use custom override if provided, else fallback to config
      const maxPages = customMaxPages ?? SCRAPER_CONFIG.maxPagesPerCategory;
      const pagesToScrape =
        maxPages > 0 ? Math.min(totalPages, maxPages) : totalPages;

      this.logger.log(
        `\x1b[34mWill scrape ${pagesToScrape} pages (max: ${maxPages || 'unlimited'})\x1b[0m`,
      );

      // Scrape each page with retry logic
      for (let page = 1; page <= pagesToScrape; page++) {
        try {
          const pageProducts = await withRetry(async () => {
            const url = page === 1 ? baseUrl : `${baseUrl}?page=${page}`;

            // Use internal scrape without job tracking (parent job tracks overall)
            const products: ScrapedProduct[] = [];

            const pageCrawler = new PlaywrightCrawler({
              headless: SCRAPER_CONFIG.headless,
              maxConcurrency: 1,
              requestHandlerTimeoutSecs: SCRAPER_CONFIG.requestTimeoutSecs,
              requestHandler: async ({ page: browserPage }) => {
                await this.enableTurboMode(browserPage);
                await browserPage.setViewportSize(SCRAPER_CONFIG.viewport);
                await browserPage.setExtraHTTPHeaders({
                  'User-Agent': SCRAPER_CONFIG.userAgent,
                });

                // Wait for network to be idle (products are loaded via AJAX)
                try {
                  await browserPage.waitForLoadState('networkidle', { timeout: 15000 });
                } catch (e) {
                  this.logger.debug('[DEBUG] Inner page network idle timeout - continuing anyway');
                }

                // Try to wait for any of the possible card selectors
                let cardSelector = '';
                for (const selector of SELECTORS.productCard) {
                  try {
                    await browserPage.waitForSelector(selector, {
                      timeout: 8000,
                    });
                    cardSelector = selector;
                    this.logger.log(
                      `[DEBUG] Inner page matched selector: "${selector}"`,
                    );
                    break;
                  } catch (e) {
                    this.logger.debug(
                      `[DEBUG] Inner page: "${selector}" did not match`,
                    );
                  }
                }

                if (!cardSelector) {
                  const bodyText = await browserPage.textContent('body');
                  const preview = bodyText?.substring(0, 500) || 'No body';
                  this.logger.warn(
                    `[DEBUG] Inner page: No cards found. Body preview: ${preview}`,
                  );
                  return; // Empty page
                }

                const pageProducts = await browserPage.$$eval(
                  cardSelector,
                  (items, selectors) => {
                    return items.map((item) => {
                      // Helper to find text content using multiple selectors within the item
                      const findText = (selectorList: string[]) => {
                        for (const selector of selectorList) {
                          const el = item.querySelector(selector);
                          if (el && el.textContent)
                            return el.textContent.trim();
                        }
                        return '';
                      };

                      // Helper to find attribute using multiple selectors
                      const findAttr = (
                        selectorList: string[],
                        attr: string,
                      ) => {
                        for (const selector of selectorList) {
                          const el = item.querySelector(selector);
                          if (el && el.getAttribute(attr))
                            return el.getAttribute(attr);
                        }
                        return '';
                      };

                      const title = findText(selectors.productTitle);
                      const author = findText(selectors.productAuthor);
                      const priceText = findText(selectors.productPrice);
                      const imageUrl =
                        findAttr(selectors.productImage, 'src') ||
                        findAttr(selectors.productImage, 'data-src');
                      const productUrl = findAttr(
                        selectors.productTitle,
                        'href',
                      );

                      let sourceId = '';
                      if (productUrl) {
                        const parts = productUrl.split('/');
                        const lastPart = parts[parts.length - 1];
                        sourceId = lastPart;
                      }

                      const rawPrice = priceText.replace(/[^\d.]/g, '') || '0';

                      return {
                        source_id: sourceId,
                        title: title || 'Unknown Title',
                        author:
                          author.replace('Author:', '').trim() || undefined,
                        price: parseFloat(rawPrice),
                        image_url: imageUrl || '',
                        source_url: productUrl,
                      };
                    });
                  },
                  SELECTORS,
                );

                const validProducts = pageProducts
                  .filter((p) => p.title && p.source_url)
                  .map(
                    (p) =>
                      ({
                        ...p,
                        source_url:
                          p.source_url && p.source_url.startsWith('http')
                            ? p.source_url
                            : `https://www.worldofbooks.com${p.source_url || ''}`,
                      }) as ScrapedProduct,
                  );

                products.push(...validProducts);
              },
            });

            await pageCrawler.run([
              {
                url: url,
                uniqueKey: `${url}-${Date.now()}`,
              },
            ]);
            return products;
          });

          allProducts.push(...pageProducts);
          pagesScraped++;
          this.logger.log(
            `\x1b[34mPage ${page}/${pagesToScrape}: ${pageProducts.length} products (total: ${allProducts.length})\x1b[0m`,
          );

          // Incremental update callback
          if (onBatch) {
            try {
              await onBatch(pageProducts, {
                current: page,
                total: pagesToScrape,
              });
            } catch (batchErr) {
              this.logger.error(
                `Batch save failed for page ${page}: ${batchErr}`,
              );
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

      const duration = Date.now() - startTime;
      this.logger.log(
        `\x1b[34mCategory scrape complete: ${allProducts.length} products from ${pagesScraped} pages in ${duration}ms\x1b[0m`,
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
      let data: ScrapedProductDetail = {
        description: '',
        specs: {},
        reviews: [],
        recommendations: [],
      };

      const crawler = new PlaywrightCrawler({
        headless: SCRAPER_CONFIG.headless,
        requestHandlerTimeoutSecs: SCRAPER_CONFIG.requestTimeoutSecs,
        requestHandler: async ({ page }) => {
          await this.enableTurboMode(page);
          await page.setViewportSize(SCRAPER_CONFIG.viewport);
          await page.setExtraHTTPHeaders({
            'User-Agent': SCRAPER_CONFIG.userAgent,
          });

          try {
            await page.waitForSelector('main', { timeout: 10000 });
          } catch (e) {
            return;
          }

          // Try multiple selectors for description
          let description = '';
          for (const selector of SELECTORS.description) {
            const descEl = await page.$(selector);
            if (descEl) {
              description = (await descEl.textContent()) || '';
              if (description.trim()) break;
            }
          }

          const specs: Record<string, string> = {};
          const specItems = await page.$$('li, tr');
          for (const item of specItems) {
            const text = await item.textContent();
            if (text && text.includes(':')) {
              const [key, value] = text.split(':').map((s) => s.trim());
              if (key && value && key.length < 50) specs[key] = value;
            }
          }

          // Try multiple selectors for image
          let image_url: string | undefined;
          for (const selector of SELECTORS.productDetailImage) {
            const imgEl = await page.$(selector);
            if (imgEl) {
              image_url = (await imgEl.getAttribute('src')) || undefined;
              if (image_url) break;
            }
          }

          const reviews: ScrapedReview[] = [];
          try {
            const reviewEls = await this.trySelectorsOnPage(
              page,
              SELECTORS.reviewItem,
            );
            for (const r of reviewEls.slice(0, 5)) {
              const text = await r.textContent();
              if (text)
                reviews.push({
                  author: 'Verified Buyer',
                  rating: 5,
                  text: text.substring(0, 100),
                });
            }
          } catch (e) { }

          const recs: ScrapedProduct[] = [];
          try {
            const relatedItems = await this.trySelectorsOnPage(
              page,
              SELECTORS.relatedProducts,
            );
            for (const item of relatedItems.slice(0, 4)) {
              const titleEl = await item.$('h3');
              const title = await titleEl?.textContent();
              if (title)
                recs.push({
                  source_id: 'related',
                  title: title.trim(),
                  price: 0,
                  source_url: '',
                });
            }
          } catch {
            // Intentionally empty - recommendations are optional
          }

          data = {
            description: description?.trim() || 'Description unavailable.',
            specs,
            image_url,
            reviews,
            recommendations: recs,
          };
        },
      });

      await crawler.run([url]);
      return data;
    });
  }

  // 4. SEARCH
  async searchProducts(query: string): Promise<ScrapedProduct[]> {
    const encodedQuery = encodeURIComponent(query);
    const searchUrl = `https://www.worldofbooks.com/en-gb/search?q=${encodedQuery}`;
    return this.scrapeCategory(searchUrl);
  }

  // 5. SEARCH - ALL PAGES (new method)
  async searchProductsAllPages(
    query: string,
  ): Promise<ScrapeResult<ScrapedProduct[]>> {
    const encodedQuery = encodeURIComponent(query);
    const searchUrl = `https://www.worldofbooks.com/en-gb/search?q=${encodedQuery}`;
    return this.scrapeCategoryAllPages(searchUrl);
  }
}
