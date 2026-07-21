requireAuth();

const bodyPartRaw = sessionStorage.getItem("dermalyze_body_part");
if (!bodyPartRaw) {
  window.location.href = "body-part.html";
}
const bodyPart = bodyPartRaw ? JSON.parse(bodyPartRaw) : null;

document.getElementById("region-chip-label").textContent = bodyPart?.label || "—";
document.getElementById("region-chip-label-2").textContent = bodyPart?.label || "—";

const MAX_BYTES = 10 * 1024 * 1024;

const dropzone = document.getElementById("dropzone");
const previewWrap = document.getElementById("preview-wrap");
const previewImg = document.getElementById("preview-img");
const removeBtn = document.getElementById("remove-photo");
const analyzeBtn = document.getElementById("analyze-btn");
const errorEl = document.getElementById("upload-error");
const cameraInput = document.getElementById("camera-input");
const fileInput = document.getElementById("file-input");

let selectedFile = null;
let selectedDataUrl = null;

function handleFile(file) {
  errorEl.classList.add("hidden");
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showBanner(errorEl, "Please choose an image file (JPG or PNG).");
    return;
  }
  if (file.size > MAX_BYTES) {
    showBanner(errorEl, "That image is over the 10MB limit — please choose a smaller file.");
    return;
  }

  selectedFile = file;
  const reader = new FileReader();
  reader.onload = () => {
    selectedDataUrl = reader.result;
    previewImg.src = selectedDataUrl;
    dropzone.classList.add("hidden");
    previewWrap.classList.remove("hidden");
    analyzeBtn.disabled = false;
  };
  reader.readAsDataURL(file);
}

cameraInput.addEventListener("change", (e) => handleFile(e.target.files[0]));
fileInput.addEventListener("change", (e) => handleFile(e.target.files[0]));

removeBtn.addEventListener("click", () => {
  selectedFile = null;
  selectedDataUrl = null;
  cameraInput.value = "";
  fileInput.value = "";
  previewWrap.classList.add("hidden");
  dropzone.classList.remove("hidden");
  analyzeBtn.disabled = true;
});

// Drag-and-drop onto the dropzone (desktop convenience)
["dragover", "dragleave", "drop"].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => e.preventDefault());
});
dropzone.addEventListener("dragover", () => dropzone.classList.add("dragover"));
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
dropzone.addEventListener("drop", (e) => {
  dropzone.classList.remove("dragover");
  const file = e.dataTransfer.files?.[0];
  if (file) handleFile(file);
});

analyzeBtn.addEventListener("click", async () => {
  if (!selectedFile) return;
  errorEl.classList.add("hidden");
  setButtonBusy(analyzeBtn, true, "Analyzing photo…");

  try {
    const result = await Api.createGeminiReport(selectedFile);
    const payload = { ...result, bodyPart };

    try {
      sessionStorage.setItem("dermalyze_result", JSON.stringify({ ...payload, imageDataUrl: selectedDataUrl }));
    } catch {
      // Image too large for sessionStorage quota — still proceed without the preview.
      sessionStorage.setItem("dermalyze_result", JSON.stringify(payload));
    }
    window.location.href = "results.html";
  } catch (err) {
    if (err.status === 502) {
      showBanner(
        errorEl,
        "The analysis model isn't connected yet — once a Vertex AI endpoint is deployed and VERTEX_ENDPOINT_ID is set on the backend, this will work automatically. (" + err.message + ")"
      );
    } else {
      showBanner(errorEl, err.message);
    }
    setButtonBusy(analyzeBtn, false);
  }
});
