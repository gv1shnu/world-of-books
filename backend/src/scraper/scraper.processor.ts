/**
 * Scraper Queue Processor
 * 
 * Background worker that processes scraping jobs from Redis queue.
 * Picks up jobs, scrapes category pages, and saves products to DB.
 */

import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import * as Bull from 'bull';
import { ScraperService } from './scraper.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';

@Processor('scrape-queue')
export class ScraperProcessor {
  private readonly logger = new Logger(ScraperProcessor.name);

  constructor(
    private readonly scraper: ScraperService,
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) { }

  /**
   * Processes a 'scrape-category' job.
   */
  @Process('scrape-category')
  async handleScrapeCategory(
    job: Bull.Job<{ url: string; categoryId: number; slug: string; maxPages?: number }>,
  ) {
    const { url, categoryId, slug, maxPages } = job.data;
    this.logger.log(`\x1b[34m[Worker] Starting job: ${slug} (maxPages: ${maxPages || 'config default'})\x1b[0m`);
    const startTime = Date.now();

    try {
      // Define batch handler for incremental updates
      const onBatch = async (
        products: any[],
        progress: { current: number; total: number },
      ) => {
        if (products.length === 0) return;

        this.logger.log(
          `\x1b[34m[Worker] Saving batch of ${products.length} products (Page ${progress.current}/${progress.total})\x1b[0m`,
        );

        try {
          // 1. Save products to DB immediately
          await this.prisma.$transaction(async (tx) => {
            for (const product of products) {
              await tx.product.upsert({
                where: { source_id: product.source_id },
                update: {
                  price: product.price,
                  is_in_stock: true,
                  updatedAt: new Date(),
                  ...(product.isbn && { specs: { isbn: product.isbn } }),
                },
                create: {
                  title: product.title,
                  author: product.author,
                  price: product.price,
                  source_id: product.source_id,
                  source_url: product.source_url,
                  image_url: product.image_url,
                  is_in_stock: true,
                  categoryId: categoryId,
                  specs:
                    product.isbn || product.condition
                      ? {
                        ...(product.isbn && { isbn: product.isbn }),
                        ...(product.condition && {
                          condition: product.condition,
                        }),
                        ...(product.original_price && {
                          original_price: product.original_price,
                        }),
                      }
                      : undefined,
                },
              });
            }

            // 2. Update category count so frontend sees numbers go up
            // We count actual products in DB to be accurate
            const count = await tx.product.count({
              where: { categoryId },
            });

            await tx.category.update({
              where: { id: categoryId },
              data: {
                product_count: count,
                last_scraped_at: new Date(),
              },
            });
          });

          // 3. Update progress in Redis for polling endpoint
          // We need the slug to key the progress. Ideally pass it in job data.
          // Fallback: extract from URL if not provided
          const targetSlug = slug || url.split('/').pop() || 'unknown';
          await this.cache.setScrapeProgress(
            targetSlug,
            progress.current,
            progress.total,
          );
        } catch (err) {
          this.logger.error(`Failed to save batch: ${err}`);
          // Don't throw - continue scraping even if one batch fails saving
        }
      };

      // Scrape all pages with incremental callback
      const result = await this.scraper.scrapeCategoryAllPages(url, onBatch, maxPages);
      const products = result.data;
      const duration = Date.now() - startTime;

      // Clear progress when done
      const targetSlug = slug || url.split('/').pop() || 'unknown';
      await this.cache.clearScrapeProgress(targetSlug);

      this.logger.log(
        `\x1b[34m[Worker] Job Complete. Total ${products.length} books from ${result.pagesScraped} pages in ${duration}ms\x1b[0m`,
      );

      return {
        success: true,
        productsFound: products.length,
        pagesScraped: result.pagesScraped,
        errors: result.errors,
        duration,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[Worker] Job Failed: ${msg}`);
      throw error;
    }
  }
}
