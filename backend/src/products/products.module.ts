/**
 * Products Module
 * 
 * Provides product detail endpoints.
 */

import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ScraperModule } from '../scraper/scraper.module';
import { CacheModule } from '../cache/cache.module';

@Module({
    imports: [PrismaModule, ScraperModule, CacheModule],
    controllers: [ProductsController],
})
export class ProductsModule { }
