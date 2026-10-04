# Deploying to vishnugandarapu.in/world-of-books

| Piece | Where | Cost |
| --- | --- | --- |
| Frontend (Next.js static export) | GitHub Pages → `https://www.vishnugandarapu.in/world-of-books/` | Free |
| Backend API + Postgres + Redis + Playwright | One VM running `deploy/docker-compose.prod.yml`, behind Caddy at `https://api.vishnugandarapu.in` | Free on Oracle Cloud Always Free |

GitHub Pages can only serve static files and cannot proxy requests, so the API
lives on its own subdomain. Visitors only ever see the `/world-of-books` URL.

## 1. Backend VM (Oracle Cloud Always Free)

1. Create an Oracle Cloud account and launch a **VM.Standard.A1.Flex** instance
   (Ampere/ARM, up to 4 OCPU / 24 GB is Always Free) with Ubuntu 24.04.
   2 OCPU / 12 GB is plenty. If A1 capacity is unavailable in your region, retry
   later or pick another availability domain.
2. In the instance's VCN **Security List**, add ingress rules for TCP 80 and 443
   from `0.0.0.0/0`. On the VM, open them in the OS firewall too:
   ```bash
   sudo iptables -I INPUT 6 -p tcp --dport 80 -j ACCEPT
   sudo iptables -I INPUT 6 -p tcp --dport 443 -j ACCEPT
   sudo netfilter-persistent save
   ```
3. Install Docker:
   ```bash
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker $USER && newgrp docker
   ```
4. At your DNS provider, add an **A record** `api` → the VM's public IP.
5. Clone and start:
   ```bash
   git clone https://github.com/gv1shnu/world-of-books && cd world-of-books
   cp deploy/.env.example deploy/.env && nano deploy/.env   # set POSTGRES_PASSWORD, SERPAPI_API_KEY
   docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env up -d --build
   ```
   Caddy fetches the HTTPS certificate once DNS points at the VM.
6. Check: `curl https://api.vishnugandarapu.in/categories/navigations`.

Update later with `git pull` and the same `docker compose ... up -d --build`.
Logs: `docker compose -f deploy/docker-compose.prod.yml logs -f backend`.

Any other Docker host works the same way (a spare PC, Hetzner, a GCP/AWS VM);
it needs roughly 2 GB RAM for Chromium, Postgres and Redis together.

## 2. Frontend on GitHub Pages

1. In `gv1shnu/world-of-books` → **Settings → Pages**, set **Source** to
   **GitHub Actions**. Do not set a custom domain here: project sites inherit
   the domain of the `gv1shnu.github.io` user site.
2. **Settings → Secrets and variables → Actions → Variables**: add
   `NEXT_PUBLIC_API_URL` = `https://api.vishnugandarapu.in`.
3. Push to `main` (or run the workflow manually). `.github/workflows/pages.yml`
   tests, builds with `NEXT_PUBLIC_BASE_PATH=/world-of-books`, and publishes
   `frontend/out`.

Book and category pages use query strings (`/product/?id=…`,
`/category/?slug=…`) so every page exists as a static file and deep links
survive a refresh.

## 3. Verify

- `https://www.vishnugandarapu.in/world-of-books/` loads with styles.
- Categories and books load (if not, check the browser console for CORS:
  `FRONTEND_ORIGINS` must be exactly `https://www.vishnugandarapu.in`).
- **Extract PDF** returns a match or "no match", not "not configured".
