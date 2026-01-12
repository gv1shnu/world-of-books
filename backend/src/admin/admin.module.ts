/**
 * Admin Module
 * 
 * Provides admin dashboard endpoints.
 */

import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CacheModule } from '../cache/cache.module';

@Module({
    imports: [PrismaModule, CacheModule],
    controllers: [AdminController],
})
export class AdminModule { }
