/**
 * Redis Cache Service
 * 
 * Optional caching layer - app works without Redis, just slower.
 * Handles connection retries and TTL-based expiration.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
}

@Injectable()
export class CacheService implements OnModuleInit {
  private readonly logger = new Logger(CacheService.name);
  private client: Redis;
  private isConnected = false;

  // -----------------------------------------------------------------------------
  // Default TTLs - how long different types of data should stay cached
  // -----------------------------------------------------------------------------
  static readonly TTL = {
    NAVIGATION: 3600, // 1 hour - navigation menu rarely changes
    CATEGORY: 300, // 5 minutes - product lists update more often
    PRODUCTS: 180, // 3 minutes - prices/availability change frequently
    SEARCH: 120, // 2 minutes - search results should be fresh
  };

  // -----------------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------------

  async onModuleInit() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        // Give up after 3 attempts
        if (times > 3) {
          return null;
        }
        // Wait progressively longer between retries: 200ms, 400ms, 600ms
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true, // Don't connect until we actually need to
    });

    // Track connection state
    this.client.on('connect', () => {
      this.isConnected = true;
      // Silent connect - no log spam
    });

    this.client.on('error', () => {
      this.isConnected = false;
    });

    try {
      await this.client.connect();
    } catch {
      // Redis not available - silent fail
    }
  }

  // -----------------------------------------------------------------------------
  // Core Cache Operations
  // -----------------------------------------------------------------------------

  /**
   * Retrieves a cached value by key.
   * Returns null if not found or if Redis is unavailable.
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected) return null;

    try {
      const data = await this.client.get(key);
      if (data) {
        return JSON.parse(data) as T;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Stores a value in the cache.
   * Optionally set a TTL (time-to-live) in seconds.
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    if (!this.isConnected) return;

    try {
      const serialized = JSON.stringify(value);
      if (options?.ttl) {
        await this.client.setex(key, options.ttl, serialized);
      } else {
        await this.client.set(key, serialized);
      }
    } catch {
      // Silent fail
    }
  }

  /**
   * Removes a specific key from the cache.
   */
  async delete(key: string): Promise<void> {
    if (!this.isConnected) return;

    try {
      await this.client.del(key);
    } catch {
      // Silent fail
    }
  }

  /**
   * Removes all keys matching a glob pattern.
   * Useful for invalidating all cached items of a certain type.
   *
   * Example: cache.deletePattern('cat:*') removes all category caches
   */
  async deletePattern(pattern: string): Promise<void> {
    if (!this.isConnected) return;

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch {
      // Silent fail
    }
  }

  // -----------------------------------------------------------------------------
  // Higher-Level Helpers
  // -----------------------------------------------------------------------------

  /**
   * Cache-aside pattern: try cache first, if miss, call factory and cache result.
   *
   * This is the most common caching pattern. It ensures:
   *   1. Fast responses when data is cached
   *   2. Automatic population on cache miss
   *   3. Configurable expiration via TTL
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T> {
    // Try cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Cache miss - get fresh data and cache it
    const value = await factory();
    await this.set(key, value, options);
    return value;
  }

  /**
   * Quick check if Redis is currently connected.
   */
  isAvailable(): boolean {
    return this.isConnected;
  }

  /**
   * Returns cache statistics for monitoring dashboards.
   */
  async getStats(): Promise<{
    connected: boolean;
    keys?: number;
    memory?: string;
  }> {
    if (!this.isConnected) {
      return { connected: false };
    }

    try {
      const info = await this.client.info('memory');
      const keys = await this.client.dbsize();
      const memoryMatch = info.match(/used_memory_human:(\S+)/);

      return {
        connected: true,
        keys,
        memory: memoryMatch ? memoryMatch[1] : 'unknown',
      };
    } catch {
      return { connected: this.isConnected };
    }
  }

  // -------------------------------------------------------------------------
  // Scrape Progress Tracking
  // -------------------------------------------------------------------------

  /**
   * Stores real-time scraping progress for a category.
   * Uses a short TTL (60s) to auto-cleanup stale progress.
   */
  async setScrapeProgress(
    slug: string,
    currentPage: number,
    totalPages: number,
  ): Promise<void> {
    if (!this.isConnected) return;

    const key = `scrape-progress:${slug}`;
    const data = JSON.stringify({
      currentPage,
      totalPages,
      timestamp: Date.now(),
    });

    try {
      await this.client.setex(key, 60, data); // 60 second TTL
    } catch {
      // Silent fail
    }
  }

  /**
   * Retrieves current scraping progress for a category.
   * Returns null if no active scrape or Redis is unavailable.
   */
  async getScrapeProgress(
    slug: string,
  ): Promise<{ currentPage: number; totalPages: number } | null> {
    if (!this.isConnected) return null;

    const key = `scrape-progress:${slug}`;

    try {
      const data = await this.client.get(key);
      if (data) {
        const parsed = JSON.parse(data);
        return {
          currentPage: parsed.currentPage,
          totalPages: parsed.totalPages,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Clears scraping progress when complete.
   */
  async clearScrapeProgress(slug: string): Promise<void> {
    await this.delete(`scrape-progress:${slug}`);
  }
}
