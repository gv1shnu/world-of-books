/**
 * Browser-free access to World of Books data.
 *
 * - Menu and product pages are server-rendered HTML, fetched directly.
 * - Category and search listings are rendered client-side from Algolia, so we
 *   query Algolia with the same public, search-only settings the site's own
 *   pages embed for every visitor (read from the page, not hard-coded).
 *
 * This keeps memory to a few MB per request instead of a Chromium instance.
 */

import { SCRAPER_CONFIG } from './scraper.config';

export const WOB_BASE_URL = 'https://www.worldofbooks.com';

export interface ListingProduct {
  source_id: string;
  title: string;
  author?: string;
  price: number;
  image_url?: string;
  source_url: string;
  isbn?: string;
  publisher?: string;
}

export interface ListingPage {
  products: ListingProduct[];
  page: number; // 0-based, as Algolia reports it
  nbPages: number;
  nbHits: number;
}

export interface AlgoliaSettings {
  appId: string;
  apiKey: string;
  indexName: string;
}

export interface ProductDetailData {
  description: string;
  specs: Record<string, string>;
  image_url?: string;
  title?: string;
  author?: string;
  price?: number; // Lowest in-stock offer, else lowest offer
  is_in_stock?: boolean;
  categorySlugs: string[]; // Breadcrumb collections, most specific last
}

export async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': SCRAPER_CONFIG.userAgent },
    signal: AbortSignal.timeout(SCRAPER_CONFIG.requestTimeoutSecs * 1000),
  });
  if (!response.ok) {
    throw new Error(`GET ${url} failed: HTTP ${response.status}`);
  }
  return response.text();
}

export function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

// Inline tags vanish; block tags (p, br, li...) become a space.
const stripTags = (value: string) =>
  decodeHtml(
    value
      .replace(/<\/?(?:a|b|i|u|em|strong|span|small)\b[^>]*>/gi, '')
      .replace(/<[^>]*>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();

/** Reads the Algolia app id, search key and index name a WoB page embeds. */
export function parseAlgoliaSettings(html: string): AlgoliaSettings | null {
  const read = (key: string) =>
    html.match(new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`))?.[1];
  const appId = read('algoliaAppId');
  const apiKey = read('algoliaSearchApiKey');
  const indexName = read('algoliaIndexName');
  return appId && apiKey && indexName ? { appId, apiKey, indexName } : null;
}

/** Reads the Shopify collection id from a collection page. */
export function parseCollectionId(html: string): string | null {
  return (
    html.match(/collection_id\s*=\s*(\d+)/)?.[1] ??
    html.match(/"collectionId"\s*:\s*(\d+)/)?.[1] ??
    null
  );
}

/** Maps an Algolia hit to the product shape the rest of the app stores. */
export function hitToProduct(hit: Record<string, any>): ListingProduct | null {
  const handle = hit.productHandle;
  const title = hit.shortTitle || hit.longTitle;
  if (!handle || !title) return null;
  const price = Number(hit.fromPrice ?? hit.bestConditionPrice ?? 0);
  return {
    source_id: handle,
    title,
    author: hit.author || hit.artist || hit.director || undefined,
    price: Number.isFinite(price) ? price : 0,
    image_url: hit.imageURL || undefined,
    source_url: `${WOB_BASE_URL}/en-gb/products/${handle}`,
    isbn: hit.isbn13 || undefined,
    publisher: hit.publisher || undefined,
  };
}

export async function queryAlgolia(
  settings: AlgoliaSettings,
  params: { filters?: string; query?: string; page: number; hitsPerPage: number },
): Promise<ListingPage> {
  const search = new URLSearchParams({
    page: String(params.page),
    hitsPerPage: String(params.hitsPerPage),
  });
  if (params.filters) search.set('filters', params.filters);
  if (params.query) search.set('query', params.query);

  const response = await fetch(
    `https://${settings.appId}-dsn.algolia.net/1/indexes/${encodeURIComponent(settings.indexName)}/query`,
    {
      method: 'POST',
      headers: {
        'X-Algolia-Application-Id': settings.appId,
        'X-Algolia-API-Key': settings.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ params: search.toString() }),
      signal: AbortSignal.timeout(SCRAPER_CONFIG.requestTimeoutSecs * 1000),
    },
  );
  if (!response.ok) {
    throw new Error(`Algolia query failed: HTTP ${response.status}`);
  }
  const body = (await response.json()) as {
    hits?: Record<string, any>[];
    page?: number;
    nbPages?: number;
    nbHits?: number;
  };
  return {
    products: (body.hits ?? [])
      .map(hitToProduct)
      .filter((p): p is ListingProduct => p !== null),
    page: body.page ?? params.page,
    nbPages: body.nbPages ?? 0,
    nbHits: body.nbHits ?? 0,
  };
}

/**
 * Extracts description, specs and image from a product page: the JSON-LD
 * Book/Product blocks plus the "Additional information" table.
 */
export function parseProductDetailHtml(html: string): ProductDetailData {
  let description = '';
  let image_url: string | undefined;
  let title: string | undefined;
  let author: string | undefined;
  let price: number | undefined;
  let is_in_stock: boolean | undefined;
  const categorySlugs: string[] = [];
  const specs: Record<string, string> = {};

  for (const [, json] of html.matchAll(
    /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g,
  )) {
    let data: any;
    try {
      data = JSON.parse(json);
    } catch {
      continue;
    }
    if (data?.['@type'] === 'BreadcrumbList') {
      for (const item of data.itemListElement ?? []) {
        const slug = String(item?.item ?? '').match(/\/collections\/([^/?#]+)/)?.[1];
        if (slug) categorySlugs.push(slug);
      }
      continue;
    }
    if (data?.['@type'] !== 'Book' && data?.['@type'] !== 'Product') continue;

    if (!title && typeof data.name === 'string') title = decodeHtml(data.name).trim();
    if (!author && data.author?.name) author = String(data.author.name);
    if (data['@type'] === 'Product' && Array.isArray(data.offers)) {
      const offers = data.offers
        .map((o: any) => ({ price: Number(o?.price), inStock: /InStock$/.test(String(o?.availability)) }))
        .filter((o: { price: number }) => Number.isFinite(o.price) && o.price > 0);
      const inStock = offers.filter((o: { inStock: boolean }) => o.inStock);
      const pool = inStock.length ? inStock : offers;
      if (pool.length) price = Math.min(...pool.map((o: { price: number }) => o.price));
      is_in_stock = inStock.length > 0;
    }

    if (!description && typeof data.description === 'string') {
      description = stripTags(data.description);
    }
    const image = Array.isArray(data.image) ? data.image[0] : data.image;
    if (!image_url && typeof image === 'string') {
      image_url = image.startsWith('//') ? `https:${image}` : image;
    }
    if (data['@type'] === 'Book') {
      if (data.numberOfPages) specs['Number of pages'] = String(data.numberOfPages);
      if (data.bookFormat) specs['Binding Type'] = String(data.bookFormat);
      if (data.isbn) specs['ISBN 13'] = String(data.isbn);
      if (data.publisher?.name) specs['Publisher'] = String(data.publisher.name);
      if (data.datePublished) specs['Year published'] = String(data.datePublished);
      if (data.author?.name) specs['Author'] = String(data.author.name);
    }
  }

  const table = html.match(
    /<table[^>]*class="[^"]*additional-info-table[^"]*"[^>]*>([\s\S]*?)<\/table>/,
  )?.[1];
  if (table) {
    for (const [, attrs, row] of table.matchAll(/<tr([^>]*)>([\s\S]*?)<\/tr>/g)) {
      if (/\bhidden\b/.test(attrs)) continue;
      const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) =>
        stripTags(m[1]),
      );
      const [key, value] = cells;
      if (!key || !value || value === 'Unavailable' || key === 'Cover note') {
        continue;
      }
      specs[key] = value;
    }
  }

  return { description, specs, image_url, title, author, price, is_in_stock, categorySlugs };
}
