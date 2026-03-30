# NewsApp Frontend

Simple React + Vite frontend for the News Tracker backend.

Quick start

1. Install dependencies:

```bash
cd dashboards/frontend
npm install
```

2. Start dev server:

```bash
npm run dev
```

3. Open the address printed by Vite (usually `http://localhost:5173`).

Configuration

- Backend URL: the UI defaults to `http://localhost:8001`. Change it at runtime by setting the `NEWSAPP_BACKEND` key in `localStorage` or edit `src/api.js`.
- API token: paste your `API_TOKEN` or `TRACKER_API_TOKEN` in the token input and click Save — the token is kept in memory for the current session and used for service control endpoints.

Notes

- The backend must allow CORS (the provided backend already sets `allow_origins=["*"]`).
- The UI calls `/articles`, `/service/fetch-now`, `/service/start` and `/service/stop` endpoints.

YouTube Playback (CORB-safe)

- YouTube sources are rendered only with the YouTube IFrame Player API (`src/components/YouTubePlayer.jsx`).
- The app does not fetch or probe `googlevideo.com/videoplayback` URLs for playback.
- Service worker bypasses YouTube/Googlevideo requests and does not cache/clone/inspect them.
- Do not use global `no-referrer` for this app. Keep a referrer policy compatible with embeds.

Required CSP directives

- `frame-src https://www.youtube.com https://www.youtube-nocookie.com`
- `script-src https://www.youtube.com https://www.youtube-nocookie.com https://maps.googleapis.com https://maps.gstatic.com`
- `script-src-elem https://www.youtube.com https://www.youtube-nocookie.com https://maps.googleapis.com https://maps.gstatic.com`
- `img-src https://i.ytimg.com https://*.ytimg.com`
- Optional for strict policies: `media-src https://*.googlevideo.com`
