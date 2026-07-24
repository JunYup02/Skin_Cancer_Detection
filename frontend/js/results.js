requireAuth();

/**
 * Risk tiering for the HAM10000 classes the Vertex AI AutoML model was
 * trained on (see Dermalyze_data/undersampling). Keyed by the lowercased
 * class `name` the backend returns (ClassPrediction.name = AutoML displayName).
 *
 * mel (melanoma), bcc (basal cell carcinoma), and akiec (actinic keratosis /
 * early intraepithelial carcinoma) are malignant/pre-malignant -> high.
 * nv, bkl, vasc, df are benign -> low. Two tiers only (no "moderate") --
 * a finding is either something to get checked promptly, or not.
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

const RISK_COPY = {
  high: {
    pill: "High-risk lesion",
    icon: "warning",
    subtitle: "High risk of malignancy detected. Immediate specialist consultation is recommended.",
    printLabel: "Download urgent clinical report",
  },
  low: {
    pill: "Lower-risk lesion",
    icon: "check_circle",
    subtitle: "Non-concerning visual patterns detected.",
    ctaVariant: "btn-outline",
    ctaIcon: "calendar_month",
    ctaLabel: "Find a clinic near you",
    printLabel: "Download PDF report",
  },
};

function makeRefCode() {
  return "DZ-" + Date.now().toString(36).toUpperCase();
}

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

  if (data.isDemo) {
    const demoBanner = document.createElement("div");
    demoBanner.className = "banner";
    demoBanner.style.background = "var(--notice-bg)";
    demoBanner.style.color = "var(--notice-fg)";
    demoBanner.innerHTML = `
      <span class="material-symbols-outlined">science</span>
      <span>Demo data — the Vertex AI model isn't connected yet, so this is placeholder output, not a real analysis.</span>
    `;
    contentEl.prepend(demoBanner);
  }

  const sorted = [...data.predictions].sort((a, b) => b.probability - a.probability);
  const top = sorted[0];
  const info = classInfo(top);
  const risk = info.risk;
  const refCode = data.refCode || makeRefCode();

  if (data.imageDataUrl) {
    document.getElementById("image-section").classList.remove("hidden");
    document.getElementById("result-img").src = data.imageDataUrl;
    // High-risk findings get a red pulsing alert border on the photo itself.
    document.getElementById("preview-frame").classList.toggle("risk-high", risk === "high");
  }
  document.getElementById("result-region-label").textContent = data.bodyPart?.label || "—";

  document.getElementById("result-classification").textContent = info.label;
  document.getElementById("result-subtitle").textContent = RISK_COPY[risk].subtitle;
  document.getElementById("result-ref").textContent = `Ref: #${refCode}`;

  // High-risk results get a red-tinted card + note cards, matching the Stitch
  // high-risk mockup's all-red treatment (image border, cards, urgent button).
  document.getElementById("result-card").classList.toggle("risk-high", risk === "high");
  document.getElementById("note-grid").classList.toggle("risk-high", risk === "high");

  const badge = document.getElementById("risk-badge");
  badge.classList.add(risk);
  badge.innerHTML = `
    <span class="material-symbols-outlined icon-filled" style="font-size:16px;">${RISK_COPY[risk].icon}</span>
    <span>${RISK_COPY[risk].pill}</span>
  `;

  document.getElementById("result-success").classList.toggle("hidden", risk !== "low");

  document.getElementById("gemini-report").textContent =
    data.report || "No written summary was returned for this analysis.";
  document.getElementById("texture-note").textContent = data.texture_note || "Not available.";
  document.getElementById("pigment-note").textContent = data.pigment_note || "Not available.";

  if (risk === "high") {
    // High risk: search automatically instead of a manual CTA. No generic
    // "find a clinic" button here -- the inline results below are the whole UI.
    document.getElementById("auto-clinics").classList.remove("hidden");
    autoFetchNearbyClinics();
  } else {
    // Low risk: still offered, just not urgent (outline button).
    const cta = document.getElementById("clinic-cta");
    cta.classList.remove("hidden", "btn-primary", "btn-outline");
    cta.classList.add(RISK_COPY[risk].ctaVariant);
    document.getElementById("clinic-cta-icon").textContent = RISK_COPY[risk].ctaIcon;
    document.getElementById("clinic-cta-label").textContent = RISK_COPY[risk].ctaLabel;
  }

  document.getElementById("print-btn-label").textContent = RISK_COPY[risk].printLabel;
  document.getElementById("print-btn").addEventListener("click", () =>
    downloadPdfReport(data, { info, risk, refCode })
  );

  // Save this completed analysis into the (local, per-browser) scan history so it
  // shows up on the dashboard — see js/history.js for why this isn't backend-persisted.
  // Demo results (no Vertex endpoint connected) are deliberately not saved, since
  // they aren't a real analysis.
  if (!data.isDemo) {
    saveScanRecord({
      region_label: data.bodyPart?.label || "—",
      risk,
      top_label: info.label,
      top_probability: top.probability,
      finding_text: data.texture_note || data.report?.slice(0, 100) || "",
      imageDataUrl: data.imageDataUrl,
      resultPayload: data,
    });
  }
}

/* ------------------------------------------------------------------ */
/* High risk: search nearby clinics automatically, no click required.  */
/* ------------------------------------------------------------------ */
function autoFetchNearbyClinics() {
  const stateEl = document.getElementById("auto-clinics-state");
  const listEl = document.getElementById("auto-clinics-list");

  function fail(message) {
    stateEl.innerHTML = `
      <span class="material-symbols-outlined">location_off</span>
      <p>${message}</p>
      <a href="hospitals.html" class="btn btn-outline">
        <span class="material-symbols-outlined">medical_services</span>
        Search clinics manually
      </a>
    `;
  }

  if (!navigator.geolocation) {
    fail("This browser doesn't support location lookup — open Clinics to search manually.");
    return;
  }

  // The clinic lookup runs against a free, shared community service (no API key) that
  // can be slow or briefly rate-limited under load. Auto-search is a nicety, not the
  // only path to clinics, so time out and hand off to the manual Clinics tab instead
  // of leaving a spinner running forever.
  const AUTO_SEARCH_TIMEOUT_MS = 12000;

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      try {
        const hospitals = await Promise.race([
          Api.getNearbyHospitals(position.coords.latitude, position.coords.longitude, 5000),
          new Promise((_, reject) => setTimeout(() => reject(new Error("timed out")), AUTO_SEARCH_TIMEOUT_MS)),
        ]);
        stateEl.classList.add("hidden");
        if (!hospitals.length) {
          listEl.innerHTML = `<p class="text-body-md text-outline">No clinics found nearby — try the Clinics tab for a wider search.</p>`;
          return;
        }
        hospitals.slice(0, 3).forEach((h) => {
          const distanceText = h.distance_m < 1000 ? `${Math.round(h.distance_m)} m` : `${(h.distance_m / 1000).toFixed(1)} km`;
          const row = document.createElement("a");
          row.className = "card";
          row.style.cssText = "display:flex; align-items:center; gap:12px; text-decoration:none; padding:14px 16px;";
          row.href = h.google_maps_url;
          row.target = "_blank";
          row.rel = "noopener";
          row.innerHTML = `
            <span class="material-symbols-outlined text-primary">location_on</span>
            <span style="flex:1; min-width:0;">
              <span style="display:block; font-weight:600; font-size:14px; color:var(--on-surface); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${h.name}</span>
              <span style="display:block; font-size:12.5px; color:var(--outline);">${distanceText} away</span>
            </span>
            <span class="material-symbols-outlined text-outline">chevron_right</span>
          `;
          listEl.appendChild(row);
        });
        const viewAll = document.createElement("a");
        viewAll.href = "hospitals.html";
        viewAll.className = "btn btn-outline";
        viewAll.innerHTML = `<span class="material-symbols-outlined">medical_services</span>View all nearby clinics`;
        listEl.appendChild(viewAll);
      } catch (err) {
        fail(
          err.message === "timed out"
            ? "This is taking longer than expected."
            : `Couldn't load nearby clinics: ${err.message}`
        );
      }
    },
    () => fail("Location access was denied — open Clinics to search manually."),
    { enableHighAccuracy: false, timeout: 10000 }
  );
}

/* ------------------------------------------------------------------ */
/* Real PDF report: vector text (a Korean font is embedded for jsPDF),  */
/* built from the same Gemini-generated fields shown on screen -- not   */
/* a screenshot of the page.                                            */
/* ------------------------------------------------------------------ */
let pdfLibsPromise = null;
function loadPdfLibs() {
  if (pdfLibsPromise) return pdfLibsPromise;
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(s);
    });
  }
  pdfLibsPromise = loadScript("https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js").then(() =>
    loadScript("assets/fonts/NotoSansKR-normal.js")
  );
  return pdfLibsPromise;
}

// data URL -> the format string jsPDF's addImage() wants, e.g. "data:image/jpeg;..." -> "JPEG".
function pdfImageFormat(dataUrl) {
  const match = /^data:image\/(\w+);/.exec(dataUrl || "");
  const ext = (match?.[1] || "jpeg").toLowerCase();
  return ext === "jpg" ? "JPEG" : ext.toUpperCase();
}

// Brand palette for the PDF, lifted from the design tokens in css/style.css so the
// export doesn't look like a different product from the app around it.
const PDF_COLOR = {
  primary: [0, 106, 99], // --primary
  onSurface: [23, 29, 28], // --on-surface
  onSurfaceVariant: [61, 73, 71], // --on-surface-variant
  outlineVariant: [188, 201, 199], // --outline-variant
  cardBg: [239, 245, 243], // --surface-container-low
  muted: [110, 122, 119],
};
const PDF_RISK_COLOR = {
  low: { bg: [225, 240, 229], fg: [30, 107, 58] }, // --risk-low-bg/fg
  high: { bg: [255, 218, 214], fg: [147, 0, 10] }, // --risk-high-bg/fg
};
const PDF_NOTICE_COLOR = { bg: [253, 234, 210], fg: [138, 74, 16] }; // --notice-bg/fg

// Note: percentages are intentionally never rendered anywhere in this PDF -- the
// model's confidence score isn't shown to avoid implying false precision -- and every
// text field going in (report/texture_note/pigment_note/self_care) is already
// constrained to English-only by the backend prompt in app/services/gemini_report.py.
async function downloadPdfReport(data, { info, risk, refCode }) {
  const btn = document.getElementById("print-btn");
  setButtonBusy(btn, true, "Preparing PDF…");
  try {
    await loadPdfLibs();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    // Registered on the instance (not the API prototype) -- this is the reliable path
    // in jsPDF v2.x; the old addFileToVFS/addFont-before-instantiation pattern from
    // jsPDF's fontconverter tool throws internally on recent versions.
    doc.addFileToVFS("NotoSansKR-Regular.ttf", window.__NOTO_SANS_KR_BASE64__);
    doc.addFont("NotoSansKR-Regular.ttf", "NotoSansKR", "normal");
    doc.setFont("NotoSansKR", "normal");

    const margin = 48;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    function ensureSpace(needed) {
      if (y + needed > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
    }
    function resetInk() {
      doc.setTextColor(...PDF_COLOR.onSurface);
      doc.setDrawColor(...PDF_COLOR.outlineVariant);
    }

    // A titled, shaded card with a colored accent bar -- used for every prose section
    // so the report reads as distinct blocks instead of one long column of paragraphs.
    function sectionCard(title, bodyText, accent = PDF_COLOR.primary) {
      const paddingX = 16;
      const paddingV = 14;
      const titleSize = 11.5;
      const bodySize = 10.5;
      const bodyLineHeight = bodySize * 1.45;

      doc.setFontSize(bodySize);
      const lines = doc.splitTextToSize(bodyText, contentWidth - paddingX * 2);
      const cardH = paddingV * 2 + titleSize * 1.3 + lines.length * bodyLineHeight;

      ensureSpace(cardH + 14);
      doc.setFillColor(...PDF_COLOR.cardBg);
      doc.roundedRect(margin, y, contentWidth, cardH, 8, 8, "F");
      doc.setFillColor(...accent);
      doc.roundedRect(margin, y, 4, cardH, 2, 2, "F");

      doc.setFontSize(titleSize);
      doc.setTextColor(...PDF_COLOR.onSurface);
      doc.text(title, margin + paddingX, y + paddingV + titleSize * 0.8);

      doc.setFontSize(bodySize);
      doc.setTextColor(...PDF_COLOR.onSurfaceVariant);
      doc.text(lines, margin + paddingX, y + paddingV + titleSize * 1.3 + bodySize * 0.9);

      y += cardH + 14;
      resetInk();
    }

    // ---- Header band ----
    const headerH = 84;
    doc.setFillColor(...PDF_COLOR.primary);
    doc.rect(0, 0, pageWidth, headerH, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text("Dermalyze — AI Skin Analysis Report", margin, 36);
    doc.setFontSize(10);
    doc.setTextColor(210, 232, 229);
    doc.text(`${new Date().toLocaleString()}   ·   Ref #${refCode}`, margin, 56);
    resetInk();
    y = headerH + 26;

    // ---- Photo ----
    if (data.imageDataUrl) {
      try {
        const imgW = 150;
        const imgH = 150;
        ensureSpace(imgH + 14);
        doc.setDrawColor(...PDF_COLOR.outlineVariant);
        doc.roundedRect(margin - 1, y - 1, imgW + 2, imgH + 2, 6, 6, "S");
        doc.addImage(data.imageDataUrl, pdfImageFormat(data.imageDataUrl), margin, y, imgW, imgH);
        y += imgH + 18;
      } catch {
        // Some browsers hand back an image format jsPDF can't decode -- the report
        // is still useful without the photo, so skip it rather than fail the export.
      }
    }

    // ---- Risk badge + classification ----
    const riskColors = PDF_RISK_COLOR[risk] || PDF_RISK_COLOR.low;
    const riskLabel = `${risk.toUpperCase()} RISK`;
    doc.setFontSize(10);
    const badgeW = doc.getTextWidth(riskLabel) + 26;
    const badgeH = 21;
    ensureSpace(badgeH + 8);
    doc.setFillColor(...riskColors.bg);
    doc.roundedRect(margin, y, badgeW, badgeH, badgeH / 2, badgeH / 2, "F");
    doc.setTextColor(...riskColors.fg);
    doc.text(riskLabel, margin + 13, y + badgeH / 2 + 3.5);
    resetInk();
    y += badgeH + 16;

    doc.setFontSize(16);
    doc.text(info.label, margin, y);
    y += 18;
    doc.setFontSize(10.5);
    doc.setTextColor(...PDF_COLOR.muted);
    doc.text(`Region: ${data.bodyPart?.label || "—"}`, margin, y);
    resetInk();
    y += 22;

    if (data.isDemo) {
      const demoText = "This is placeholder demo output — no Vertex AI model was connected when it was generated.";
      doc.setFontSize(9.5);
      const lines = doc.splitTextToSize(demoText, contentWidth - 24);
      const boxH = 14 * 2 + lines.length * 13;
      ensureSpace(boxH + 14);
      doc.setFillColor(...PDF_NOTICE_COLOR.bg);
      doc.roundedRect(margin, y, contentWidth, boxH, 6, 6, "F");
      doc.setTextColor(...PDF_NOTICE_COLOR.fg);
      doc.text(lines, margin + 12, y + 18);
      resetInk();
      y += boxH + 14;
    }

    sectionCard("Summary", data.report || "No written summary was returned for this analysis.");
    sectionCard("Texture", data.texture_note || "Not available.");
    sectionCard("Pigment", data.pigment_note || "Not available.");
    if (risk === "low" && data.self_care) {
      sectionCard("Self-care tips", data.self_care, PDF_RISK_COLOR.low.fg);
    }

    ensureSpace(48);
    doc.setDrawColor(...PDF_COLOR.outlineVariant);
    doc.line(margin, y, pageWidth - margin, y);
    y += 18;
    doc.setFontSize(9);
    doc.setTextColor(...PDF_COLOR.muted);
    const disclaimer = doc.splitTextToSize(
      "For reference only. This AI-generated analysis is for informational purposes only and is not a " +
        "clinical diagnosis. Always consult a licensed dermatologist for medical advice before making any " +
        "health-related decisions.",
      contentWidth
    );
    ensureSpace(disclaimer.length * 9 * 1.5);
    doc.text(disclaimer, margin, y);

    const stamp = new Date().toISOString().slice(0, 10);
    doc.save(`dermalyze-report-${stamp}.pdf`);
  } catch (err) {
    alert("Couldn't generate the PDF: " + err.message);
  } finally {
    setButtonBusy(btn, false);
  }
}
