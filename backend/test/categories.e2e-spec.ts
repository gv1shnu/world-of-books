/**
 * =============================================================================
 * Categories API E2E Tests
 * =============================================================================
 *
 * End-to-end tests for the categories REST API.
 * Tests the full request/response cycle without mocking.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Categories API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ---------------------------------------------------------------------------
  // GET /categories/navigations
  // ---------------------------------------------------------------------------
  describe('GET /categories/navigations', () => {
    it('should return navigation structure', () => {
      return request(app.getHttpServer())
        .get('/categories/navigations')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });
  });

  // ---------------------------------------------------------------------------
  // GET /categories/:slug
  // ---------------------------------------------------------------------------
  describe('GET /categories/:slug', () => {
    it('should return category not found for invalid slug', () => {
      return request(app.getHttpServer())
        .get('/categories/definitely-not-a-real-category-12345')
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toBe('Category not found.');
        });
    });
  });

  // ---------------------------------------------------------------------------
  // GET /categories/:slug/progress
  // ---------------------------------------------------------------------------
  describe('GET /categories/:slug/progress', () => {
    it('should return progress structure', () => {
      return request(app.getHttpServer())
        .get('/categories/fiction/progress')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('active');
          expect(res.body).toHaveProperty('productsCount');
        });
    });
  });

  // ---------------------------------------------------------------------------
  // GET /categories/admin/cache-stats
  // ---------------------------------------------------------------------------
  describe('GET /categories/admin/cache-stats', () => {
    it('should return cache statistics', () => {
      return request(app.getHttpServer())
        .get('/categories/admin/cache-stats')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('connected');
        });
    });
  });
});
