/**
 * =============================================================================
 * Category Page Tests
 * =============================================================================
 * 
 * Tests for the category detail page component.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CategoryPage from './page';

// Mock next/navigation
let mockSearch = 'slug=science-fiction';
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
    useSearchParams: () => new URLSearchParams(mockSearch),
    useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}));

// Mock the API module
jest.mock('@/lib/api', () => ({
    api: {
        get: jest.fn(),
    },
}));

import { api } from '@/lib/api';

// Helper to wrap component with providers
const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    });
    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
};

describe('CategoryPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should show loading state initially', () => {
        (api.get as jest.Mock).mockReturnValue(new Promise(() => { })); // Never resolves

        render(<CategoryPage />, { wrapper: createWrapper() });

        expect(screen.getByText(/Fetching books/i)).toBeInTheDocument();
    });

    it('should render category title and products after loading', async () => {
        const mockData = {
            id: 1,
            title: 'Science Fiction',
            products: [
                {
                    id: 1,
                    title: 'Dune',
                    author: 'Frank Herbert',
                    price: 9.99,
                    image_url: 'https://example.com/dune.jpg',
                    source_url: 'https://worldofbooks.com/dune',
                    source_id: 'dune-book-frank-herbert',
                },
                {
                    id: 2,
                    title: '1984',
                    author: 'George Orwell',
                    price: 7.99,
                    image_url: 'https://example.com/1984.jpg',
                    source_url: 'https://worldofbooks.com/1984',
                },
            ],
        };

        (api.get as jest.Mock).mockResolvedValue({ data: mockData });

        render(<CategoryPage />, { wrapper: createWrapper() });

        expect(await screen.findByRole('heading', { level: 1, name: 'Science Fiction' })).toBeInTheDocument();

        expect(screen.getByText('Dune')).toBeInTheDocument();
        expect(screen.getByText('Frank Herbert')).toBeInTheDocument();
        expect(screen.getByText('1984')).toBeInTheDocument();
        expect(screen.getByText('Found 2 books')).toBeInTheDocument();
    });

    it('should show scraping in progress message when no products', async () => {
        const mockCategory = {
            id: 1,
            title: 'Science Fiction',
            products: [],
        };
        const mockProgress = {
            active: true,
            currentPage: 1,
            totalPages: 5,
            productsCount: 0
        };

        (api.get as jest.Mock).mockImplementation((url) => {
            if (url.includes('/progress')) return Promise.resolve({ data: mockProgress });
            return Promise.resolve({ data: mockCategory });
        });

        render(<CategoryPage />, { wrapper: createWrapper() });

        expect(await screen.findByRole('heading', { level: 1, name: 'Science Fiction' })).toBeInTheDocument();

        expect(await screen.findByText(/^Live scraping in progress$/i)).toBeInTheDocument();
        expect(screen.getByText(/^Page 1 of 5$/i)).toBeInTheDocument();
    });

    it('should show error state when API fails', async () => {
        (api.get as jest.Mock).mockRejectedValue(new Error('API Error'));

        render(<CategoryPage />, { wrapper: createWrapper() });

        // The page retries once before giving up.
        expect(
            await screen.findByText(/Could not load this category/i, undefined, { timeout: 5000 }),
        ).toBeInTheDocument();
    });

    it('should render product cards with buy links', async () => {
        const mockData = {
            id: 1,
            title: 'Science Fiction',
            products: [
                {
                    id: 1,
                    title: 'Dune',
                    author: 'Frank Herbert',
                    price: 9.99,
                    image_url: 'https://example.com/dune.jpg',
                    source_url: 'https://worldofbooks.com/dune',
                    source_id: 'dune-book-frank-herbert',
                },
            ],
        };

        (api.get as jest.Mock).mockResolvedValue({ data: mockData });

        render(<CategoryPage />, { wrapper: createWrapper() });

        await waitFor(() => {
            const buyLinks = screen.getAllByRole('link', { name: /Buy Dune/i });
            expect(buyLinks[0]).toHaveAttribute('href', 'https://worldofbooks.com/dune');
            expect(buyLinks[0]).toHaveAttribute('target', '_blank');
        });
    });

    it('should display price badge on product cards', async () => {
        const mockData = {
            id: 1,
            title: 'Science Fiction',
            products: [
                {
                    id: 1,
                    title: 'Dune',
                    author: 'Frank Herbert',
                    price: 9.99,
                    image_url: 'https://example.com/dune.jpg',
                    source_url: 'https://worldofbooks.com/dune',
                    source_id: 'dune-book-frank-herbert',
                },
            ],
        };

        (api.get as jest.Mock).mockResolvedValue({ data: mockData });

        render(<CategoryPage />, { wrapper: createWrapper() });

        await waitFor(() => {
            expect(screen.getByText('£9.99')).toBeInTheDocument();
        });
    });

    it('should link books by their stable handle', async () => {
        (api.get as jest.Mock).mockResolvedValue({
            data: {
                id: 1,
                title: 'Science Fiction',
                products: [
                    { id: 1, title: 'Dune', price: 9.99, source_url: 'https://worldofbooks.com/dune', source_id: 'dune-book-frank-herbert' },
                ],
            },
        });

        render(<CategoryPage />, { wrapper: createWrapper() });

        const details = await screen.findByRole('link', { name: 'Details: Dune' });
        expect(details).toHaveAttribute('href', '/product?book=dune-book-frank-herbert');
    });

    describe('unknown category', () => {
        const notFound = Object.assign(new Error('Not Found'), {
            isAxiosError: true,
            response: { status: 404 },
        });
        const navigations = [
            {
                id: 1,
                title: 'Fiction',
                categories: [
                    { id: 1, title: 'Crime & Mystery', slug: 'crime-and-mystery-books' },
                    { id: 2, title: 'Horror', slug: 'horror-books' },
                    { id: 3, title: 'History', slug: 'history-books' },
                ],
            },
        ];
        const mockApi = () =>
            (api.get as jest.Mock).mockImplementation((url: string) =>
                url === '/categories/navigations'
                    ? Promise.resolve({ data: navigations })
                    : Promise.reject(notFound),
            );

        afterEach(() => {
            mockSearch = 'slug=science-fiction';
        });

        it('jumps straight to the intended category for a clear typo', async () => {
            mockSearch = 'slug=crime-and-mystrey-books';
            mockApi();

            render(<CategoryPage />, { wrapper: createWrapper() });

            await waitFor(() =>
                expect(mockReplace).toHaveBeenCalledWith(
                    '/category?slug=crime-and-mystery-books&from=crime-and-mystrey-books',
                ),
            );
        });

        it('offers "Did you mean" links when the intended category is unclear', async () => {
            mockSearch = 'slug=hor';
            mockApi();

            render(<CategoryPage />, { wrapper: createWrapper() });

            expect(await screen.findByRole('heading', { name: 'Category not found' })).toBeInTheDocument();
            expect(screen.getByText('Did you mean:')).toBeInTheDocument();
            expect(screen.getByRole('link', { name: 'Horror' })).toHaveAttribute('href', '/category?slug=horror-books');
            expect(mockReplace).not.toHaveBeenCalled();
        });
    });
});
