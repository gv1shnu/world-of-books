/**
 * =============================================================================
 * Scraper Service Unit Tests
 * =============================================================================
 *
 * Tests for the web scraping service. Mocks Crawlee/Playwright to avoid
 * requiring a real browser during testing.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ScraperService } from './scraper.service';
import { PrismaService } from '../prisma/prisma.service';

// Mock crawlee
jest.mock('crawlee', () => ({
  PlaywrightCrawler: jest.fn().mockImplementation(() => ({
    run: jest.fn().mockResolvedValue(undefined),
  })),
}));

const mockPrisma = {
  scrapeJob: {
    create: jest.fn().mockResolvedValue({ id: 1 }),
    update: jest.fn().mockResolvedValue({}),
  },
  product: {
    upsert: jest.fn().mockResolvedValue({}),
  },
  navigation: {
    create: jest.fn().mockResolvedValue({ id: 1 }),
  },
  category: {
    createMany: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
  },
};

describe('ScraperService', () => {
  let service: ScraperService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScraperService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ScraperService>(ScraperService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // scrapeCategory() tests
  // ---------------------------------------------------------------------------
  describe('scrapeCategory()', () => {
    it('should track metrics (Start and Complete) when scraping', async () => {
      await service.scrapeCategory('https://test-url.com');

      expect(mockPrisma.scrapeJob.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            target_url: 'https://test-url.com',
            status: 'PENDING',
            target_type: 'CATEGORY',
          }),
        }),
      );

      expect(mockPrisma.scrapeJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({
            status: 'COMPLETED',
            items_found: expect.any(Number),
          }),
        }),
      );
    });

    it('should return empty array on successful scrape with no products', async () => {
      const result = await service.scrapeCategory('https://test-url.com');

      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // scrapeNavigation() tests
  // ---------------------------------------------------------------------------
  describe('scrapeNavigation()', () => {
    it('should track navigation scrape job', async () => {
      await service.scrapeNavigation();

      expect(mockPrisma.scrapeJob.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            target_type: 'NAVIGATION',
            status: 'PENDING',
          }),
        }),
      );
    });

    it('should return navigation array', async () => {
      const result = await service.scrapeNavigation();

      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // scrapeCategoryAllPages() tests
  // ---------------------------------------------------------------------------
  describe('scrapeCategoryAllPages()', () => {
    it('should track multi-page scrape job', async () => {
      await service.scrapeCategoryAllPages('https://test-url.com/category');

      expect(mockPrisma.scrapeJob.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            target_type: 'CATEGORY',
            status: 'PENDING',
          }),
        }),
      );
    });

    it('should return scrape result with metadata', async () => {
      const result = await service.scrapeCategoryAllPages(
        'https://test-url.com/category',
      );

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('pagesScraped');
      expect(result).toHaveProperty('totalItems');
      expect(result).toHaveProperty('errors');
    });
  });

  // ---------------------------------------------------------------------------
  // scrapeProductDetail() tests
  // ---------------------------------------------------------------------------
  describe('scrapeProductDetail()', () => {
    it('should track product detail scrape job', async () => {
      await service.scrapeProductDetail('https://test-url.com/product/123');

      expect(mockPrisma.scrapeJob.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            target_type: 'PRODUCT',
            status: 'PENDING',
          }),
        }),
      );
    });

    it('should return product detail object', async () => {
      const result = await service.scrapeProductDetail(
        'https://test-url.com/product/123',
      );

      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('specs');
      expect(result).toHaveProperty('reviews');
    });
  });

  // ---------------------------------------------------------------------------
  // Helper methods tests
  // ---------------------------------------------------------------------------
  describe('searchProducts()', () => {
    it('should return array of products', async () => {
      const result = await service.searchProducts('dune');

      expect(Array.isArray(result)).toBe(true);
    });
  });
});
