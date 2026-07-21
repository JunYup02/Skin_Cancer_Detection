# Frontend

Static HTML/CSS/JS — no build step, no framework. Talks to the FastAPI backend
in `../backend` over plain `fetch()`.

```
index.html        # login (entry point)
signup.html
dashboard.html
body-part.html     # step 1/3 — GET /api/lesion/body-regions, POST /api/lesion/body-part
upload.html        # step 2/3 — POST /api/gemini-report (classification + Gemini report)
results.html       # step 3/3 — renders the stored analysis result
hospitals.html      # GET /api/hospitals/nearby
support.html

css/style.css       # design tokens (color/type/spacing) carried over from the
                     # Dermalyze_data/Frontend/*.txt Stitch mockups, + a derived dark theme

js/config.js        # API_BASE_URL — the one thing you edit per environment
js/api.js           # fetch wrapper for every backend route
js/auth.js          # token storage, login/signup form handlers, requireAuth() guard
js/nav.js           # shared header/back-button/logout wiring
js/body-part.js
js/upload.js
js/results.js
js/hospitals.js

assets/images/logo.png
```

## Run locally

Any static file server works, e.g.:

```
python3 -m http.server 5500
```

then open `http://127.0.0.1:5500/index.html`. The backend must also be running
(see `../backend/README.md`) — by default `js/config.js` points at
`http://127.0.0.1:8000`.

## Pointing at a deployed backend

Once the FastAPI service is live on Render, either:

- edit `DEFAULT_API_BASE_URL` in `js/config.js` to the Render URL (e.g.
  `https://dermalyze-api.onrender.com`) and redeploy the frontend, or
- for quick testing without editing files, open the browser console on any
  page and run `localStorage.setItem('dermalyze_api_base', 'https://dermalyze-api.onrender.com')`
  — it overrides the default and persists across reloads.

If the frontend ends up on its own origin (e.g. GitHub Pages, Netlify, a
separate Render static site), set `CORS_ALLOWED_ORIGINS` on the backend to
that exact origin — see `../backend/README.md`.

## Notes on the model-not-ready state

The classification model isn't deployed yet, so `POST /api/gemini-report`
currently returns a 502 from `vertex_predictor.classify()`. `js/upload.js`
catches that specifically and shows a plain-language "analysis model isn't
connected yet" message instead of a broken screen — no frontend changes are
needed once a real Vertex AI endpoint is deployed and `VERTEX_ENDPOINT_ID` is
set on the backend.
