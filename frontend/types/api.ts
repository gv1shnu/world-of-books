/**
 * =============================================================================
 * API Type Definitions
 * =============================================================================
 * 
 * TypeScript interfaces for API responses. These types ensure type safety
 * when working with data from the backend.
 */

// -----------------------------------------------------------------------------
// Navigation Types
// -----------------------------------------------------------------------------

/** A category within a navigation section */
export interface Category {
    id: number;
    title: string;
    slug: string;
}

/** A top-level navigation section (e.g., "Books", "DVDs") */
export interface Navigation {
    id: number;
    title: string;
    slug: string;
    categories: Category[];
}

/** Response from GET /categories/navigations */
export type NavigationResponse = Navigation[];

// -----------------------------------------------------------------------------
// Product Types
// -----------------------------------------------------------------------------

/** A product/book from the database */
export interface Product {
    id: number;
    title: string;
    author?: string;
    price: number;
    image_url?: string;
    source_url: string;
    source_id: string;
    is_in_stock: boolean;
    specs?: Record<string, unknown>;
}

// -----------------------------------------------------------------------------
// Category Detail Types
// -----------------------------------------------------------------------------

/** Pagination metadata returned with category responses */
export interface Pagination {
    page: number;
    limit: number;
    totalProducts: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
}

/** Response from GET /categories/:slug */
export interface CategoryData {
    id: number;
    title: string;
    slug: string;
    product_count: number;
    last_scraped_at?: string;
    products: Product[];
    pagination?: Pagination;
}

// -----------------------------------------------------------------------------
// Scraping Progress Types
// -----------------------------------------------------------------------------

/** Response from GET /categories/:slug/progress */
export interface ScrapeProgress {
    active: boolean;
    productsCount: number;
    currentPage?: number;
    totalPages?: number;
}

// -----------------------------------------------------------------------------
// Product Detail Types
// -----------------------------------------------------------------------------

/** A customer review */
export interface Review {
    author: string;
    rating: number;
    text: string;
    date?: string;
}

/** Extended product with full details */
export interface ProductDetail extends Product {
    description?: string;
    category?: {
        title: string;
        slug: string;
    };
    reviews?: Review[];
    recommendations?: Product[];
}

/** Outcome of a title/author PDF search and actual page-count check. */
export interface PdfExtraction {
    status: 'matched' | 'no_match' | 'missing_metadata' | 'not_configured';
    message: string;
    query?: string;
    expectedPages?: number;
    tolerancePages?: number;
    pdfPages?: number;
    sourceUrl?: string;
    token?: string;
}
