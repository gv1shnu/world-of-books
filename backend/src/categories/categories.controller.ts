/**
 * Categories Controller
 * 
 * REST API for browsing categories and products.
 * Uses Redis caching and background scraping for stale data.
 */

import { Controller, Get, Param, Query, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import * as Bull from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { ScraperService } from '../scraper/scraper.service';
import { CacheService } from '../cache/cache.service';

// Query parameters for product listing pagination
interface PaginationQuery {
  page?: string; // Page number (1-indexed)
  limit?: string; // Items per page (max 100)
  sort?: 'price_asc' | 'price_desc' | 'newest' | 'title';
  maxPages?: string; // Max pages to scrape (for on-demand scraping)
}

@Controller('categories')
export class CategoriesController {
  private readonly logger = new Logger(CategoriesController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scraper: ScraperService,
    private readonly cache: CacheService,
    @InjectQueue('scrape-queue') private readonly scrapeQueue: Bull.Queue,
  ) { }

  // ---------------------------------------------------------------------------
  // GET /categories/navigations
  // ---------------------------------------------------------------------------
  /**
   * Returns the complete navigation structure for the frontend sidebar/menu.
   *
   * This endpoint:
   *   1. Checks for cached data first (1 hour TTL)
   *   2. Falls back to database if cache miss
   *   3. If database is empty, triggers a background scrape
   *
   * The "Loading Library..." response is returned while initial scrape runs.
   */
  @Get('navigations')
  async getNavigations() {

    try {
      const startTime = Date.now();

      // Try cache first for fast response
      const cacheKey = 'nav:all';
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        this.logger.log(
          `Cache HIT - returning cached navigations (${Date.now() - startTime}ms)`,
        );
        return cached;
      }

      // Cache miss - query database
      const navs = await this.prisma.navigation.findMany({
        include: { categories: true },
      });

      // Database empty? This is first run - trigger initial scrape
      if (navs.length === 0) {
        // Fire and forget - don't block the response
        this.scraper
          .scrapeNavigation()
          .then(async (scrapedNavs) => {
            for (const nav of scrapedNavs) {
              try {
                const savedNav = await this.prisma.navigation.create({
                  data: { title: nav.title, slug: nav.slug },
                });

                if (nav.categories.length > 0) {
                  await this.prisma.category.createMany({
                    data: nav.categories.map((cat) => ({
                      title: cat.title,
                      slug: cat.slug,
                      navigation_id: savedNav.id,
                    })),
                  });
                }
              } catch {
                // Silent fail
              }
            }

            // Clear cache so next request gets fresh data
            await this.cache.delete(cacheKey);
          })
          .catch(() => {
            // Silent fail
          });

        // Return placeholder while scraping
        return [{ id: 1, title: 'Loading Library...', categories: [] }];
      }

      // Cache the navigation for future requests
      await this.cache.set(cacheKey, navs, {
        ttl: CacheService.TTL.NAVIGATION,
      });

      return navs;
    } catch (error) {
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // GET /categories/:slug
  // ---------------------------------------------------------------------------
  /**
   * Returns a single category with its products (paginated).
   *
   * Query parameters:
   *   - page: Page number (default: 1)
   *   - limit: Items per page (default: 24, max: 100)
   *   - sort: price_asc | price_desc | newest | title
   *
   * Response includes pagination metadata:
   *   { ...category, pagination: { page, limit, totalProducts, totalPages, hasNext, hasPrev } }
   *
   * Staleness check:
   *   If products haven't been refreshed in 1 hour, a background scrape is queued.
   *   The stale data is returned immediately while fresh data is being fetched.
   */
  @Get(':slug')
  async getCategory(
    @Param('slug') slug: string,
    @Query() query: PaginationQuery,
  ) {

    try {
      const startTime = Date.now();

      // Parse and validate pagination params
      const page = Math.max(1, parseInt(query.page || '1', 10));
      const limit = Math.min(
        100,
        Math.max(1, parseInt(query.limit || '24', 10)),
      );
      const skip = (page - 1) * limit;

      const orderBy = this.getSortOrder(query.sort);

      // Cache only default requests (page 1, limit 24, no sort)
      const isDefaultRequest = page === 1 && limit === 24 && !query.sort;
      const cacheKey = `cat:${slug}`;

      if (isDefaultRequest) {
        const cached = await this.cache.get(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // Optimized query: fetch category + paginated products in parallel
      const [category, totalProducts] = await Promise.all([
        this.prisma.category.findUnique({
          where: { slug },
          include: {
            products: {
              skip,
              take: limit,
              orderBy,
              // Only select fields needed for product cards (no full description)
              select: {
                id: true,
                title: true,
                author: true,
                price: true,
                image_url: true,
                source_url: true,
                source_id: true,
                is_in_stock: true,
                specs: true,
              },
            },
          },
        }),
        this.prisma.product.count({
          where: { category: { slug } },
        }),
      ]);

      if (!category) {
        return { message: 'Category not found.' };
      }

      // Build response with pagination info
      const totalPages = Math.ceil(totalProducts / limit);
      const response = {
        ...category,
        pagination: {
          page,
          limit,
          totalProducts,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };

      this.logger.log(
        `Found category: ${category.title} (${category.products.length} of ${totalProducts} products) (${Date.now() - startTime}ms)`,
      );

      // Check if category data is stale (older than 1 hour) OR has no products
      const oneHour = 1000 * 60 * 60;
      const lastScraped = category.last_scraped_at
        ? new Date(category.last_scraped_at).getTime()
        : 0;
      const isStale = Date.now() - lastScraped > oneHour;
      const hasNoProducts = totalProducts === 0;
      const shouldScrape = isStale || hasNoProducts;

      if (shouldScrape) {
        // Mark as being refreshed (prevents multiple simultaneous scrapes)
        await this.prisma.category.update({
          where: { id: category.id },
          data: { last_scraped_at: new Date() },
        });

        // Queue background scrape job
        const targetUrl = `https://www.worldofbooks.com/en-gb/collections/${slug}`;
        const maxPagesToScrape = query.maxPages ? Math.min(100, Math.max(1, parseInt(query.maxPages, 10))) : undefined;
        await this.scrapeQueue.add('scrape-category', {
          url: targetUrl,
          categoryId: category.id,
          slug: slug,
          maxPages: maxPagesToScrape,
        });

        // Invalidate cache so next request gets fresh data
        await this.cache.delete(cacheKey);

      } else {
        // Cache default requests
        if (isDefaultRequest) {
          await this.cache.set(cacheKey, response, {
            ttl: CacheService.TTL.CATEGORY,
          });
        }
      }

      return response;
    } catch (error) {
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // GET /categories/:slug/progress
  // ---------------------------------------------------------------------------
  /**
   * Returns real-time scraping progress for a category.
   * Used by frontend to show specific "Page X of Y" progress.
   */
  @Get(':slug/progress')
  async getCategoryProgress(@Param('slug') slug: string) {
    const progress = await this.cache.getScrapeProgress(slug);

    // Also check if there are any products in DB to return "started" state
    const productsCount = await this.prisma.product.count({
      where: { category: { slug } },
    });

    return {
      active: !!progress,
      productsCount,
      ...progress,
    };
  }

  // ---------------------------------------------------------------------------
  // GET /categories/admin/cache-stats
  // ---------------------------------------------------------------------------
  /**
   * Returns Redis cache statistics for monitoring.
   * Useful for debugging and dashboards.
   */
  @Get('admin/cache-stats')
  async getCacheStats() {
    return this.cache.getStats();
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Converts sort query param to Prisma orderBy clause
   */
  private getSortOrder(sort?: string) {
    switch (sort) {
      case 'price_asc':
        return { price: 'asc' as const };
      case 'price_desc':
        return { price: 'desc' as const };
      case 'newest':
        return { updatedAt: 'desc' as const };
      case 'title':
        return { title: 'asc' as const };
      default:
        return { updatedAt: 'desc' as const };
    }
  }
}
