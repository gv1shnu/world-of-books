/**
 * Category Page - /category/[slug]
 * 
 * Displays products in a category with live scraping progress.
 */

'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useParams } from 'next/navigation';
import { CategoryData, ScrapeProgress } from '@/types/api';

// -----------------------------------------------------------------------------
// Type Definitions
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// API Calls
// -----------------------------------------------------------------------------

/** Fetches a category with its products */
const getCategory = async (slug: string, page: number = 1, maxPages?: number) => {
  const params = new URLSearchParams();
  params.set('page', page.toString());
  if (maxPages) params.set('maxPages', maxPages.toString());
  const { data } = await api.get<CategoryData>(`/categories/${slug}?${params.toString()}`);
  return data;
};

/** Fetches real-time scraping progress */
const getScrapeProgress = async (slug: string) => {
  const { data } = await api.get<ScrapeProgress>(`/categories/${slug}/progress`);
  return data;
};

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function CategoryPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [maxPages, setMaxPages] = useState<number>(3); // Default 3 pages = ~120 products
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Poll for progress updates every second
  const { data: progress } = useQuery({
    queryKey: ['progress', slug],
    queryFn: () => getScrapeProgress(slug),
    refetchInterval: 1000,
  });

  // Fetch category data with pagination
  const { data: category, isLoading, error } = useQuery({
    queryKey: ['category', slug, currentPage, maxPages],
    queryFn: () => getCategory(slug, currentPage, maxPages),
    refetchInterval: (query) => {
      const isScraping = progress?.active;
      const isEmpty = !query.state.data?.products?.length;
      // Poll every second during scraping for faster live updates
      return (isScraping || isEmpty) ? 1000 : false;
    },
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-500 animate-pulse">Fetching books from the shelves...</p>
      </div>
    );
  }

  // Error state
  if (error || !category) {
    return <div className="p-10 text-center text-red-500">Could not load category.</div>;
  }

  const isScraping = progress?.active;
  const showProgressBar = isScraping || (!category.products?.length && progress?.totalPages);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Category Header */}
      <header className="mb-8">
        <div className="flex justify-between items-start flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{category.title}</h1>
            <p className="text-gray-500 mt-2">
              {showProgressBar
                ? "Live scraping in progress..."
                : `Found ${category.products?.length || 0} books`}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Max Pages Selector */}
            <div className="flex items-center gap-2">
              <label htmlFor="maxPages" className="text-sm text-gray-600">
                Scrape depth:
              </label>
              <select
                id="maxPages"
                value={maxPages}
                onChange={(e) => setMaxPages(Number(e.target.value))}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isScraping}
              >
                <option value={3}>3 pages (~120 books)</option>
                <option value={5}>5 pages (~200 books)</option>
                <option value={7}>7 pages (~280 books)</option>
                <option value={10}>10 pages (~400 books)</option>
              </select>
            </div>
            {isScraping && (
              <span className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold animate-pulse">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                LIVE UPDATES
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Progress Bar Area */}
      {showProgressBar && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-100 mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-blue-800 flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Live Scraping in Progress
            </span>
            <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded-full font-bold">
              Page {progress?.currentPage || 1} of {progress?.totalPages || '?'}
            </span>
          </div>

          {/* Progress Track */}
          <div className="h-3 bg-blue-200 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500 ease-out"
              style={{
                width: `${((progress?.currentPage || 0) / (progress?.totalPages || 1)) * 100}%`
              }}
            ></div>
          </div>

          <div className="flex justify-between text-xs text-blue-600">
            <span>{category.products?.length || 0} books loaded</span>
            <span>~{Math.ceil(((progress?.totalPages || 1) - (progress?.currentPage || 0)) * 2)} seconds remaining</span>
          </div>
        </div>
      )}

      {/* Product Grid - Shows products as they're found */}
      {category.products?.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {category.products.map((book) => (
            <div key={book.id} className="bg-white group rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col animate-fade-in">
              {/* Product Image */}
              <div className="relative h-64 w-full bg-gray-100">
                {book.image_url ? (
                  <img
                    src={book.image_url}
                    alt={book.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">No Image</div>
                )}
                {/* Price Badge */}
                <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded text-xs font-bold shadow-sm">
                  £{book.price}
                </div>
              </div>

              {/* Product Details */}
              <div className="p-4 flex flex-col flex-grow">
                <h3 className="font-bold text-gray-800 text-sm line-clamp-2 mb-1">{book.title}</h3>
                <p className="text-xs text-gray-500 mb-3">{book.author}</p>
                <a
                  href={book.source_url}
                  target="_blank"
                  className="mt-auto block text-center w-full py-2 bg-emerald-50 text-emerald-700 text-sm font-semibold rounded hover:bg-emerald-600 hover:text-white transition-colors"
                >
                  Buy Now
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Loading State - shown when scraping and no products yet */}
      {!category.products?.length && !showProgressBar && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-10 rounded-xl border border-blue-100 text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h3 className="font-semibold text-blue-800 mb-2">Preparing to Scrape...</h3>
          <p className="text-blue-600 text-sm">Starting live data extraction. This page will update automatically.</p>
          <p className="text-xs text-blue-400 mt-3">Estimated time: 30-60 seconds per page</p>
        </div>
      )}

      {/* Pagination Controls */}
      {category.pagination && category.pagination.totalPages > 1 && (() => {
        const pagination = category.pagination;
        return (
          <div className="mt-8 flex justify-center items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={!pagination.hasPrev}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              ← Previous
            </button>

            <div className="flex gap-1">
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                let pageNum: number;
                const total = pagination.totalPages;
                const current = currentPage;

                if (total <= 5) {
                  pageNum = i + 1;
                } else if (current <= 3) {
                  pageNum = i + 1;
                } else if (current >= total - 2) {
                  pageNum = total - 4 + i;
                } else {
                  pageNum = current - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-10 h-10 rounded-lg font-medium transition-colors ${currentPage === pageNum
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
              disabled={!pagination.hasNext}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>

            <span className="ml-4 text-sm text-gray-500">
              Page {currentPage} of {pagination.totalPages}
            </span>
          </div>
        );
      })()}

      {/* "More coming" indicator - shown while scraping AND we have some products */}
      {isScraping && category.products?.length > 0 && (
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-blue-50 border border-blue-100 rounded-full">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-blue-700 text-sm font-medium">
              Loading more books... ({progress?.currentPage || 1} of {progress?.totalPages || '?'} pages)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}