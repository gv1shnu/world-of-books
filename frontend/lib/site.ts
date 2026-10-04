/** Public site identity, shared by metadata, structured data and the sitemap. */
export const SITE_NAME = 'World of Books Explorer';
export const SITE_DESCRIPTION =
  'Browse second-hand books from World of Books by category, with live prices, stock and book details.';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
export const SITE_ORIGIN = 'https://www.vishnugandarapu.in';
/** Absolute URL of the site root, always ending in a slash. */
export const SITE_URL = `${SITE_ORIGIN}${basePath}/`;

/** Absolute URL for a path inside the site, e.g. siteUrl('about/'). */
export const siteUrl = (path = '') => new URL(path.replace(/^\//, ''), SITE_URL).toString();

/**
 * Open Graph defaults. A page that sets `openGraph` replaces the layout's
 * entirely, so pages spread these in to keep the image and site name.
 */
export const OPEN_GRAPH_DEFAULTS = {
  type: 'website' as const,
  siteName: SITE_NAME,
  locale: 'en_GB',
  images: [{ url: siteUrl('og.png'), width: 1200, height: 630, alt: SITE_NAME }],
};

/**
 * Serialises JSON-LD for a <script> tag. Escapes "<" so scraped text such as
 * "</script>" cannot end the tag early.
 */
export const jsonLdScript = (data: unknown) => ({
  __html: JSON.stringify(data).replace(/</g, '\\u003c'),
});
