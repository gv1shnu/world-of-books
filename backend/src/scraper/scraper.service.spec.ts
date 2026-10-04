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

const collectionHtml = `<script>
  var config = { "algoliaAppId": "APP1", "algoliaSearchApiKey": "KEY1", "algoliaIndexName": "products" };
  collection_id = 12345;
</script>`;

const productHtml = `
  <script type="application/ld+json">{"@type":"Book","name":"Dune","numberOfPages":"412","isbn":"9780340960196","author":{"@type":"Person","name":"Frank Herbert"},"image":"//img.example/dune.jpg","description":"Desert &amp; <b>spice</b>."}</script>
  <table class="additional-info-table"><tbody>
    <tr><td>ISBN 10</td><td><span>0340960191</span></td></tr>
    <tr><td>Condition</td><td><span>Unavailable</span></td></tr>
    <tr hidden><td>Note</td><td>secret</td></tr>
  </tbody></table>`;

const algoliaHit = (n: number) => ({
  productHandle: `book-${n}`,
  shortTitle: `Book ${n}`,
  author: 'Author',
  fromPrice: 3.5,
  imageURL: `https://img.example/${n}.jpg`,
  isbn13: `978000000000${n}`,
});

/** Routes fetch calls to canned WoB HTML and Algolia responses. */
function mockWobFetch(nbPages = 2) {
  return jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.includes('algolia.net')) {
      const params = new URLSearchParams(JSON.parse(String(init?.body)).params);
      const page = Number(params.get('page'));
      return new Response(
        JSON.stringify({ hits: [algoliaHit(page)], page, nbPages, nbHits: nbPages }),
        { status: 200 },
      );
    }
    if (url.includes('/products/')) return new Response(productHtml, { status: 200 });
    return new Response(collectionHtml, { status: 200 });
  });
}

describe('ScraperService', () => {
  let service: ScraperService;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    mockWobFetch();

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

    it('should page through Algolia with the collection filter and report batches', async () => {
      const fetchSpy = mockWobFetch(2);
      const batches: Array<{ current: number; total: number }> = [];

      const result = await service.scrapeCategoryAllPages(
        'https://www.worldofbooks.com/en-gb/collections/fiction-books',
        async (_products, progress) => {
          batches.push(progress);
        },
        5,
      );

      expect(result.pagesScraped).toBe(2);
      expect(result.data.map((p) => p.title)).toEqual(['Book 0', 'Book 1']);
      expect(result.data[0]).toEqual(
        expect.objectContaining({
          source_id: 'book-0',
          price: 3.5,
          source_url: 'https://www.worldofbooks.com/en-gb/products/book-0',
        }),
      );
      expect(batches).toEqual([
        { current: 1, total: 2 },
        { current: 2, total: 2 },
      ]);
      const algoliaCall = fetchSpy.mock.calls.find(([url]) =>
        String(url).includes('APP1-dsn.algolia.net/1/indexes/products/query'),
      );
      expect(JSON.parse(String(algoliaCall?.[1]?.body)).params).toContain(
        'filters=collection_ids%3A12345',
      );
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

    it('should read description, specs and image from the page HTML', async () => {
      const result = await service.scrapeProductDetail(
        'https://www.worldofbooks.com/en-gb/products/dune',
      );

      expect(result.description).toBe('Desert & spice.');
      expect(result.image_url).toBe('https://img.example/dune.jpg');
      expect(result.specs).toEqual({
        'Number of pages': '412',
        'ISBN 13': '9780340960196',
        Author: 'Frank Herbert',
        'ISBN 10': '0340960191',
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Helper methods tests
  // ---------------------------------------------------------------------------
  describe('searchProducts()', () => {
    it('should return array of products', async () => {
      const fetchSpy = mockWobFetch(1);
      const result = await service.searchProducts('dune');

      expect(result.map((p) => p.title)).toEqual(['Book 0']);
      const algoliaCall = fetchSpy.mock.calls.find(([url]) =>
        String(url).includes('algolia.net'),
      );
      expect(JSON.parse(String(algoliaCall?.[1]?.body)).params).toContain('query=dune');
    });
  });
});
