/**
 * Single place to point the frontend at a backend deployment.
 *
 * Local dev: leave as-is and run `uvicorn app.main:app --reload` in backend/.
 * Once the FastAPI service is deployed on Render, change DEFAULT_API_BASE_URL
 * to that service's URL, e.g. "https://dermalyze-api.onrender.com".
 *
 * For quick testing against a remote backend without editing this file, you
 * can also run `localStorage.setItem('dermalyze_api_base', 'https://...')`
 * in the browser console — it takes priority over the default below.
 */
const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";

const API_BASE_URL = (
  localStorage.getItem("dermalyze_api_base") || DEFAULT_API_BASE_URL
).replace(/\/+$/, "");
