# Backend

FastAPI service.

```
app/
  main.py       # FastAPI app entrypoint
  api/routes/   # feature routers (one file per feature, included in routes/__init__.py)
  schemas/      # pydantic request/response models
  models/       # data models
  services/     # business logic
  core/         # config, shared setup
tests/
```

## Run locally

```
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Env vars

`POST /api/gemini-report` (image in, classification + Gemini natural-language report out)
needs these set. Copy `.env.example` to `.env` and fill in the values — it's loaded
automatically on startup (`app/core/config.py`) and gitignored, so it never gets committed:

```
cp .env.example .env
```

- `GEMINI_API_KEY` — from [Google AI Studio](https://aistudio.google.com/apikey)
- `VERTEX_PROJECT_ID`, `VERTEX_LOCATION` (e.g. `us-central1`), `VERTEX_ENDPOINT_ID` — the deployed
  Vertex AI AutoML image-classification endpoint
- `GOOGLE_APPLICATION_CREDENTIALS` — path to a GCP service account key JSON with Vertex AI access

`GET /api/hospitals/nearby?lat=&lng=` (nearby dermatology clinics/hospitals) needs:

- `GOOGLE_PLACES_API_KEY` — a Google Places API (New) key. The field mask only requests
  Nearby Search **Pro**-tier fields (cheaper) — no `rating`, `userRatingCount`, or
  `currentOpeningHours`, since those bill under the pricier "Nearby Search Enterprise" SKU.
  Add them in `app/services/places.py` if that cost is acceptable later.

`POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/lesion/body-regions`,
`POST /api/lesion/body-part` (auth + lesion body-part selection) need:

- `DATABASE_URL` — optional. If unset, falls back to a local SQLite file (`dermalyze.db`) for
  dev. Set to a PostgreSQL URL (e.g. `postgresql+psycopg2://user:password@host:5432/dermalyze`)
  once a real DB is provisioned.
- `SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES` — JWT signing config.
- `CORS_ALLOWED_ORIGINS` — comma-separated frontend origins (`*` for local dev).

Auth uses `HTTPBearer`: call `POST /api/auth/login`, then paste the returned `access_token`
into Swagger's Authorize popup (single "Value" field, no username/password form) to call
`POST /api/lesion/body-part`.

## Deploying to Render

`render.yaml` in this folder is a [Render Blueprint](https://render.com/docs/blueprint-spec)
for this service — connect the repo in the Render dashboard and it picks up the build/start
commands and health check automatically. Then fill in the env vars it declares (all `sync: false`,
so Render prompts for them instead of committing values):

- Same list as above (`GEMINI_API_KEY`, `VERTEX_*`, `GOOGLE_PLACES_API_KEY`, `SECRET_KEY` is
  auto-generated, etc).
- `GOOGLE_APPLICATION_CREDENTIALS` — don't paste key contents into a regular env var. Upload the
  service-account JSON as a Render **Secret File** (Environment → Secret Files), then set this
  var to the mount path Render gives it, e.g. `/etc/secrets/dermalyze-gcp.json`.
- `DATABASE_URL` — Render's disk is ephemeral, so the SQLite fallback gets wiped on every deploy.
  Provision a Postgres instance (Render's own, or any external one) before real users sign up, and
  set this to its connection string.
- `CORS_ALLOWED_ORIGINS` — set to the frontend's actual deployed origin once it has one (not `*`)
  so only that origin can call the API.

Once deployed, point the frontend at it — see `frontend/README.md`.
