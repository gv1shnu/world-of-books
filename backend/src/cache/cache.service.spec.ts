/**
 * =============================================================================
 * Cache Service Unit Tests
 * =============================================================================
 *
 * Tests for the Redis caching layer. Uses mocked ioredis to avoid
 * requiring a real Redis instance during testing.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from './cache.service';

// Mock Redis client methods
const mockRedisClient = {
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(),
  info: jest.fn(),
  dbsize: jest.fn(),
  connect: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
};

// Mock ioredis - must be before imports
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedisClient);
});

describe('CacheService', () => {
  let service: CacheService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [CacheService],
    }).compile();

    service = module.get<CacheService>(CacheService);

    // Manually set up the service state after construction
    // The client is created in onModuleInit, so we need to inject it
    (service as any).client = mockRedisClient;
    (service as any).isConnected = true;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // get() tests
  // ---------------------------------------------------------------------------
  describe('get()', () => {
    it('should return cached value when found', async () => {
      const testData = { name: 'Test Book', price: 9.99 };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(testData));

      const result = await service.get('test-key');

      expect(result).toEqual(testData);
      expect(mockRedisClient.get).toHaveBeenCalledWith('test-key');
    });

    it('should return null when key not found', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await service.get('non-existent-key');

      expect(result).toBeNull();
    });

    it('should return null when disconnected', async () => {
      (service as any).isConnected = false;

      const result = await service.get('test-key');

      expect(result).toBeNull();
      expect(mockRedisClient.get).not.toHaveBeenCalled();
    });

    it('should return null on Redis error', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));

      const result = await service.get('test-key');

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // set() tests
  // ---------------------------------------------------------------------------
  describe('set()', () => {
    it('should store value without TTL', async () => {
      const testData = { name: 'Test' };
      mockRedisClient.set.mockResolvedValue('OK');

      await service.set('test-key', testData);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify(testData),
      );
    });

    it('should store value with TTL using setex', async () => {
      const testData = { name: 'Test' };
      mockRedisClient.setex.mockResolvedValue('OK');

      await service.set('test-key', testData, { ttl: 3600 });

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'test-key',
        3600,
        JSON.stringify(testData),
      );
    });

    it('should not store when disconnected', async () => {
      (service as any).isConnected = false;

      await service.set('test-key', { data: 'test' });

      expect(mockRedisClient.set).not.toHaveBeenCalled();
      expect(mockRedisClient.setex).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // delete() tests
  // ---------------------------------------------------------------------------
  describe('delete()', () => {
    it('should delete a key', async () => {
      mockRedisClient.del.mockResolvedValue(1);

      await service.delete('test-key');

      expect(mockRedisClient.del).toHaveBeenCalledWith('test-key');
    });

    it('should not delete when disconnected', async () => {
      (service as any).isConnected = false;

      await service.delete('test-key');

      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // deletePattern() tests
  // ---------------------------------------------------------------------------
  describe('deletePattern()', () => {
    it('should delete all keys matching pattern', async () => {
      mockRedisClient.keys.mockResolvedValue(['cat:1', 'cat:2', 'cat:3']);
      mockRedisClient.del.mockResolvedValue(3);

      await service.deletePattern('cat:*');

      expect(mockRedisClient.keys).toHaveBeenCalledWith('cat:*');
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        'cat:1',
        'cat:2',
        'cat:3',
      );
    });

    it('should not call del when no keys match', async () => {
      mockRedisClient.keys.mockResolvedValue([]);

      await service.deletePattern('nonexistent:*');

      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // getOrSet() tests
  // ---------------------------------------------------------------------------
  describe('getOrSet()', () => {
    it('should return cached value on cache hit', async () => {
      const cachedData = { id: 1, name: 'Cached' };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedData));

      const factory = jest.fn().mockResolvedValue({ id: 2, name: 'Fresh' });

      const result = await service.getOrSet('test-key', factory);

      expect(result).toEqual(cachedData);
      expect(factory).not.toHaveBeenCalled();
    });

    it('should call factory and cache result on cache miss', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.setex.mockResolvedValue('OK');
      const freshData = { id: 2, name: 'Fresh' };
      const factory = jest.fn().mockResolvedValue(freshData);

      const result = await service.getOrSet('test-key', factory, { ttl: 300 });

      expect(result).toEqual(freshData);
      expect(factory).toHaveBeenCalled();
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'test-key',
        300,
        JSON.stringify(freshData),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // isAvailable() tests
  // ---------------------------------------------------------------------------
  describe('isAvailable()', () => {
    it('should return true when connected', () => {
      (service as any).isConnected = true;
      expect(service.isAvailable()).toBe(true);
    });

    it('should return false when disconnected', () => {
      (service as any).isConnected = false;
      expect(service.isAvailable()).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // getStats() tests
  // ---------------------------------------------------------------------------
  describe('getStats()', () => {
    it('should return stats when connected', async () => {
      mockRedisClient.info.mockResolvedValue('used_memory_human:1.5M\n');
      mockRedisClient.dbsize.mockResolvedValue(42);

      const stats = await service.getStats();

      expect(stats).toEqual({
        connected: true,
        keys: 42,
        memory: '1.5M',
      });
    });

    it('should return connected: false when disconnected', async () => {
      (service as any).isConnected = false;

      const stats = await service.getStats();

      expect(stats).toEqual({ connected: false });
    });
  });

  // ---------------------------------------------------------------------------
  // TTL Constants tests
  // ---------------------------------------------------------------------------
  describe('TTL constants', () => {
    it('should have correct TTL values', () => {
      expect(CacheService.TTL.NAVIGATION).toBe(3600);
      expect(CacheService.TTL.CATEGORY).toBe(300);
      expect(CacheService.TTL.PRODUCTS).toBe(180);
      expect(CacheService.TTL.SEARCH).toBe(120);
    });
  });
});
