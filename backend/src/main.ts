/**
 * =============================================================================
 * Application Entry Point
 * =============================================================================
 *
 * Bootstrap file for the NestJS backend server. Configures CORS, logging,
 * and starts the HTTP listener.
 *
 * Environment variables:
 *   - DATABASE_URL: PostgreSQL connection string
 *   - REDIS_URL: Redis connection string
 *   - FRONTEND_ORIGINS: Comma-separated frontend origins for CORS
 *   - VERCEL_URL: Legacy single frontend origin for CORS
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

// Early startup logging - helps debug production deployment issues
console.log('=== STARTUP DEBUG ===');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
console.log('REDIS_URL:', process.env.REDIS_URL ? 'SET' : 'NOT SET');
console.log('FRONTEND_ORIGINS:', process.env.FRONTEND_ORIGINS ? 'SET' : 'NOT SET');
console.log('=====================');

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    console.log('Creating NestJS application...');
    const app = await NestFactory.create(AppModule);

    // CORS configuration
    // Allows requests from local development and deployed frontend
    // FRONTEND_ORIGINS is a comma-separated list, e.g. https://www.vishnugandarapu.in
    const allowedOrigins = [
      'http://localhost:3000', // Local Next.js dev server
      process.env.VERCEL_URL, // Legacy single production frontend URL
      ...(process.env.FRONTEND_ORIGINS || '').split(','),
    ]
      .map((origin) => origin?.trim())
      .filter(Boolean);

    logger.log(`Allowed Origins: ${JSON.stringify(allowedOrigins)}`);

    app.enableCors({
      origin: allowedOrigins,
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      credentials: true,
    });

    // Listen on all interfaces (required for Docker)
    const port = 8080;
    await app.listen(port, '0.0.0.0');

    logger.log(`Application started successfully`);
    logger.log(`Running on: http://0.0.0.0:${port}`);
    logger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.log(`CORS enabled for: ${allowedOrigins.join(', ')}`);
  } catch (error) {
    logger.error(`Failed to start application`, error);
    process.exit(1);
  }
}

bootstrap();
