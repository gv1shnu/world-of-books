/**
 * Products Controller
 * 
 * REST API for product details with on-demand scraping.
 */

import { Controller, Get, Param, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScraperService } from '../scraper/scraper.service';
import { CacheService } from '../cache/cache.service';

@Controller('products')
export class ProductsController {
    private readonly logger = new Logger(ProductsController.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly scraper: ScraperService,
        private readonly cache: CacheService,
    ) { }

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
            include: {
                category: {
                    select: { title: true, slug: true },
                },
            },
        });

        if (!product) {
            throw new NotFoundException('Product not found');
        }

        // If no description, trigger on-demand detail scrape
        if (!product.description && product.source_url) {
            this.logger.log(`Scraping details for product ${productId}: ${product.source_url}`);

            try {
                const details = await this.scraper.scrapeProductDetail(product.source_url);

                // Update product with scraped details
                const updatedProduct = await this.prisma.product.update({
                    where: { id: productId },
                    data: {
                        description: details.description,
                        specs: details.specs,
                        image_url: details.image_url || product.image_url,
                    },
                    include: {
                        category: {
                            select: { title: true, slug: true },
                        },
                    },
                });

                // Build response with reviews and recommendations
                const response = {
                    ...updatedProduct,
                    reviews: details.reviews,
                    recommendations: details.recommendations,
                };

                // Cache for 3 minutes
                await this.cache.set(cacheKey, response, { ttl: CacheService.TTL.PRODUCTS });

                return response;
            } catch (error) {
                this.logger.warn(`Failed to scrape product details: ${error}`);
                // Return product without extra details
                return product;
            }
        }

        // Cache and return existing product
        await this.cache.set(cacheKey, product, { ttl: CacheService.TTL.PRODUCTS });
        return product;
    }
}
