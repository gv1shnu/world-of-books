import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ScraperService } from './scraper.service';
import { ScraperProcessor } from './scraper.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'scrape-queue',
    }),
    PrismaModule,
    CacheModule,
  ],
  providers: [ScraperService, ScraperProcessor],
  exports: [ScraperService, BullModule],
})
export class ScraperModule {}
