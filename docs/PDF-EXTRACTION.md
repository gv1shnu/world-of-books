# Extract PDF

The product page has an **Extract PDF** button. It sends a Google query such as
`"Pride and Prejudice" "Jane Austen" filetype:pdf` through SerpApi, downloads up
to five distinct results, and parses each PDF with pdf-lib. No Google results
HTML is scraped and no CAPTCHA or access controls are bypassed.

## Setup

1. Create a SerpApi account at https://serpapi.com/ and obtain a key.
2. Set `SERPAPI_API_KEY` in `backend/.env` (or the backend hosting environment).
   Keep it server-side; never add it to a `NEXT_PUBLIC_*` variable.
3. Install both apps with `npm ci`, run `npx prisma generate` in `backend/`,
   and start the usual Postgres, Redis, backend and frontend services.
4. Open a book whose scraped specs include a page count and whose author is
   known, then click **Extract PDF**. The site's existing product detail request
   populates specs; extraction itself reads the database and does not scrape WOB.

Google's Custom Search JSON API is closed to new customers and scheduled to
end on January 1, 2027, so this feature uses SerpApi's Google engine instead.
See [Google's notice](https://developers.google.com/custom-search/v1/overview)
and [SerpApi's Google API](https://serpapi.com/search-api).
Provider usage is subject to the account's quotas and pricing. Without a key,
the page explains that automatic search is unconfigured and links to the same
query on Google. Manual searches do not count as validated PDFs.

## Matching and reading

- Accept numeric `Pages`, `Page count`, `Number of pages`, `No. of pages`,
  `Num pages` or `Pagination` specs, including values like `320 pages` or `1,024`.
- Require both a title and author. Do not guess a missing printed page count.
- Allow a difference of `max(5, ceil(expectedPages * 0.05))` pages, inclusive.
  For a 320-page listing, an actual PDF with 304–336 pages matches.
- Prefer the closest page count among the checked results; stop on an exact match.
- Skip password-protected/encrypted PDFs, broken downloads, non-PDF bodies,
  previews and editions outside the tolerance.
- Keep the exact validated bytes for ten minutes and fetch them through the API.
  The frontend creates a temporary blob URL and renders pages with PDF.js,
  avoiding source-site CORS and framing restrictions. The reader has previous/next
  page controls, zoom, a new-tab link and a source link. PDF page text is also
  exposed to screen readers.

Pagination is a heuristic. The quoted query and matching count do **not**
prove identity, edition, completeness or distribution rights. The reader says
so. Only use sources whose PDFs you are entitled to access.

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/products/:id/pdf/extract` | On-demand search; returns `matched`, `no_match`, `missing_metadata` or `not_configured` |
| GET | `/products/:id/pdf/:token` | Return the exact matched PDF as `application/pdf`, inline |

A match includes `expectedPages`, `pdfPages`, `tolerancePages`, `sourceUrl`,
`query` and a UUID `token`. The reader route accepts only a cached product/token
pair; it never accepts an arbitrary URL. Invalid IDs/tokens receive 400;
missing products and expired/evicted reader tokens receive 404. Search-provider
failures and overload receive 503 so the user can retry.

## Limits and deployment

Downloads accept public HTTPS on port 443 only. DNS is checked and pinned for
each request, and every redirect is checked again. Private, loopback, link-local
and reserved addresses are rejected. Each download has an eight-second budget,
a three-redirect limit, and a 20 MiB cap regardless of `Content-Length`.
Search requests have a twelve-second timeout. PDF parsing runs in an isolated
worker with a three-second timeout and a bounded JS heap. Encrypted PDFs are
not opened.

Identical concurrent extraction requests share one promise. At most two searches
run at once per API process. The process holds at most three cached outcomes
(up to 60 MiB of retained PDFs). Misses are cached for one minute. The exact
PDF buffers are held only in memory; there is no permanent PDF archive or
schema migration.

For multiple API replicas, route extraction and reader requests to the same
instance (sticky sessions), or replace the local cache with shared object
storage and expiring tokens. A restart or cache eviction invalidates the token;
the user can extract again. This branch retains existing API routing and uses
the shared Axios client, so configure `NEXT_PUBLIC_API_URL` as for other APIs.
The broader sub-path deployment and portfolio phases in the supplied planning
prompt are separate work and have not been completed by this feature.

## Verification

Backend tests cover generated PDF page counts, tolerance boundaries, candidate
fallback, metadata failures, encrypted and malformed files, deduplication,
expiry, provider errors, URL safety and the HTTP extraction/reader contract.
Frontend tests cover click-only search, in-page reading, failure states, source
links and blob cleanup. Live searches require a real provider key and suitable
public sources and cannot be guaranteed to find a match for every book.
