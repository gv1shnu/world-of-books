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
jest.mock('next/navigation', () => ({
    useParams: () => ({ slug: 'science-fiction' }),
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

        await waitFor(() => {
            expect(screen.getByText('Science Fiction')).toBeInTheDocument();
        });

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

        await waitFor(() => {
            expect(screen.getByText('Science Fiction')).toBeInTheDocument();
        });

        expect(screen.getByText(/Live scraping in progress/i)).toBeInTheDocument();
        expect(screen.getByText(/Scraping Page 1 of 5/i)).toBeInTheDocument();
    });

    it('should show error state when API fails', async () => {
        (api.get as jest.Mock).mockRejectedValue(new Error('API Error'));

        render(<CategoryPage />, { wrapper: createWrapper() });

        await waitFor(() => {
            expect(screen.getByText(/Could not load category/i)).toBeInTheDocument();
        });
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
                },
            ],
        };

        (api.get as jest.Mock).mockResolvedValue({ data: mockData });

        render(<CategoryPage />, { wrapper: createWrapper() });

        await waitFor(() => {
            const buyLinks = screen.getAllByRole('link', { name: /Buy Now/i });
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
                },
            ],
        };

        (api.get as jest.Mock).mockResolvedValue({ data: mockData });

        render(<CategoryPage />, { wrapper: createWrapper() });

        await waitFor(() => {
            expect(screen.getByText('£9.99')).toBeInTheDocument();
        });
    });
});
