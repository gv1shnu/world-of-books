/**
 * =============================================================================
 * Scraper Service Unit Tests
 * =============================================================================
 *
 * Tests for the web scraping service. Mocks Crawlee/Playwright to avoid
 * requiring a real browser during testing.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ScraperService, parseNavigationHtml } from './scraper.service';
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
    const menuHtml = `
      <a href="/en-gb/collections/fiction-books" data-menu_category="Fiction Books" data-menu_subcategory="Fiction">
      <a data-menu_subcategory="Crime &amp; Mystery" href="/en-gb/collections/crime-and-mystery-books" data-menu_category="Fiction Books">
      <a href="/en-gb/pages/autumn" data-menu_category="Trending Now" data-menu_subcategory="Autumn Reads">
      <a href="/en-gb/collections/fiction-books?ref=menu" data-menu_category="Highlights" data-menu_subcategory="Fiction again">`;

    beforeEach(() => {
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(new Response(menuHtml, { status: 200 }));
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

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

    it('should return navigation parsed from the fetched HTML', async () => {
      const result = await service.scrapeNavigation();

      expect(result).toEqual([
        {
          title: 'Fiction Books',
          slug: 'fiction-books',
          categories: [
            {
              title: 'Fiction',
              slug: 'fiction-books',
              url: 'https://www.worldofbooks.com/en-gb/collections/fiction-books',
            },
            {
              title: 'Crime & Mystery',
              slug: 'crime-and-mystery-books',
              url: 'https://www.worldofbooks.com/en-gb/collections/crime-and-mystery-books',
            },
          ],
        },
      ]);
    });

    it('should fail the job when the menu has no category links', async () => {
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(new Response('<html></html>', { status: 200 }));

      await expect(service.scrapeNavigation()).rejects.toThrow(
        'Navigation scrape found no menu links',
      );
    });
  });

  describe('parseNavigationHtml()', () => {
    it('should ignore non-collection links and duplicate slugs', () => {
      const navs = parseNavigationHtml(`
        <a href="/en-gb/pages/x" data-menu_category="A" data-menu_subcategory="X">
        <a href="/en-gb/collections/y" data-menu_category="A" data-menu_subcategory="Y">
        <a href="/en-gb/collections/y" data-menu_category="B" data-menu_subcategory="Y2">`);

      expect(navs).toHaveLength(1);
      expect(navs[0].categories.map((c) => c.slug)).toEqual(['y']);
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
