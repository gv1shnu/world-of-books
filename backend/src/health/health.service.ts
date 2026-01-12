import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ScraperService } from '../scraper/scraper.service';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly scraperService: ScraperService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkSelectors() {
    this.logger.log('Running daily health check for selectors...');

    const testUrl = 'https://www.worldofbooks.com/en-gb/category/fiction-books';

    try {
      // Run a quick scrape of just the first page
      // We don't save to DB, just verify we get data back
      const products = await this.scraperService.scrapeCategory(testUrl, 1);

      if (products.length > 0) {
        this.logger.log(
          `Health Check PASSED: Found ${products.length} products per page.`,
        );
        // Optional: Check specific fields like price/title to ensure they aren't empty/null
        const firstProduct = products[0];
        if (!firstProduct.title || firstProduct.price === 0) {
          this.logger.warn(
            'Health Check WARNING: Products found but might have missing data (title/price).',
          );
        }
      } else {
        this.logger.error(
          'Health Check FAILED: No products found. Selectors might be broken!',
        );
        // TODO: Trigger external alert (Email/Slack/PagerDuty)
      }
    } catch (error) {
      this.logger.error(
        `Health Check ERROR: Scraper threw an exception: ${error}`,
      );
    }
  }
}
