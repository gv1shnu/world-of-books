import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthService } from './health.service';
import { ScraperModule } from '../scraper/scraper.module';

@Module({
  imports: [ScheduleModule.forRoot(), ScraperModule],
  providers: [HealthService],
})
export class HealthModule {}
