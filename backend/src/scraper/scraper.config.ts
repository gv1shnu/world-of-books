/**
 * Scraper Configuration
 * 
 * Tweak these values for different environments or rate limiting.
 * 
 * ETHICAL SCRAPING:
 * - Respects robots.txt and site terms of service
 * - Uses rate limiting to avoid overloading the server
 * - Implements exponential backoff with jitter for retries
 */

// -----------------------------------------------------------------------------
// Core Scraper Settings
// -----------------------------------------------------------------------------

export const SCRAPER_CONFIG = {
  // Target site base URL
  baseUrl: 'https://www.worldofbooks.com',

  // robots.txt compliance
  respectRobotsTxt: true,
  robotsTxtUrl: 'https://www.worldofbooks.com/robots.txt',

  // Pagination
  // Set to 0 for unlimited (scrape all pages), or a positive number to cap
  maxPagesPerCategory: 3, // Default: 3 pages = ~120 products per category

  // Rate limiting - prevents overloading the server
  rateLimit: {
    // Minimum delay between requests (ms)
    minDelayMs: 1500,
    // Maximum delay between requests (ms) - actual delay is randomized
    maxDelayMs: 3000,
    // Maximum requests per minute (0 = no limit)
    maxRequestsPerMinute: 20,
  },

  // Request timing - adds random delay between page requests
  requestDelayMs: { min: 1500, max: 3000 },

  // Timeouts
  requestTimeoutSecs: 30, // Max wait time for a page to load
  navigationTimeoutSecs: 45, // Longer timeout for initial navigation scrape

  // Retry behavior with exponential backoff + jitter
  maxRetries: 3,
  retryDelayMs: 1000,
  maxRetryDelayMs: 10000, // Cap on backoff delay
  jitterFactor: 0.3, // Random jitter up to 30% of delay

  // Concurrency - how many pages to scrape in parallel
  // Keep this low to avoid getting blocked
  maxConcurrency: 2, // Reduced from 3 for politeness
  maxRequestsPerCrawl: 100,

  // Browser settings
  headless: true,
  viewport: { width: 1920, height: 1080 },

  // User agent string - identifies as a bot (ethical practice)
  userAgent:
    'WorldOfBooksExplorer/1.0 (+https://github.com/gv1shnu/world-of-books) Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
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

  // Product detail page - use specific selectors to avoid footer garbage
  description: [
    '.product__description .rte',           // Product description within product section
    '.product__description',                 // Direct product description
    '.product-single__description',          // Alternative layout
    '[data-product-description]',            // Data attribute fallback
    'main .rte:first-of-type',               // First RTE in main content only
  ],
  specItem: [
    '.product__description ul li',
    '.product__description table tr',
    '.product-specifications li',
  ],
  productDetailImage: [
    '.product__media img',
    '.product__media-item img',
    '.product-single__media img',
  ],
  reviewItem: ['.judgeme-review', '.jdgm-rev'],
  relatedProducts: ['.product-recommendations .grid__item', '.related-products .product-card'],
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
 * Adds jitter to a delay value to prevent thundering herd problems.
 * Jitter is a random variation that spreads out retry attempts.
 */
export function addJitter(delay: number, jitterFactor: number = SCRAPER_CONFIG.jitterFactor): number {
  const jitter = delay * jitterFactor * (Math.random() * 2 - 1); // Random between -jitter and +jitter
  return Math.max(0, delay + jitter);
}

/**
 * Wraps an async function with retry logic using exponential backoff + jitter.
 *
 * Features:
 * - Exponential backoff: 1s, 2s, 4s, 8s...
 * - Jitter: Random variation to prevent synchronized retries
 * - Capped delay: Won't exceed maxRetryDelayMs
 * 
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
        // Exponential backoff with cap
        const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
        const cappedDelay = Math.min(exponentialDelay, SCRAPER_CONFIG.maxRetryDelayMs);
        const delayWithJitter = addJitter(cappedDelay);

        console.log(`Retry ${attempt}/${maxRetries} after ${Math.round(delayWithJitter)}ms...`);
        await sleep(delayWithJitter);
      }
    }
  }

  throw lastError;
}

// -----------------------------------------------------------------------------
// Robots.txt Compliance
// -----------------------------------------------------------------------------

/**
 * Simple robots.txt parser and checker.
 * Caches the parsed rules to avoid repeated fetches.
 */
class RobotsTxtChecker {
  private rules: Map<string, { allow: string[]; disallow: string[] }> = new Map();
  private lastFetch: number = 0;
  private cacheMs: number = 1000 * 60 * 60; // 1 hour cache

  async isAllowed(url: string, userAgent: string = '*'): Promise<boolean> {
    if (!SCRAPER_CONFIG.respectRobotsTxt) {
      return true; // Skip checking if disabled
    }

    try {
      const parsed = new URL(url);
      const robotsUrl = `${parsed.origin}/robots.txt`;

      // Fetch and parse if not cached or cache expired
      if (!this.rules.has(parsed.origin) || Date.now() - this.lastFetch > this.cacheMs) {
        await this.fetchRobotsTxt(robotsUrl, parsed.origin);
      }

      const rules = this.rules.get(parsed.origin);
      if (!rules) return true; // No rules = allow

      const path = parsed.pathname;

      // Check disallow rules
      for (const pattern of rules.disallow) {
        if (this.matchesPattern(path, pattern)) {
          // Check if explicitly allowed
          for (const allowPattern of rules.allow) {
            if (this.matchesPattern(path, allowPattern)) {
              return true;
            }
          }
          return false;
        }
      }

      return true;
    } catch {
      // If we can't check, assume allowed
      return true;
    }
  }

  private async fetchRobotsTxt(robotsUrl: string, origin: string): Promise<void> {
    try {
      const response = await fetch(robotsUrl);
      if (!response.ok) {
        this.rules.set(origin, { allow: [], disallow: [] });
        return;
      }

      const text = await response.text();
      const parsed = this.parseRobotsTxt(text);
      this.rules.set(origin, parsed);
      this.lastFetch = Date.now();
    } catch {
      this.rules.set(origin, { allow: [], disallow: [] });
    }
  }

  private parseRobotsTxt(text: string): { allow: string[]; disallow: string[] } {
    const lines = text.split('\n');
    const allow: string[] = [];
    const disallow: string[] = [];
    let inUserAgentBlock = false;

    for (const line of lines) {
      const trimmed = line.trim().toLowerCase();

      if (trimmed.startsWith('user-agent:')) {
        const agent = trimmed.substring(11).trim();
        inUserAgentBlock = agent === '*' || agent.includes('bot');
      } else if (inUserAgentBlock) {
        if (trimmed.startsWith('disallow:')) {
          const path = line.substring(line.indexOf(':') + 1).trim();
          if (path) disallow.push(path);
        } else if (trimmed.startsWith('allow:')) {
          const path = line.substring(line.indexOf(':') + 1).trim();
          if (path) allow.push(path);
        }
      }
    }

    return { allow, disallow };
  }

  private matchesPattern(path: string, pattern: string): boolean {
    if (pattern === '/') return true;
    if (pattern.endsWith('*')) {
      return path.startsWith(pattern.slice(0, -1));
    }
    return path.startsWith(pattern);
  }
}

export const robotsChecker = new RobotsTxtChecker();

// -----------------------------------------------------------------------------
// Rate Limiter
// -----------------------------------------------------------------------------

/**
 * Token bucket rate limiter.
 * Ensures we don't exceed maxRequestsPerMinute.
 */
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per ms

  constructor() {
    this.maxTokens = SCRAPER_CONFIG.rateLimit.maxRequestsPerMinute || 60;
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
    this.refillRate = this.maxTokens / 60000; // per minute to per ms
  }

  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens < 1) {
      // Wait until we have a token
      const waitTime = (1 - this.tokens) / this.refillRate;
      await sleep(waitTime);
      this.refill();
    }

    this.tokens -= 1;

    // Also add the configured delay
    const { minDelayMs, maxDelayMs } = SCRAPER_CONFIG.rateLimit;
    await sleep(minDelayMs, maxDelayMs);
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = elapsed * this.refillRate;
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}

export const rateLimiter = new RateLimiter();

