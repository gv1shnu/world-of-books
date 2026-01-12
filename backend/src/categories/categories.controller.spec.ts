/**
 * =============================================================================
 * Categories Controller Unit Tests
 * =============================================================================
 *
 * Tests for the REST API endpoints. Uses mocked dependencies to test
 * controller logic in isolation.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesController } from './categories.controller';
import { PrismaService } from '../prisma/prisma.service';
import { ScraperService } from '../scraper/scraper.service';
import { CacheService } from '../cache/cache.service';
import { getQueueToken } from '@nestjs/bull';

// Mock dependencies
const mockPrisma = {
  navigation: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  category: {
    findUnique: jest.fn(),
    update: jest.fn(),
    createMany: jest.fn(),
  },
  product: {
    count: jest.fn(),
  },
};

const mockScraper = {
  scrapeNavigation: jest.fn(),
  scrapeCategory: jest.fn(),
  scrapeCategoryAllPages: jest.fn(),
};

const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  getStats: jest.fn(),
};

const mockQueue = {
  add: jest.fn(),
};

describe('CategoriesController', () => {
  let controller: CategoriesController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ScraperService, useValue: mockScraper },
        { provide: CacheService, useValue: mockCache },
        { provide: getQueueToken('scrape-queue'), useValue: mockQueue },
      ],
    }).compile();

    controller = module.get<CategoriesController>(CategoriesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // GET /categories/navigations
  // ---------------------------------------------------------------------------
  describe('getNavigations()', () => {
    it('should return cached navigations on cache hit', async () => {
      const cachedData = [{ id: 1, title: 'Fiction', categories: [] }];
      mockCache.get.mockResolvedValue(cachedData);

      const result = await controller.getNavigations();

      expect(result).toEqual(cachedData);
      expect(mockPrisma.navigation.findMany).not.toHaveBeenCalled();
    });

    it('should query database on cache miss', async () => {
      const dbData = [
        { id: 1, title: 'Fiction', categories: [{ id: 1, title: 'Sci-Fi' }] },
      ];
      mockCache.get.mockResolvedValue(null);
      mockPrisma.navigation.findMany.mockResolvedValue(dbData);

      const result = await controller.getNavigations();

      expect(result).toEqual(dbData);
      expect(mockPrisma.navigation.findMany).toHaveBeenCalledWith({
        include: { categories: true },
      });
      expect(mockCache.set).toHaveBeenCalled();
    });

    it('should trigger scrape and return placeholder when database is empty', async () => {
      mockCache.get.mockResolvedValue(null);
      mockPrisma.navigation.findMany.mockResolvedValue([]);
      mockScraper.scrapeNavigation.mockResolvedValue([]);

      const result = await controller.getNavigations();

      expect(result).toEqual([
        { id: 1, title: 'Loading Library...', categories: [] },
      ]);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /categories/:slug
  // ---------------------------------------------------------------------------
  describe('getCategory()', () => {
    const mockCategory = {
      id: 1,
      title: 'Science Fiction',
      slug: 'science-fiction',
      last_scraped_at: new Date(),
      products: [
        { id: 1, title: 'Dune', price: 9.99 },
        { id: 2, title: '1984', price: 7.99 },
      ],
    };

    it('should return cached category on cache hit (default params)', async () => {
      const cachedResponse = {
        ...mockCategory,
        pagination: { page: 1, limit: 24 },
      };
      mockCache.get.mockResolvedValue(cachedResponse);

      const result = await controller.getCategory('science-fiction', {});

      expect(result).toEqual(cachedResponse);
      expect(mockPrisma.category.findUnique).not.toHaveBeenCalled();
    });

    it('should query database on cache miss', async () => {
      mockCache.get.mockResolvedValue(null);
      mockPrisma.category.findUnique.mockResolvedValue(mockCategory);
      mockPrisma.product.count.mockResolvedValue(2);

      const result = await controller.getCategory('science-fiction', {});

      expect(mockPrisma.category.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { slug: 'science-fiction' },
        }),
      );
      expect(result).toHaveProperty('pagination');
      expect((result as any).pagination.totalProducts).toBe(2);
    });

    it('should return not found message for non-existent category', async () => {
      mockCache.get.mockResolvedValue(null);
      mockPrisma.category.findUnique.mockResolvedValue(null);
      mockPrisma.product.count.mockResolvedValue(0);

      const result = await controller.getCategory('non-existent', {});

      expect(result).toEqual({ message: 'Category not found.' });
    });

    it('should handle pagination params', async () => {
      mockCache.get.mockResolvedValue(null);
      mockPrisma.category.findUnique.mockResolvedValue(mockCategory);
      mockPrisma.product.count.mockResolvedValue(100);

      const result = await controller.getCategory('science-fiction', {
        page: '2',
        limit: '10',
      });

      expect((result as any).pagination).toEqual(
        expect.objectContaining({
          page: 2,
          limit: 10,
          hasNext: true,
          hasPrev: true,
        }),
      );
    });

    it('should queue background scrape for stale data', async () => {
      const staleCategory = {
        ...mockCategory,
        last_scraped_at: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      };
      mockCache.get.mockResolvedValue(null);
      mockPrisma.category.findUnique.mockResolvedValue(staleCategory);
      mockPrisma.product.count.mockResolvedValue(2);
      mockPrisma.category.update.mockResolvedValue({});

      await controller.getCategory('science-fiction', {});

      expect(mockQueue.add).toHaveBeenCalledWith('scrape-category', {
        url: 'https://www.worldofbooks.com/en-gb/collections/science-fiction',
        categoryId: 1,
        slug: 'science-fiction',
      });
      expect(mockCache.delete).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // GET /categories/admin/cache-stats
  // ---------------------------------------------------------------------------
  describe('getCacheStats()', () => {
    it('should return cache statistics', async () => {
      const stats = { connected: true, keys: 42, memory: '1.5M' };
      mockCache.getStats.mockResolvedValue(stats);

      const result = await controller.getCacheStats();

      expect(result).toEqual(stats);
    });
  });

  // ---------------------------------------------------------------------------
  // getSortOrder() helper
  // ---------------------------------------------------------------------------
  describe('getSortOrder()', () => {
    it('should return price ascending order', () => {
      const result = (controller as any).getSortOrder('price_asc');
      expect(result).toEqual({ price: 'asc' });
    });

    it('should return price descending order', () => {
      const result = (controller as any).getSortOrder('price_desc');
      expect(result).toEqual({ price: 'desc' });
    });

    it('should return newest order', () => {
      const result = (controller as any).getSortOrder('newest');
      expect(result).toEqual({ updatedAt: 'desc' });
    });

    it('should return title order', () => {
      const result = (controller as any).getSortOrder('title');
      expect(result).toEqual({ title: 'asc' });
    });

    it('should return default order for undefined', () => {
      const result = (controller as any).getSortOrder(undefined);
      expect(result).toEqual({ updatedAt: 'desc' });
    });
  });
});
