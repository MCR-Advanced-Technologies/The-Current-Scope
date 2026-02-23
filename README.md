# Current Scope Frontend (`dashboards/frontend`)

React + Vite public frontend for Current Scope.

## Local Development

1. Install dependencies:

```bash
cd dashboards/frontend
npm ci
```

2. Start dev server:

```bash
npm run dev
```

3. Build for production:

```bash
npm run build
```

## Environment Variables

- `VITE_BACKEND_URL`: Optional explicit backend URL used by the app at runtime.
- `VITE_BACKEND_PROXY_TARGET` / `BACKEND_PROXY_TARGET`: Vite dev proxy target for `/api` (default: `http://localhost:8001`).
- `VITE_BACKEND_PORT`: Used for localhost fallback URL generation.
- `VITE_BASE_PATH`: Optional deployment base path (example: `/newsapp/`).
- `VITE_GOOGLE_MAPS_API_KEY`: Optional Google Maps API key for radar/map features.
- `VITE_GOOGLE_MAP_ID`: Optional Google Maps map style id.
- `VITE_SW_DEBUG`: Set to `1`/`true` to enable service worker debug logs.

## Service Worker + Updates

- Service worker runs only in production builds.
- App shell is precached (`index.html`, `terms.html`, manifest, icons, shared styles).
- Same-origin `assets/` files use runtime stale-while-revalidate caching.
- API traffic is network-only (no API response caching by service worker).
- YouTube/Googlevideo requests are always bypassed (no SW cache/inspection).
- Update flow:
  1. New SW installs.
  2. User gets an “Update available” prompt.
  3. On confirm, `SKIP_WAITING` is sent.
  4. Page reloads once on `controllerchange`.

### Force Refresh / Cache Reset (Debug)

1. Open DevTools → Application → Service Workers.
2. Unregister `service-worker.js`.
3. Clear site storage + hard reload.

## CSP Notes

- CSP is generated from `vite.config.mjs` (`buildCspHeader`) and injected into HTML via Vite transform.
- This keeps CSP meta and dev/preview headers in sync.
- CSP currently supports:
  - YouTube embeds (`youtube.com`, `youtube-nocookie.com`)
  - Google Maps scripts
  - FontAwesome local assets
  - Dev HMR websocket connections in development
  - Optional off-origin backend connectivity via `VITE_BACKEND_URL`

## Proxy Notes (Docker + Local)

- Dev server proxies `/api` to `VITE_BACKEND_PROXY_TARGET` / `BACKEND_PROXY_TARGET`.
- If not set, proxy defaults to `http://localhost:8001`.
- Docker examples should pass one of these env vars to route `/api` correctly.

## Changelog

### Frontend Reliability Sweep

- Reworked service worker for Vite hashed assets and subpath-safe behavior.
- Added safe SW update prompt flow without reload loops.
- Added SW debug toggle (`VITE_SW_DEBUG`).
- Unified CSP generation so HTML meta and Vite headers do not drift.
- Replaced risky proxy fallback (`172.28.0.1`) with `http://localhost:8001`.
- Removed unused dependencies (`leaflet`, `@capacitor/preferences`).
