jest.mock('crawlee', () => ({ PlaywrightCrawler: jest.fn() }));

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { PrismaService } from '../prisma/prisma.service';
import { ScraperService } from '../scraper/scraper.service';
import { CacheService } from '../cache/cache.service';

const stored = {
  id: 7,
  title: 'Dune',
  description: 'Spice.',
  source_url: 'https://www.worldofbooks.com/en-gb/products/dune-book',
  image_url: null,
  category: { title: 'Sci-Fi', slug: 'sci-fi-books' },
};

const mockPrisma = {
  product: {
    findUnique: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  },
  category: {
    findMany: jest.fn(),
  },
};
const mockScraper = {
  scrapeProductDetail: jest.fn(),
  scrapeProductByHandle: jest.fn(),
};
const mockCache = { get: jest.fn(), set: jest.fn() };

describe('ProductsController', () => {
  let controller: ProductsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCache.get.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ScraperService, useValue: mockScraper },
        { provide: CacheService, useValue: mockCache },
      ],
    }).compile();

    controller = module.get(ProductsController);
  });

  describe('getProductByHandle()', () => {
    it('returns a stored product looked up by its handle', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(stored);

      const result = await controller.getProductByHandle('dune-book');

      expect(result).toEqual(stored);
      expect(mockPrisma.product.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { source_id: 'dune-book' } }),
      );
      expect(mockScraper.scrapeProductByHandle).not.toHaveBeenCalled();
    });

    it('rebuilds a missing product under its most specific known breadcrumb category', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);
      mockScraper.scrapeProductByHandle.mockResolvedValue({
        title: 'Dune',
        author: 'Frank Herbert',
        price: 4.2,
        is_in_stock: true,
        description: 'Spice.',
        specs: { 'Number of pages': '412' },
        image_url: 'https://img.example/dune.jpg',
        categorySlugs: ['fiction-books', 'sci-fi-books'],
        source_url: 'https://www.worldofbooks.com/en-gb/products/dune-book',
      });
      mockPrisma.category.findMany.mockResolvedValue([
        { id: 1, slug: 'fiction-books' },
        { id: 2, slug: 'sci-fi-books' },
      ]);
      mockPrisma.product.upsert.mockResolvedValue(stored);

      await controller.getProductByHandle('dune-book');

      expect(mockPrisma.product.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { source_id: 'dune-book' },
          create: expect.objectContaining({
            source_id: 'dune-book',
            title: 'Dune',
            price: 4.2,
            categoryId: 2,
          }),
        }),
      );
    });

    it('returns 404 when the handle is not on World of Books', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);
      mockScraper.scrapeProductByHandle.mockRejectedValue(new Error('HTTP 404'));

      await expect(controller.getProductByHandle('no-such-book')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects handles that are not World of Books slugs', async () => {
      await expect(controller.getProductByHandle('../etc/passwd')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.product.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('getProduct()', () => {
    it('re-scrapes details when only listing specs are stored', async () => {
      const damaged = { ...stored, specs: { isbn: '9780340960196' } };
      mockPrisma.product.findUnique.mockResolvedValue(damaged);
      mockScraper.scrapeProductDetail.mockResolvedValue({
        description: 'Spice.',
        specs: { 'Number of pages': '412' },
        reviews: [],
        recommendations: [],
      });
      mockPrisma.product.update.mockResolvedValue({ ...damaged, specs: { 'Number of pages': '412' } });

      await controller.getProduct('7');

      expect(mockScraper.scrapeProductDetail).toHaveBeenCalledWith(stored.source_url);
    });

    it('does not re-scrape a product with full details', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ ...stored, specs: { 'Number of pages': '412' } });

      await controller.getProduct('7');

      expect(mockScraper.scrapeProductDetail).not.toHaveBeenCalled();
    });
  });
});
