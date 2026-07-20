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
