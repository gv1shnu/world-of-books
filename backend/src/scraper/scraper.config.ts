/**
 * Scraper Configuration
 * 
 * Tweak these values for different environments or rate limiting.
 */

// -----------------------------------------------------------------------------
// Core Scraper Settings
// -----------------------------------------------------------------------------

export const SCRAPER_CONFIG = {
  // Pagination
  // Set to 0 for unlimited (scrape all pages), or a positive number to cap
  maxPagesPerCategory: 3, // Default: 3 pages = ~120 products per category

  // Request timing - adds random delay between page requests to avoid detection
  // The actual delay is randomly chosen between min and max
  requestDelayMs: { min: 1000, max: 2000 },

  // Timeouts
  requestTimeoutSecs: 30, // Max wait time for a page to load
  navigationTimeoutSecs: 45, // Longer timeout for initial navigation scrape

  // Retry behavior - exponential backoff: 1s, 2s, 4s
  maxRetries: 3,
  retryDelayMs: 1000,

  // Concurrency - how many pages to scrape in parallel
  // Keep this low to avoid getting blocked
  maxConcurrency: 3,
  maxRequestsPerCrawl: 100,

  // Browser settings
  headless: true,
  viewport: { width: 1920, height: 1080 },

  // User agent string to identify as a real browser
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

// -----------------------------------------------------------------------------
// CSS Selectors
// -----------------------------------------------------------------------------
// Multiple selectors per element type for robustness. If the site updates
// their HTML structure, having fallbacks means the scraper keeps working.

export const SELECTORS = {
  // Category page - product cards (actual live WoB structure as of Jan 2026)
  productCard: [
    '.main-product-card',         // Primary selector
    '.product-card-wrapper',
    '.ais-InfiniteHits-item',     // Algolia infinite hits
    'li.ais-InfiniteHits-item',
    '.card-wrapper',
  ],
  productTitle: [
    '.card__heading a',           // Primary: h3.card__heading > a
    'a.product-card',             // Alternative: link with product-card class
    'h3.card__heading a',
    'h3 a',
  ],
  productAuthor: [
    'p.author',                   // Primary: paragraph with author class
    '.author',
    '.card__information .author',
  ],
  productPrice: [
    '.price-item',                // Primary: div with price-item class
    '.price .price-item',
    '.price',
  ],
  productImage: [
    '.card__inner img',           // Primary: image inside card__inner
    '.card__media img',
    '.card-wrapper img',
    'img',
  ],
  productId: ['data-product-id'],

  // Pagination controls
  pagination: ['#custom-load-more', '.ais-InfiniteHits-loadMore', '.pagination'],
  nextPage: ['#custom-load-more', 'button.ais-InfiniteHits-loadMore', '.pagination__item--next'],
  pageNumber: ['.pagination__item'],


  // Main navigation menu
  menuDrawer: ['.menu-drawer__menu', 'nav.header__inline-menu'],
  navItem: ['.menu-drawer__menu-item', '.header__menu-item'],

  // Product detail page
  description: ['.product__description', '.rte'],
  specItem: ['.product__description ul li', '.product__description tr'],
  productDetailImage: ['.product__media img', '.product__media-item img'],
  reviewItem: ['.judgeme-review'],
  relatedProducts: ['.product-recommendations .grid__item'],
};

// -----------------------------------------------------------------------------
// Utility Functions
// -----------------------------------------------------------------------------

/**
 * Tries multiple selectors in order until one returns a result.
 * Useful when site structure varies or has been updated.
 */
export async function trySelectors(
  page: any,
  selectorList: string[],
  method: 'querySelector' | 'querySelectorAll' = 'querySelector',
): Promise<any> {
  for (const selector of selectorList) {
    try {
      const result =
        method === 'querySelectorAll'
          ? await page.$$(selector)
          : await page.$(selector);

      if (result && (Array.isArray(result) ? result.length > 0 : true)) {
        return result;
      }
    } catch (e) {
      // Selector didn't match, try the next one
      continue;
    }
  }
  return method === 'querySelectorAll' ? [] : null;
}

/**
 * Pauses execution for a random duration between min and max milliseconds.
 * Used for rate limiting to appear more human-like.
 */
export function sleep(minMs: number, maxMs?: number): Promise<void> {
  const delay = maxMs
    ? Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
    : minMs;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Wraps an async function with retry logic using exponential backoff.
 *
 * Example: The first retry waits 1s, second waits 2s, third waits 4s.
 * This gives transient issues (network blips, temporary blocks) time to resolve.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = SCRAPER_CONFIG.maxRetries,
  baseDelay: number = SCRAPER_CONFIG.retryDelayMs,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s, etc.
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}
