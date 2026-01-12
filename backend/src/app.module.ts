/**
 * =============================================================================
 * Application Root Module
 * =============================================================================
 *
 * The main NestJS module that wires together all application components.
 *
 * Module structure:
 *   - ConfigModule: Environment variable management
 *   - BullModule: Redis-backed job queue for background scraping
 *   - CacheModule: Redis caching layer (optional, graceful degradation)
 *   - PrismaModule: Database access via Prisma ORM
 *   - ScraperModule: Web scraping logic and queue processor
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { ScraperModule } from './scraper/scraper.module';
import { CacheModule } from './cache/cache.module';
import { CategoriesController } from './categories/categories.controller';
import { HealthModule } from './health/health.module';
import { BullModule } from '@nestjs/bull';

@Module({
  imports: [
    // Load .env file and make config available globally
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Redis-backed job queue for async scraping tasks
    // Uses Bull library for reliable job processing with retries
    BullModule.forRoot({
      redis: process.env.REDIS_URL || 'redis://localhost:6379',
    }),

    // Global cache module (Redis-based)
    CacheModule,

    // Database access
    PrismaModule,

    // Scraper service and background worker
    ScraperModule,

    // Health Checks
    HealthModule,
  ],
  controllers: [CategoriesController],
  providers: [],
})
export class AppModule {}
