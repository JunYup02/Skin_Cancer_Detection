requireAuth();

const stateEl = document.getElementById("clinics-state");
const listEl = document.getElementById("clinics-list");
const bannerEl = document.getElementById("location-banner");
const chips = document.querySelectorAll(".radius-chip");

let coords = null;
let radiusM = 3000;

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

function statusPill(status) {
  if (!status) return "";
  const open = status === "OPERATIONAL";
  const label = status.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  return `<span class="status-pill ${open ? "status-open" : "status-closed"}">${label}</span>`;
}

function renderClinics(hospitals) {
  stateEl.classList.add("hidden");
  listEl.innerHTML = "";

  if (!hospitals.length) {
    stateEl.classList.remove("hidden");
    stateEl.innerHTML = `
      <span class="material-symbols-outlined">search_off</span>
      <h3>No clinics found nearby</h3>
      <p>Try a wider search radius above.</p>
    `;
    return;
  }

  hospitals.forEach((h) => {
    const card = document.createElement("article");
    card.className = "card clinic-card";
    card.innerHTML = `
      <div class="clinic-head">
        <h4>${h.name}</h4>
        ${statusPill(h.business_status)}
      </div>
      <div class="clinic-meta">
        <span><span class="material-symbols-outlined" style="font-size:18px;">near_me</span>${formatDistance(h.distance_m)}</span>
      </div>
      <p class="text-body-md text-on-surface-variant" style="margin:0;">${h.address}</p>
      <a class="btn btn-primary" href="${h.google_maps_url}" target="_blank" rel="noopener">
        <span class="material-symbols-outlined" style="font-size:18px;">directions</span>
        Get directions
      </a>
    `;
    listEl.appendChild(card);
  });
}

async function loadClinics() {
  if (!coords) return;
  setLoading("Finding nearby dermatology clinics…");
  try {
    const hospitals = await Api.getNearbyHospitals(coords.lat, coords.lng, radiusM);
    renderClinics(hospitals);
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

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => {
      c.classList.remove("active");
      c.style.background = "var(--surface-container-lowest)";
      c.style.color = "var(--on-surface-variant)";
      c.style.borderColor = "var(--outline-variant)";
    });
    chip.classList.add("active");
    chip.style.background = "var(--primary)";
    chip.style.color = "var(--on-primary)";
    chip.style.borderColor = "var(--primary)";
    radiusM = Number(chip.dataset.radius);
    loadClinics();
  });
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
