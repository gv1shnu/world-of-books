/**
 * =============================================================================
 * Home Page Tests
 * =============================================================================
 * 
 * Tests for the main landing page component.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import HomePage from './page';

// Mock next/link
jest.mock('next/link', () => {
    return ({ children, href }: { children: React.ReactNode; href: string }) => (
        <a href={href}>{children}</a>
    );
});

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

describe('HomePage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should show loading state initially', () => {
        (api.get as jest.Mock).mockReturnValue(new Promise(() => { })); // Never resolves

        render(<HomePage />, { wrapper: createWrapper() });

        expect(screen.getByText('Loading the Library...')).toBeInTheDocument();
    });

    it('should render navigation sections after loading', async () => {
        const mockData = [
            {
                id: 1,
                title: 'Fiction',
                categories: [
                    { id: 1, title: 'Science Fiction', slug: 'science-fiction' },
                    { id: 2, title: 'Fantasy', slug: 'fantasy' },
                ],
            },
        ];

        (api.get as jest.Mock).mockResolvedValue({ data: mockData });

        render(<HomePage />, { wrapper: createWrapper() });

        await waitFor(() => {
            expect(screen.getByText('Fiction')).toBeInTheDocument();
        });

        expect(screen.getByText('Science Fiction')).toBeInTheDocument();
        expect(screen.getByText('Fantasy')).toBeInTheDocument();
    });

    it('should filter categories based on search term', async () => {
        const mockData = [
            {
                id: 1,
                title: 'Fiction',
                categories: [
                    { id: 1, title: 'Science Fiction', slug: 'science-fiction' },
                    { id: 2, title: 'Fantasy', slug: 'fantasy' },
                ],
            },
            {
                id: 2,
                title: 'Non-Fiction',
                categories: [
                    { id: 3, title: 'History', slug: 'history' },
                ],
            },
        ];

        (api.get as jest.Mock).mockResolvedValue({ data: mockData });

        render(<HomePage />, { wrapper: createWrapper() });

        // Wait for data to load
        await waitFor(() => {
            expect(screen.getByText('Fiction')).toBeInTheDocument();
        });

        // Type in search box
        const searchInput = screen.getByPlaceholderText(/Find a category/i);
        fireEvent.change(searchInput, { target: { value: 'fantasy' } });

        // Fantasy should still be visible, History should not
        await waitFor(() => {
            expect(screen.getByText('Fantasy')).toBeInTheDocument();
        });
    });

    it('should show no results message when search has no matches', async () => {
        const mockData = [
            {
                id: 1,
                title: 'Fiction',
                categories: [
                    { id: 1, title: 'Science Fiction', slug: 'science-fiction' },
                ],
            },
        ];

        (api.get as jest.Mock).mockResolvedValue({ data: mockData });

        render(<HomePage />, { wrapper: createWrapper() });

        await waitFor(() => {
            expect(screen.getByText('Fiction')).toBeInTheDocument();
        });

        // Search for something that doesn't exist
        const searchInput = screen.getByPlaceholderText(/Find a category/i);
        fireEvent.change(searchInput, { target: { value: 'xyz123nonsense' } });

        await waitFor(() => {
            expect(screen.getByText(/No categories found matching/i)).toBeInTheDocument();
        });
    });

    it('should have clickable category links', async () => {
        const mockData = [
            {
                id: 1,
                title: 'Fiction',
                categories: [
                    { id: 1, title: 'Science Fiction', slug: 'science-fiction' },
                ],
            },
        ];

        (api.get as jest.Mock).mockResolvedValue({ data: mockData });

        render(<HomePage />, { wrapper: createWrapper() });

        await waitFor(() => {
            const link = screen.getByRole('link', { name: /Science Fiction/i });
            expect(link).toHaveAttribute('href', '/category/science-fiction');
        });
    });
});
