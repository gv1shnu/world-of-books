/**
 * =============================================================================
 * API Client Tests
 * =============================================================================
 * 
 * Tests for the Axios API client configuration.
 */

import { api, fetcher } from './api';

// Mock axios
jest.mock('axios', () => ({
    create: jest.fn(() => ({
        get: jest.fn(),
        defaults: {
            baseURL: 'http://localhost:8080',
            headers: { 'Content-Type': 'application/json' },
        },
    })),
}));

describe('API Client', () => {
    describe('api instance', () => {
        it('should be defined', () => {
            expect(api).toBeDefined();
        });

        it('should have correct default headers', () => {
            expect(api.defaults.headers).toEqual(
                expect.objectContaining({
                    'Content-Type': 'application/json',
                })
            );
        });
    });

    describe('fetcher()', () => {
        it('should be a function', () => {
            expect(typeof fetcher).toBe('function');
        });

        it('should call api.get with the provided URL', async () => {
            const mockData = { categories: [] };
            (api.get as jest.Mock).mockResolvedValue({ data: mockData });

            const result = await fetcher('/categories/navigations');

            expect(api.get).toHaveBeenCalledWith('/categories/navigations');
            expect(result).toEqual(mockData);
        });
    });
});
