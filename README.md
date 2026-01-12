# World of Books - Product Data Explorer

A full-stack book exploration platform that scrapes and displays live product data from [World of Books](https://www.worldofbooks.com/). The system uses an intelligent, event-driven architecture with background scraping, Redis caching, and PostgreSQL persistence.

## Features

- **Live Scraping** - Playwright-powered headless browser extracts real-time pricing and availability  
- **Smart Caching** - Redis caching layer with TTL for fast responses
- **Background Jobs** - Bull queue processes scrapes without blocking the UI
- **Pagination** - Scrapes all pages of each category automatically
- **Auto-refresh** - Stale data triggers background refresh (1 hour TTL)

## Architecture

  ```
  ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
  │   Frontend      │──────▶│    Backend      │──────▶│   PostgreSQL    │
  │   (Next.js)     │       │    (NestJS)     │       │                 │
  └─────────────────┘       └────────┬────────┘       └─────────────────┘
                                    │
                            ┌────────▼────────┐       ┌─────────────────┐
                            │   Redis/Bull    │──────▶│  Playwright     │
                            │   Job Queue     │       │  Scraper Worker │
                            └─────────────────┘       └─────────────────┘
  ```

  **Frontend (Next.js)** - Displays categories and products. Uses React Query for data fetching.

  **Backend (NestJS)** - REST API for categories/products. Triggers background scrapes when data is stale.

  **Job Queue (Redis + Bull)** - Manages async scrape tasks with retries and concurrency control.

  **Worker (Playwright)** - Headless browser that extracts product data from World of Books.

  **Database (PostgreSQL)** - Stores navigation hierarchy, products, and scrape job logs.

## Quick Start

### Prerequisites
- Node.js 18+
- Docker Desktop

### 1. Clone & Setup
```bash
git clone https://github.com/gv1shnu/world-of-books
cd world-of-books
```

### 2. Start Infrastructure
```bash
docker-compose up -d  # Starts Postgres + Redis
```

### 3. Backend Setup
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run start:dev
```

Backend runs at: http://localhost:8080

### 4. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: http://localhost:3000

## Environment Variables

### Backend (backend/.env)
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/worldofbooks?schema=public"
REDIS_URL="https://your-redis-url.railway.app:6379"
VERCEL_URL=""
```

### Frontend (frontend/.env.local)
```env
NEXT_RAILWAY_URL="https://your-railway-backend.up.railway.app"
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/categories/navigations` | Get all navigation menus with categories |
| GET | `/categories/:slug` | Get category with products (paginated) |
| GET | `/categories/:slug?page=2&limit=24` | Pagination support |
| GET | `/categories/:slug?sort=price_asc` | Sort: price_asc, price_desc, newest, title |
| GET | `/categories/admin/cache-stats` | Redis cache statistics |

## Project Structure

```
world-of-books/
├── docker-compose.yml          # Postgres + Redis containers
│
├── backend/                    # NestJS API Server
│   ├── prisma/
│   │   └── schema.prisma       # Database models + indexes
│   ├── src/
│   │   ├── main.ts             # Application entry point
│   │   ├── app.module.ts       # Root module config
│   │   ├── categories/         # REST API endpoints
│   │   ├── cache/              # Redis caching layer
│   │   ├── prisma/             # Database client
│   │   └── scraper/            # Playwright scraper + queue worker
│   └── Dockerfile              # Production deployment config
│
└── frontend/                   # Next.js Client
    ├── app/
    │   ├── page.tsx            # Home page (category browser)
    │   └── category/[slug]/    # Category detail page
    └── lib/
        └── api.ts              # Axios client config
```

## Key Files

| File | Purpose |
|------|---------|
| `schema.prisma` | Database models, indexes, and enums |
| `scraper.service.ts` | Core scraping logic (navigation, category, product) |
| `scraper.config.ts` | Scraper settings (pagination, delays, selectors) |
| `scraper.processor.ts` | Background job worker |
| `cache.service.ts` | Redis caching with TTL |
| `categories.controller.ts` | REST API with caching + pagination |

## Deployment

### Backend (Railway)
- Services: Node.js, PostgreSQL, Redis
- Dockerfile included for Playwright browser installation

### Frontend (Vercel)
- Framework: Next.js
- Set `NEXT_RAILWAY_URL` to Railway production URL

## Development Notes

### Adjusting Scraper Behavior

Edit `backend/src/scraper/scraper.config.ts`:

```typescript
export const SCRAPER_CONFIG = {
  maxPagesPerCategory: 0,     // 0 = unlimited, or set limit
  requestDelayMs: { min: 1000, max: 2000 }, // Rate limiting
  maxRetries: 3,              // Retry failed pages
};
```