# Deploying to vishnugandarapu.in/world-of-books

No credit card and no DNS changes needed.

| Piece | Where | Free tier |
| --- | --- | --- |
| Frontend (Next.js static export) | GitHub Pages → `https://www.vishnugandarapu.in/world-of-books/` | Free |
| Backend API (NestJS + Playwright, Docker) | Render web service → `https://world-of-books-api.onrender.com` | 512 MB, sleeps after 15 min idle |
| Redis (cache + Bull queue) | Render Key Value | Free, data lost on restart (fine for cache/queue) |
| Postgres | Neon | 0.5 GB, permanent, no card |

GitHub Pages only serves static files, so the API runs on Render's own
`onrender.com` address. Visitors only ever see the `/world-of-books` URL.

## 1. Postgres on Neon

1. Sign up at https://neon.com with GitHub. No card.
2. Create a project (pick a region near Render's, e.g. AWS US East / Oregon,
   or Frankfurt).
3. **Connect** → turn **Connection pooling off** and copy the *direct*
   connection string (host without `-pooler`). It looks like
   `postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require`.
   The backend runs `prisma db push` at startup, which needs the direct URL.

## 2. Backend on Render

1. Sign up at https://render.com with GitHub. No card.
2. **New → Blueprint** → pick `gv1shnu/world-of-books`, branch `main`.
   Render reads `render.yaml` and creates `world-of-books-api` and
   `world-of-books-redis`.
3. When prompted, paste `DATABASE_URL` (Neon direct string) and
   `SERPAPI_API_KEY` (leave empty to disable automatic PDF search).
4. Wait for the first Docker build (~5–10 min). Check:
   `https://world-of-books-api.onrender.com/categories/navigations`.
   If Render gave the service a different hostname, use that below.

Free-tier behaviour to expect:
- After 15 minutes without traffic the API sleeps; the next visit takes about a
  minute while it wakes. The frontend shows its loading spinner meanwhile.
- `render.yaml` caps scraping at one Chromium page at a time to stay within
  512 MB. If the logs show out-of-memory restarts, lower
  `CRAWLEE_MEMORY_MBYTES`.
- Matched PDFs live in memory, so a "token expired" after the API sleeps just
  means clicking **Extract PDF** again.
- Workspace bandwidth is 5 GB/month; each PDF opened counts against it.

## 3. Frontend on GitHub Pages

1. In `gv1shnu/world-of-books` → **Settings → Pages**, set **Source** to
   **GitHub Actions**. Do not set a custom domain: project sites inherit it
   from the `gv1shnu.github.io` user site.
2. **Settings → Secrets and variables → Actions → Variables**: add
   `NEXT_PUBLIC_API_URL` = `https://world-of-books-api.onrender.com`.
3. Push to `main` (or run **Deploy frontend to GitHub Pages** manually).

Book and category pages use query strings (`/product/?id=…`,
`/category/?slug=…`) so every page is a static file and deep links survive a
refresh.

## 4. Verify

- `https://www.vishnugandarapu.in/world-of-books/` loads with styles.
- Categories and books load. If not, open the browser console: a CORS error
  means `FRONTEND_ORIGINS` on Render must be exactly
  `https://www.vishnugandarapu.in`.
- **Extract PDF** returns a match or "no match", not "not configured".

## Alternative: any machine with Docker

`deploy/docker-compose.prod.yml` runs the API, Postgres, Redis and Caddy on a
single host with about 2 GB RAM. Copy `deploy/.env.example` to `deploy/.env`,
then `docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env up -d --build`.
It needs a public hostname pointing at the machine for HTTPS.
