requireAuth();

const state = { view: "front", region: null };

const frontBtn = document.getElementById("front-view-btn");
const backBtn = document.getElementById("back-view-btn");
const listEl = document.getElementById("regions-list");
const stateEl = document.getElementById("regions-state");
const errorEl = document.getElementById("body-part-error");
const nextBtn = document.getElementById("next-step-btn");

function setView(view) {
  state.view = view;
  frontBtn.classList.toggle("active", view === "front");
  backBtn.classList.toggle("active", view === "back");
  render();
}
frontBtn.addEventListener("click", () => setView("front"));
backBtn.addEventListener("click", () => setView("back"));

let regions = [];

function labelFor(region) {
  // "torso" reads as "Back" once the user is looking at the back view (matches
  // the backend's normalize_body_part: back + torso -> "back").
  if (state.view === "back" && region.key === "torso") return "Back / Trunk";
  return region.label;
}

function render() {
  listEl.innerHTML = "";
  regions.forEach((region) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "zone-item";
    if (state.region === region.key) row.classList.add("selected");
    row.innerHTML = `
      <span class="zone-label">
        <span class="material-symbols-outlined">accessibility_new</span>
        ${labelFor(region)}
      </span>
      <span class="material-symbols-outlined check-icon icon-filled">check_circle</span>
    `;
    row.addEventListener("click", () => {
      state.region = region.key;
      nextBtn.disabled = false;
      render();
      if (window.navigator.vibrate) window.navigator.vibrate(10);
    });
    listEl.appendChild(row);
  });
}

async function loadRegions() {
  try {
    const data = await Api.getBodyRegions();
    regions = data.regions;
    stateEl.classList.add("hidden");
    render();
  } catch (err) {
    stateEl.innerHTML = `
      <span class="material-symbols-outlined text-error">error</span>
      <h3>Couldn't load body regions</h3>
      <p>${err.message}</p>
      <button class="btn btn-outline" id="retry-regions">Try again</button>
    `;
    document.getElementById("retry-regions").addEventListener("click", loadRegions);
  }
}
loadRegions();

nextBtn.addEventListener("click", async () => {
  if (!state.region) return;
  errorEl.classList.add("hidden");
  setButtonBusy(nextBtn, true, "Saving…");
  try {
    const result = await Api.postBodyPart(state.view, state.region);
    sessionStorage.setItem(
      "dermalyze_body_part",
      JSON.stringify({
        view: state.view,
        region: state.region,
        normalized_region: result.normalized_region,
        label: labelFor(regions.find((r) => r.key === state.region)),
      })
    );
    window.location.href = "upload.html";
  } catch (err) {
    showBanner(errorEl, err.message);
    setButtonBusy(nextBtn, false);
  }
});
