/**
 * Thin wrapper around the Dermalyze FastAPI backend (see backend/app/api/routes/).
 * Every function throws an Error with a human-readable `.message` on failure.
 */

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function extractErrorMessage(body) {
  if (!body) return "Something went wrong. Please try again.";
  const detail = body.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    // FastAPI/Pydantic 422 validation error shape
    return detail
      .map((d) => (d.loc ? `${d.loc[d.loc.length - 1]}: ${d.msg}` : d.msg))
      .join(" · ");
  }
  return "Something went wrong. Please try again.";
}

async function apiFetch(path, { method = "GET", json, body, headers = {}, auth = false } = {}) {
  const finalHeaders = { ...headers };
  if (auth) {
    const token = getToken();
    if (token) finalHeaders["Authorization"] = `Bearer ${token}`;
  }

  let finalBody = body;
  if (json !== undefined) {
    finalHeaders["Content-Type"] = "application/json";
    finalBody = JSON.stringify(json);
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { method, headers: finalHeaders, body: finalBody });
  } catch (networkErr) {
    throw new ApiError(
      `Couldn't reach the Dermalyze server at ${API_BASE_URL}. Is it running?`,
      0
    );
  }

  let data = null;
  const text = await response.text();
  if (text) {
    try { data = JSON.parse(text); } catch { /* non-JSON body, leave data null */ }
  }

  if (!response.ok) {
    throw new ApiError(extractErrorMessage(data), response.status);
  }
  return data;
}

const Api = {
  // --- auth ---
  signup(payload) {
    return apiFetch("/api/auth/signup", { method: "POST", json: payload });
  },
  login(username, password) {
    return apiFetch("/api/auth/login", { method: "POST", json: { username, password } });
  },

  // --- lesion / body part ---
  getBodyRegions() {
    return apiFetch("/api/lesion/body-regions", { method: "GET" });
  },
  postBodyPart(view, region) {
    return apiFetch("/api/lesion/body-part", { method: "POST", json: { view, region }, auth: true });
  },

  // --- classification + Gemini report ---
  async createGeminiReport(file) {
    const form = new FormData();
    form.append("file", file);
    return apiFetch("/api/gemini-report", { method: "POST", body: form, auth: true });
  },

  // --- nearby hospitals ---
  getNearbyHospitals(lat, lng, radiusM = 3000) {
    const params = new URLSearchParams({ lat, lng, radius_m: radiusM });
    return apiFetch(`/api/hospitals/nearby?${params.toString()}`, { method: "GET" });
  },
};
