requireAuth();

const stateEl = document.getElementById("clinics-state");
const listEl = document.getElementById("clinics-list");
const bannerEl = document.getElementById("location-banner");
const mapFrameEl = document.getElementById("map-frame");
const searchInput = document.getElementById("search-input");
const radiusChips = document.querySelectorAll(".filter-chip[data-radius]");

let coords = null;
let radiusM = 3000;
let allHospitals = [];
let searchQuery = "";

// Contextual "urgent" banner if the user arrived here right after a higher-risk result.
// Mirrors the risk tiering + labels in results.js; duplicated here to keep pages independent.
const CLASS_LABEL = {
  mel: "Melanoma", bcc: "Basal Cell Carcinoma", akiec: "Actinic Keratosis / Intraepithelial Carcinoma",
  bkl: "Benign Keratosis-like Lesion", nv: "Melanocytic Nevus", vasc: "Vascular Lesion", df: "Dermatofibroma",
};
const HIGH_RISK_CLASSES = ["mel", "bcc", "akiec"];

(function showUrgentContextIfAny() {
  const raw = sessionStorage.getItem("dermalyze_result");
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    const top = [...(data.predictions || [])].sort((a, b) => b.probability - a.probability)[0];
    if (!top) return;
    const key = (top.name || top.id || "").toLowerCase();
    if (!HIGH_RISK_CLASSES.includes(key)) return;

    const banner = document.getElementById("urgent-banner");
    banner.style.background = "var(--error-container)";
    banner.classList.remove("hidden");
    ["urgent-banner-icon", "urgent-banner-eyebrow", "urgent-banner-title", "urgent-banner-sub"].forEach((id) => {
      document.getElementById(id).style.color = "var(--on-error-container)";
    });
    document.getElementById("urgent-banner-icon").textContent = "emergency";
    document.getElementById("urgent-banner-eyebrow").textContent = "Urgent attention needed";
    document.getElementById("urgent-banner-title").textContent = `Possible ${CLASS_LABEL[key] || "finding"} — High risk`;
    document.getElementById("urgent-banner-sub").textContent = "We recommend seeing a dermatologist within 1-2 weeks.";
  } catch {
    /* ignore malformed session data */
  }
})();

function setLoading(message) {
  listEl.innerHTML = "";
  stateEl.classList.remove("hidden");
  stateEl.innerHTML = `
    <div class="spinner" style="border-color: color-mix(in srgb, var(--outline) 30%, transparent); border-top-color: var(--outline);"></div>
    <p>${message}</p>
  `;
}

function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function renderClinics() {
  stateEl.classList.add("hidden");
  listEl.innerHTML = "";

  let hospitals = allHospitals;
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    hospitals = hospitals.filter((h) => h.name.toLowerCase().includes(q));
  }

  if (!hospitals.length) {
    stateEl.classList.remove("hidden");
    stateEl.innerHTML = `
      <span class="material-symbols-outlined">search_off</span>
      <h3>No clinics found nearby</h3>
      <p>Try a wider radius or a different search term. Coverage depends on OpenStreetMap data in this area.</p>
    `;
    return;
  }

  hospitals.forEach((h) => {
    const card = document.createElement("article");
    card.className = "card clinic-card";
    card.innerHTML = `
      <div class="clinic-head">
        <h4>${h.name}</h4>
      </div>
      <div class="clinic-meta">
        <span><span class="material-symbols-outlined" style="font-size:18px;">near_me</span>${formatDistance(h.distance_m)}</span>
        ${h.opening_hours ? `<span><span class="material-symbols-outlined" style="font-size:18px;">schedule</span>${h.opening_hours}</span>` : ""}
      </div>
      ${h.address ? `<p class="text-body-md text-on-surface-variant" style="margin:0;">${h.address}</p>` : ""}
      <div style="display:flex; gap:8px;">
        ${h.phone ? `<a class="btn btn-outline" style="flex:1;" href="tel:${h.phone}"><span class="material-symbols-outlined" style="font-size:18px;">call</span>Call</a>` : ""}
        <a class="btn btn-primary" style="flex:1;" href="${h.google_maps_url}" target="_blank" rel="noopener">
          <span class="material-symbols-outlined" style="font-size:18px;">directions</span>
          Directions
        </a>
      </div>
    `;
    listEl.appendChild(card);
  });
}

async function loadClinics() {
  if (!coords) return;
  setLoading("Finding nearby clinics…");
  mapFrameEl.classList.remove("hidden");
  mapFrameEl.innerHTML = `<iframe src="https://www.google.com/maps?q=${coords.lat},${coords.lng}&z=13&output=embed" loading="lazy" title="Map of nearby clinics"></iframe>`;
  try {
    allHospitals = await Api.getNearbyHospitals(coords.lat, coords.lng, radiusM);
    renderClinics();
  } catch (err) {
    stateEl.classList.remove("hidden");
    stateEl.innerHTML = `
      <span class="material-symbols-outlined text-error">error</span>
      <h3>Couldn't load clinics</h3>
      <p>${err.message}</p>
      <button class="btn btn-outline" id="retry-clinics">Try again</button>
    `;
    document.getElementById("retry-clinics").addEventListener("click", loadClinics);
  }
}

radiusChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    radiusChips.forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    radiusM = Number(chip.dataset.radius);
    loadClinics();
  });
});

searchInput.addEventListener("input", () => {
  searchQuery = searchInput.value;
  renderClinics();
});

function requestLocation() {
  if (!navigator.geolocation) {
    bannerEl.classList.remove("hidden");
    bannerEl.querySelector("span:last-child").textContent =
      "This browser doesn't support location lookup. Try a different browser to find nearby clinics.";
    stateEl.classList.add("hidden");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      coords = { lat: position.coords.latitude, lng: position.coords.longitude };
      loadClinics();
    },
    () => {
      bannerEl.classList.remove("hidden");
      bannerEl.querySelector("span:last-child").textContent =
        "Location access was denied. Enable location permissions for this site to see nearby clinics.";
      stateEl.classList.add("hidden");
    },
    { enableHighAccuracy: false, timeout: 10000 }
  );
}

requestLocation();
