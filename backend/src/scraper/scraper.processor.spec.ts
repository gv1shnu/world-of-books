import { Test, TestingModule } from '@nestjs/testing';
import { ScraperProcessor } from './scraper.processor';
import { ScraperService } from './scraper.service';
import { CacheService } from '../cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { Job } from 'bull';

describe('ScraperProcessor', () => {
  let processor: ScraperProcessor;
  let scraperService: Partial<ScraperService>;
  let cacheService: Partial<CacheService>;
  let prismaService: any;

  beforeEach(async () => {
    scraperService = {
      scrapeCategoryAllPages: jest.fn(),
    };

    cacheService = {
      setScrapeProgress: jest.fn(),
      clearScrapeProgress: jest.fn(),
    };

    prismaService = {
      $transaction: jest.fn((cb) =>
        cb({
          product: {
            upsert: jest.fn(),
            count: jest.fn().mockResolvedValue(10), // Return dummy count
          },
          category: { update: jest.fn() },
        }),
      ),
      product: { upsert: jest.fn() },
      category: { update: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScraperProcessor,
        { provide: ScraperService, useValue: scraperService },
        { provide: CacheService, useValue: cacheService },
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    processor = module.get<ScraperProcessor>(ScraperProcessor);
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('handleScrapeCategory', () => {
    it('should call scraperService and use the onBatch callback', async () => {
      const job = {
        data: { url: 'http://test.com', categoryId: 1, slug: 'test-cat' },
      } as Job;

      // Mock implementation to immediately call the callback
      (scraperService.scrapeCategoryAllPages as jest.Mock).mockImplementation(
        async (url, onBatch) => {
          if (onBatch) {
            await onBatch([{ title: 'Book 1', source_id: '1' }], {
              current: 1,
              total: 5,
            });
          }
          return { data: [], pagesScraped: 1, totalItems: 1, errors: [] };
        },
      );

      await processor.handleScrapeCategory(job);

      // Verify scraper was called
      expect(scraperService.scrapeCategoryAllPages).toHaveBeenCalledWith(
        'http://test.com',
        expect.any(Function),
        undefined,
      );

      // Verify transaction was called (via callback)
      expect(prismaService.$transaction).toHaveBeenCalled();

      // Verify cache progress was updated (via callback)
      expect(cacheService.setScrapeProgress).toHaveBeenCalledWith(
        'test-cat',
        1,
        5,
      );

      // Verify progress cleared at end
      expect(cacheService.clearScrapeProgress).toHaveBeenCalledWith('test-cat');
    });
  });
});
