/**
 * Admin Controller
 * 
 * Dashboard endpoints for monitoring cache and scrape jobs.
 */

import { Controller, Get, Query, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';

@Controller('admin')
export class AdminController {
    private readonly logger = new Logger(AdminController.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly cache: CacheService,
    ) { }

    /**
     * GET /admin/cache-stats
     * 
     * Returns Redis cache statistics.
     */
    @Get('cache-stats')
    async getCacheStats() {
        return this.cache.getStats();
    }

    /**
     * GET /admin/jobs
     * 
     * Returns recent scrape job history.
     * Query: ?limit=50 (default 50, max 100)
     */
    @Get('jobs')
    async getScrapeJobs(@Query('limit') limitStr?: string) {
        const limit = Math.min(100, Math.max(1, parseInt(limitStr || '50', 10)));

        const jobs = await this.prisma.scrapeJob.findMany({
            orderBy: { started_at: 'desc' },
            take: limit,
        });

        // Calculate summary stats
        const stats = await this.prisma.scrapeJob.groupBy({
            by: ['status'],
            _count: true,
        });

        const statusCounts = stats.reduce(
            (acc, s) => {
                acc[s.status.toLowerCase()] = s._count;
                return acc;
            },
            {} as Record<string, number>,
        );

        return {
            jobs,
            stats: {
                total: jobs.length,
                ...statusCounts,
            },
        };
    }

    /**
     * GET /admin/overview
     * 
     * Returns overall system stats.
     */
    @Get('overview')
    async getOverview() {
        const [
            navigationCount,
            categoryCount,
            productCount,
            jobCount,
            cacheStats,
        ] = await Promise.all([
            this.prisma.navigation.count(),
            this.prisma.category.count(),
            this.prisma.product.count(),
            this.prisma.scrapeJob.count(),
            this.cache.getStats(),
        ]);

        const recentJobs = await this.prisma.scrapeJob.findMany({
            orderBy: { started_at: 'desc' },
            take: 5,
        });

        return {
            counts: {
                navigations: navigationCount,
                categories: categoryCount,
                products: productCount,
                scrapeJobs: jobCount,
            },
            cache: cacheStats,
            recentJobs,
        };
    }
}
