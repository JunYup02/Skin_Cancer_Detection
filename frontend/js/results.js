requireAuth();

/**
 * Risk tiering for the HAM10000 classes the Vertex AI AutoML model was
 * trained on (see Dermalyze_data/undersampling). Keyed by the lowercased
 * class `name` the backend returns (ClassPrediction.name = AutoML displayName).
 * mel / bcc / akiec are malignant or pre-malignant; the rest are benign.
 */
const CLASS_INFO = {
  mel: { label: "Melanoma", risk: "high" },
  bcc: { label: "Basal Cell Carcinoma", risk: "high" },
  akiec: { label: "Actinic Keratosis / Intraepithelial Carcinoma", risk: "high" },
  bkl: { label: "Benign Keratosis-like Lesion", risk: "low" },
  nv: { label: "Melanocytic Nevus", risk: "low" },
  vasc: { label: "Vascular Lesion", risk: "low" },
  df: { label: "Dermatofibroma", risk: "low" },
};

function classInfo(prediction) {
  const key = (prediction.name || prediction.id || "").toLowerCase();
  return CLASS_INFO[key] || { label: prediction.name || prediction.id || "Unknown", risk: "low" };
}

const raw = sessionStorage.getItem("dermalyze_result");

const contentEl = document.getElementById("result-content");
const emptyEl = document.getElementById("empty-state");
const unavailableEl = document.getElementById("model-unavailable");

if (!raw) {
  emptyEl.classList.remove("hidden");
} else {
  const data = JSON.parse(raw);
  if (!data.predictions || data.predictions.length === 0) {
    unavailableEl.classList.remove("hidden");
  } else {
    render(data);
  }
}

function render(data) {
  contentEl.classList.remove("hidden");

  if (data.imageDataUrl) {
    document.getElementById("image-section").classList.remove("hidden");
    document.getElementById("result-img").src = data.imageDataUrl;
  }
  document.getElementById("result-region-label").textContent = data.bodyPart?.label || "—";

  const sorted = [...data.predictions].sort((a, b) => b.probability - a.probability);
  const top = sorted[0];
  const info = classInfo(top);
  const pct = Math.round(top.probability * 100);
  const isHigh = info.risk === "high";

  document.getElementById("gauge-percent").textContent = `${pct}%`;
  document.getElementById("gauge-label").textContent = info.label;

  const fill = document.getElementById("gauge-fill");
  fill.setAttribute("stroke-dasharray", `${pct}, 100`);
  fill.classList.add(isHigh ? "error" : "ok");

  const badge = document.getElementById("risk-badge");
  badge.classList.add(isHigh ? "badge-error" : "badge-success");
  badge.innerHTML = `
    <span class="material-symbols-outlined icon-filled" style="font-size:18px;">${isHigh ? "warning" : "check_circle"}</span>
    <span>${isHigh ? "Higher-risk pattern" : "Lower-risk pattern"}</span>
  `;

  document.getElementById("gemini-report").textContent =
    data.report || "No written summary was returned for this analysis.";

  const others = sorted.slice(1, 5);
  if (others.length) {
    document.getElementById("rank-section").style.display = "flex";
    const list = document.getElementById("rank-list");
    others.forEach((p) => {
      const otherInfo = classInfo(p);
      const otherPct = Math.round(p.probability * 100);
      const row = document.createElement("div");
      row.className = "rank-row";
      row.innerHTML = `
        <span class="rank-name">${otherInfo.label}</span>
        <span class="rank-bar-track"><span class="rank-bar-fill" style="width:${otherPct}%;"></span></span>
        <span class="rank-pct">${otherPct}%</span>
      `;
      list.appendChild(row);
    });
  }

  if (isHigh) {
    document.getElementById("clinic-cta").classList.remove("hidden");
  }

  document.getElementById("print-btn").addEventListener("click", () => window.print());
}
