/**
 * Category Page - /category?slug=<slug>
 *
 * Displays products in a category with live scraping progress. A mistyped
 * slug is corrected automatically when the intended category is clear
 * ("Showing results for ..."), otherwise the closest categories are offered
 * ("Did you mean ...").
 */

'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { api } from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CategoryData, NavigationResponse, ScrapeProgress } from '@/types/api';
import { suggestCategories } from '@/lib/suggest';
import Breadcrumbs from '@/components/Breadcrumbs';
import { SITE_NAME, siteUrl } from '@/lib/site';
import { useCanonical } from '@/lib/useCanonical';

// -----------------------------------------------------------------------------
// API Calls
// -----------------------------------------------------------------------------

/** Fetches a category with its products */
const getCategory = async (slug: string, page: number = 1, maxPages?: number) => {
  const params = new URLSearchParams();
  params.set('page', page.toString());
  if (maxPages) params.set('maxPages', maxPages.toString());
  const { data } = await api.get<CategoryData>(`/categories/${encodeURIComponent(slug)}?${params.toString()}`);
  return data;
};

/** Fetches real-time scraping progress */
const getScrapeProgress = async (slug: string) => {
  const { data } = await api.get<ScrapeProgress>(`/categories/${encodeURIComponent(slug)}/progress`);
  return data;
};

const getNavigations = async () => {
  const { data } = await api.get<NavigationResponse>('/categories/navigations');
  return data;
};

const isNotFound = (error: unknown) => isAxiosError(error) && error.response?.status === 404;
/** Older API versions answered unknown slugs with 200 and only a message. */
const isMissingCategory = (data?: CategoryData) => !!data && !data.id;

const categoryHref = (slug: string, from?: string) =>
  `/category?slug=${encodeURIComponent(slug)}${from ? `&from=${encodeURIComponent(from)}` : ''}`;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

// Query-string routing keeps the site exportable as static files (GitHub Pages).
export default function CategoryPage() {
  return (
    <Suspense fallback={null}>
      <CategoryContent />
    </Suspense>
  );
}

/** Shown when the slug matches no category. */
function CategoryNotFound({ slug }: { slug: string }) {
  const router = useRouter();
  const { data: navigations, isLoading } = useQuery({ queryKey: ['navigations'], queryFn: getNavigations });
  const categories = (navigations ?? []).flatMap((nav) => nav.categories);
  const { suggestions, confident } = suggestCategories(slug, categories);

  // Clear typo: go straight to the intended category, like a search engine.
  useEffect(() => {
    if (confident && suggestions[0]) {
      router.replace(categoryHref(suggestions[0].slug, slug));
    }
  }, [confident, suggestions, router, slug]);

  if (isLoading || (confident && suggestions[0])) {
    return <p className="min-h-screen p-10 text-center text-gray-700" role="status">Looking for the closest category...</p>;
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-xl rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Category not found</h1>
        <p className="mt-3 text-gray-700">
          There is no category called &ldquo;{slug || 'blank'}&rdquo;.
        </p>
        {suggestions.length > 0 && (
          <div className="mt-6">
            <p className="font-medium text-gray-900">Did you mean:</p>
            <ul className="mt-2 space-y-2">
              {suggestions.map((cat) => (
                <li key={cat.slug}>
                  <Link
                    href={categoryHref(cat.slug)}
                    className="inline-block px-2 py-1 font-semibold text-emerald-800 underline underline-offset-2 hover:text-emerald-900"
                  >
                    {cat.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        <Link
          href="/"
          className="mt-8 inline-block rounded-lg bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800"
        >
          Browse all categories
        </Link>
      </div>
    </div>
  );
}

function CategoryContent() {
  const searchParams = useSearchParams();
  const slug = searchParams.get('slug') ?? '';
  const correctedFrom = searchParams.get('from');
  const [maxPages, setMaxPages] = useState<number>(3); // Default 3 pages = ~120 products
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Whether a background scrape is running, read by the category poller
  const scrapingRef = useRef(false);

  // Fetch category data with pagination
  const { data: category, isLoading, error } = useQuery({
    queryKey: ['category', slug, currentPage, maxPages],
    queryFn: () => getCategory(slug, currentPage, maxPages),
    enabled: !!slug,
    retry: (count, err) => !isNotFound(err) && count < 1,
    refetchInterval: (query) => {
      if (query.state.error || isMissingCategory(query.state.data)) return false;
      // Poll every second while books are still arriving
      return !query.state.data?.products?.length || scrapingRef.current ? 1000 : false;
    },
  });

  // Poll scrape progress while the category is still empty or being scraped
  const { data: progress } = useQuery({
    queryKey: ['progress', slug],
    queryFn: () => getScrapeProgress(slug),
    enabled: !!category,
    refetchInterval: (query) =>
      query.state.data?.active || !category?.products?.length ? 1000 : false,
  });

  useEffect(() => {
    scrapingRef.current = !!progress?.active;
  }, [progress?.active]);

  useCanonical(category?.id ? siteUrl(`category/?slug=${encodeURIComponent(category.slug)}`) : null);

  useEffect(() => {
    if (category?.title) document.title = `${category.title} | ${SITE_NAME}`;
  }, [category?.title]);

  if (!slug || isNotFound(error) || isMissingCategory(category)) {
    return <CategoryNotFound slug={slug} />;
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center flex-col gap-4" role="status">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" aria-hidden="true"></div>
        <p className="text-gray-700">Fetching books from the shelves...</p>
      </div>
    );
  }

  // Error state
  if (error || !category) {
    return (
      <div className="p-10 text-center" role="alert">
        <p className="text-red-800">Could not load this category. Please try again in a minute.</p>
        <Link href="/" className="mt-4 inline-block px-3 py-2 font-semibold text-emerald-800 underline">
          Back to all categories
        </Link>
      </div>
    );
  }

  const isScraping = progress?.active;
  const showProgressBar = isScraping || (!category.products?.length && progress?.totalPages);

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: category.title }]} />

      {correctedFrom && (
        <p className="mb-6 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-gray-800" role="status">
          Showing results for <strong>{category.title}</strong>. No category matched &ldquo;{correctedFrom}&rdquo;.
        </p>
      )}

      {/* Category Header */}
      <div className="mb-8">
        <div className="flex justify-between items-start flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{category.title}</h1>
            <p className="text-gray-700 mt-2" aria-live="polite">
              {showProgressBar
                ? 'Live scraping in progress...'
                : `Found ${category.products?.length || 0} books`}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Max Pages Selector */}
            <div className="flex items-center gap-2">
              <label htmlFor="maxPages" className="text-sm text-gray-700">
                Scrape depth:
              </label>
              <select
                id="maxPages"
                value={maxPages}
                onChange={(e) => setMaxPages(Number(e.target.value))}
                className="px-3 py-2 border border-gray-400 rounded-lg text-sm bg-white text-gray-900"
                disabled={isScraping}
              >
                <option value={3}>3 pages (~120 books)</option>
                <option value={5}>5 pages (~200 books)</option>
                <option value={7}>7 pages (~280 books)</option>
                <option value={10}>10 pages (~400 books)</option>
              </select>
            </div>
            {isScraping && (
              <span className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-900 rounded-full text-xs font-bold">
                <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" aria-hidden="true"></span>
                LIVE UPDATES
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Progress Bar Area */}
      {showProgressBar && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-100 mb-8" role="status">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-blue-900 flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Live Scraping in Progress
            </span>
            <span className="text-xs bg-blue-700 text-white px-2 py-1 rounded-full font-bold">
              Page {progress?.currentPage || 1} of {progress?.totalPages || '?'}
            </span>
          </div>

          {/* Progress Track */}
          <div className="h-3 bg-blue-200 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-blue-700 transition-all duration-500 ease-out"
              style={{
                width: `${((progress?.currentPage || 0) / (progress?.totalPages || 1)) * 100}%`
              }}
            ></div>
          </div>

          <div className="flex justify-between text-xs text-blue-900">
            <span>{category.products?.length || 0} books loaded</span>
            <span>~{Math.ceil(((progress?.totalPages || 1) - (progress?.currentPage || 0)) * 2)} seconds remaining</span>
          </div>
        </div>
      )}

      {/* Product Grid - Shows products as they're found */}
      {category.products?.length > 0 && (
        <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {category.products.map((book, index) => {
            const href = `/product?book=${encodeURIComponent(book.source_id)}`;
            return (
              <li key={book.id} className="bg-white group rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow duration-300 flex flex-col animate-fade-in">
                {/* Clickable Product Area */}
                <Link href={href} className="flex flex-col flex-grow">
                  {/* Product Image */}
                  <div className="relative h-64 w-full bg-gray-100">
                    {book.image_url ? (
                      <img
                        src={book.image_url}
                        alt=""
                        width={192}
                        height={256}
                        loading={index < 5 ? 'eager' : 'lazy'}
                        decoding="async"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-600">No image</div>
                    )}
                    {/* Price Badge */}
                    <div className="absolute top-2 right-2 bg-white/95 px-2 py-1 rounded text-xs font-bold text-gray-900 shadow-sm">
                      £{book.price.toFixed(2)}
                    </div>
                  </div>

                  {/* Product Details */}
                  <div className="p-4 flex flex-col flex-grow">
                    <h2 className="font-bold text-gray-900 text-sm line-clamp-2 mb-1">{book.title}</h2>
                    {book.author && <p className="text-xs text-gray-700 mb-3">{book.author}</p>}
                  </div>
                </Link>

                {/* Action Buttons */}
                <div className="px-4 pb-4 flex gap-2">
                  <Link
                    href={href}
                    aria-label={`Details: ${book.title}`}
                    className="flex-1 text-center py-2 bg-gray-100 text-gray-800 text-sm font-medium rounded hover:bg-gray-200 transition-colors"
                  >
                    Details
                  </Link>
                  <a
                    href={book.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Buy ${book.title} on World of Books (opens in a new tab)`}
                    className="flex-1 text-center py-2 bg-emerald-50 text-emerald-900 text-sm font-semibold rounded hover:bg-emerald-700 hover:text-white transition-colors"
                  >
                    Buy now
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Waiting for the first scrape to start */}
      {!category.products?.length && !showProgressBar && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-10 rounded-xl border border-blue-100 text-center" role="status">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" aria-hidden="true"></div>
          <h2 className="font-semibold text-blue-900 mb-2">Fetching books...</h2>
          <p className="text-blue-900 text-sm">This page will update automatically, usually within a few seconds.</p>
        </div>
      )}

      {/* Pagination Controls */}
      {category.pagination && category.pagination.totalPages > 1 && (() => {
        const pagination = category.pagination;
        return (
          <nav aria-label="Pagination" className="mt-8 flex flex-wrap justify-center items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={!pagination.hasPrev}
              className="px-4 py-2 bg-gray-100 text-gray-900 hover:bg-gray-200 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
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
                    aria-label={`Page ${pageNum}`}
                    aria-current={currentPage === pageNum ? 'page' : undefined}
                    className={`w-10 h-10 rounded-lg font-medium transition-colors ${currentPage === pageNum
                      ? 'bg-emerald-700 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
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
              className="px-4 py-2 bg-gray-100 text-gray-900 hover:bg-gray-200 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>

            <span className="ml-4 text-sm text-gray-700">
              Page {currentPage} of {pagination.totalPages}
            </span>
          </nav>
        );
      })()}

      {/* "More coming" indicator - shown while scraping AND we have some products */}
      {isScraping && category.products?.length > 0 && (
        <div className="mt-8 text-center" role="status">
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-blue-50 border border-blue-100 rounded-full">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" aria-hidden="true"></div>
            <span className="text-blue-900 text-sm font-medium">
              Loading more books... ({progress?.currentPage || 1} of {progress?.totalPages || '?'} pages)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
