requireAuth();

const history = getScanHistory();

const statScans = document.getElementById("stat-scans");
const statLatest = document.getElementById("stat-latest");
const statStatus = document.getElementById("stat-status");
const listEl = document.getElementById("activity-list");
const emptyEl = document.getElementById("activity-empty");
const seeAllBtn = document.getElementById("see-all-btn");

const STATUS_BY_RISK = { low: "Stable", high: "Review" };

statScans.textContent = history.length;
if (history.length) {
  statLatest.textContent = relativeTime(history[0].timestamp);
  statStatus.textContent = STATUS_BY_RISK[history[0].risk] || "—";
} else {
  statLatest.textContent = "—";
  statStatus.textContent = "—";
}

function renderCard(record) {
  const el = document.createElement(record.resultPayload ? "a" : "div");
  el.className = "activity-card";
  if (record.resultPayload) {
    el.href = "#";
    el.addEventListener("click", (e) => {
      e.preventDefault();
      sessionStorage.setItem("dermalyze_result", JSON.stringify(record.resultPayload));
      window.location.href = "results.html";
    });
  }
  el.innerHTML = `
    ${record.imageDataUrl ? `<img class="thumb" src="${record.imageDataUrl}" alt="">` : ""}
    <div class="body">
      <div class="meta-row">
        <span class="when">${relativeTime(record.timestamp)} · ${record.region_label || "—"}</span>
        <span class="risk-pill ${record.risk}">${record.risk} risk</span>
      </div>
      <p class="finding">${record.finding_text || ""}</p>
      ${record.resultPayload ? '<span class="view-link">View details <span class="material-symbols-outlined" style="font-size:16px;">chevron_right</span></span>' : ""}
    </div>
  `;
  return el;
}

function render(showAll) {
  listEl.innerHTML = "";
  if (!history.length) {
    emptyEl.classList.remove("hidden");
    seeAllBtn.classList.add("hidden");
    return;
  }
  emptyEl.classList.add("hidden");
  const visible = showAll ? history : history.slice(0, 3);
  visible.forEach((r) => listEl.appendChild(renderCard(r)));
  if (history.length > 3) {
    seeAllBtn.classList.remove("hidden");
    seeAllBtn.textContent = showAll ? "Show less" : "See all";
  }
}

let expanded = false;
seeAllBtn.addEventListener("click", () => {
  expanded = !expanded;
  render(expanded);
});

render(false);
