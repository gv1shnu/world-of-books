/**
 * Products Controller
 *
 * REST API for product details with on-demand scraping.
 */

import { Controller, Get, Param, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScraperService } from '../scraper/scraper.service';
import { CacheService } from '../cache/cache.service';

// World of Books product handles, e.g. "dune-book-frank-herbert-9780340960196"
const HANDLE_PATTERN = /^[a-z0-9][a-z0-9-]{0,199}$/;

// Spec keys a category listing can store; anything else came from the product page.
const LISTING_SPEC_KEYS = new Set(['isbn', 'condition', 'original_price']);

/** True when the product page has not been scraped yet (or its specs were lost). */
const needsDetails = (product: { description: string | null; specs?: unknown }) => {
    if (!product.description) return true;
    const specs = product.specs && typeof product.specs === 'object' ? Object.keys(product.specs) : [];
    return !specs.some((key) => !LISTING_SPEC_KEYS.has(key));
};

const withCategory = {
    category: {
        select: { title: true, slug: true },
    },
} as const;

@Controller('products')
export class ProductsController {
    private readonly logger = new Logger(ProductsController.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly scraper: ScraperService,
        private readonly cache: CacheService,
    ) { }

    /**
     * GET /products/by-handle/:handle
     *
     * Returns a product by its World of Books handle, which is stable across
     * database resets (unlike the numeric id). If the product is not stored
     * yet, it is rebuilt from its World of Books page.
     */
    @Get('by-handle/:handle')
    async getProductByHandle(@Param('handle') handle: string) {
        if (!HANDLE_PATTERN.test(handle)) {
            throw new NotFoundException('Invalid product handle');
        }

        const cacheKey = `product:handle:${handle}`;
        const cached = await this.cache.get(cacheKey);
        if (cached) return cached;

        let product = await this.prisma.product.findUnique({
            where: { source_id: handle },
            include: withCategory,
        });
        if (!product) {
            product = await this.importFromSource(handle);
        }

        const response = await this.withDetails(product);
        await this.cache.set(cacheKey, response, { ttl: CacheService.TTL.PRODUCTS });
        return response;
    }

    /**
     * GET /products/:id
     *
     * Returns a product by ID with full details.
     * If description is missing, triggers on-demand detail scrape.
     */
    @Get(':id')
    async getProduct(@Param('id') id: string) {
        const productId = parseInt(id, 10);

        if (isNaN(productId)) {
            throw new NotFoundException('Invalid product ID');
        }

        // Check cache first
        const cacheKey = `product:${productId}`;
        const cached = await this.cache.get(cacheKey);
        if (cached) {
            this.logger.log(`Cache HIT for product ${productId}`);
            return cached;
        }

        // Fetch product from database
        const product = await this.prisma.product.findUnique({
            where: { id: productId },
            include: withCategory,
        });

        if (!product) {
            throw new NotFoundException('Product not found');
        }

        const response = await this.withDetails(product);
        await this.cache.set(cacheKey, response, { ttl: CacheService.TTL.PRODUCTS });
        return response;
    }

    /** Adds description and specs, scraping them on first view. */
    private async withDetails<T extends { id: number; description: string | null; specs?: unknown; source_url: string; image_url: string | null }>(
        product: T,
    ) {
        if (!needsDetails(product) || !product.source_url) return product;

        this.logger.log(`Scraping details for product ${product.id}: ${product.source_url}`);
        try {
            const details = await this.scraper.scrapeProductDetail(product.source_url);
            const updated = await this.prisma.product.update({
                where: { id: product.id },
                data: {
                    description: details.description,
                    specs: details.specs,
                    image_url: details.image_url || product.image_url,
                },
                include: withCategory,
            });
            return { ...updated, reviews: details.reviews, recommendations: details.recommendations };
        } catch (error) {
            this.logger.warn(`Failed to scrape product details: ${error}`);
            return product;
        }
    }

    /**
     * Creates a product we have never stored from its World of Books page,
     * filed under the most specific breadcrumb category we know about.
     */
    private async importFromSource(handle: string) {
        let page;
        try {
            page = await this.scraper.scrapeProductByHandle(handle);
        } catch (error) {
            this.logger.warn(`Could not load product ${handle}: ${error}`);
            throw new NotFoundException('Product not found');
        }
        if (!page.title) throw new NotFoundException('Product not found');

        const known = await this.prisma.category.findMany({
            where: { slug: { in: page.categorySlugs } },
        });
        // Breadcrumbs run general -> specific, so prefer the last one we know.
        const target = [...page.categorySlugs]
            .reverse()
            .map((slug) => known.find((c) => c.slug === slug))
            .find(Boolean);
        if (!target) throw new NotFoundException('Product not found');

        const data = {
            title: page.title,
            author: page.author,
            price: page.price ?? 0,
            image_url: page.image_url,
            source_url: page.source_url,
            is_in_stock: page.is_in_stock ?? true,
            description: page.description || null,
            specs: page.specs,
            categoryId: target.id,
        };
        return this.prisma.product.upsert({
            where: { source_id: handle },
            create: { source_id: handle, ...data },
            update: data,
            include: withCategory,
        });
    }
}
