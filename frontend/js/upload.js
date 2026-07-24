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

fileInput.addEventListener("change", (e) => handleFile(e.target.files[0]));

removeBtn.addEventListener("click", () => {
  selectedFile = null;
  selectedDataUrl = null;
  fileInput.value = "";
  previewWrap.classList.add("hidden");
  dropzone.classList.remove("hidden");
  analyzeBtn.disabled = true;
});

/* ------------------------------------------------------------------ */
/* Live in-page camera capture for "Take photo" -- guarantees this      */
/* button actually opens the camera, rather than delegating to the OS's */
/* file/photo chooser (which is what a plain <input capture> falls back */
/* to on some browsers, indistinguishable from "Upload").                */
/* ------------------------------------------------------------------ */
const takePhotoBtn = document.getElementById("take-photo-btn");
const cameraModal = document.getElementById("camera-modal");
const cameraVideo = document.getElementById("camera-video");
const cameraCanvas = document.getElementById("camera-canvas");
const cameraErrorEl = document.getElementById("camera-error");
const cameraErrorText = document.getElementById("camera-error-text");
const cameraCancelBtn = document.getElementById("camera-cancel-btn");
const cameraShutterBtn = document.getElementById("camera-shutter-btn");
const cameraFlashToggle = document.getElementById("camera-flash-toggle");
const cameraFlashEffect = document.getElementById("camera-flash-effect");

let cameraStream = null;
let isFlashOn = false;

function stopCamera() {
  cameraStream?.getTracks().forEach((track) => track.stop());
  cameraStream = null;
  isFlashOn = false;
  cameraFlashToggle.querySelector(".material-symbols-outlined").textContent = "flash_off";
  cameraFlashToggle.classList.remove("is-active");
  cameraModal.classList.add("hidden");
  cameraErrorEl.classList.add("hidden");
  cameraVideo.classList.remove("hidden");
  cameraVideo.srcObject = null;
}

async function openCamera() {
  cameraModal.classList.remove("hidden");
  cameraErrorEl.classList.add("hidden");
  cameraVideo.classList.remove("hidden");

  if (!navigator.mediaDevices?.getUserMedia) {
    cameraVideo.classList.add("hidden");
    cameraErrorText.textContent = "This browser doesn't support in-page camera capture. Use \"Upload\" instead and select a photo from your camera roll.";
    cameraErrorEl.classList.remove("hidden");
    return;
  }

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
    cameraVideo.srcObject = cameraStream;
  } catch (err) {
    cameraVideo.classList.add("hidden");
    cameraErrorText.textContent =
      err.name === "NotAllowedError"
        ? "Camera access was denied. Allow camera permission for this site, or use \"Upload\" instead."
        : "Couldn't access the camera. Use \"Upload\" instead and select a photo from your camera roll.";
    cameraErrorEl.classList.remove("hidden");
  }
}

takePhotoBtn.addEventListener("click", openCamera);
cameraCancelBtn.addEventListener("click", stopCamera);

cameraFlashToggle.addEventListener("click", () => {
  isFlashOn = !isFlashOn;
  cameraFlashToggle.querySelector(".material-symbols-outlined").textContent = isFlashOn ? "flash_on" : "flash_off";
  cameraFlashToggle.classList.toggle("is-active", isFlashOn);
});

cameraShutterBtn.addEventListener("click", () => {
  if (!cameraStream) return;
  cameraCanvas.width = cameraVideo.videoWidth;
  cameraCanvas.height = cameraVideo.videoHeight;
  cameraCanvas.getContext("2d").drawImage(cameraVideo, 0, 0);

  cameraFlashEffect.classList.add("is-flashing");
  setTimeout(() => cameraFlashEffect.classList.remove("is-flashing"), 100);

  cameraCanvas.toBlob(
    (blob) => {
      if (blob) handleFile(new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" }));
      stopCamera();
    },
    "image/jpeg",
    0.9
  );
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
    const payload = { ...result, bodyPart, refCode: "DZ-" + Date.now().toString(36).toUpperCase() };

    try {
      sessionStorage.setItem("dermalyze_result", JSON.stringify({ ...payload, imageDataUrl: selectedDataUrl }));
    } catch {
      // Image too large for sessionStorage quota — still proceed without the preview.
      sessionStorage.setItem("dermalyze_result", JSON.stringify(payload));
    }
    window.location.href = "results.html";
  } catch (err) {
    if (err.status === 503) {
      // Vertex env vars aren't set at all yet — expected until a model is deployed.
      // Rather than dead-ending the flow here, continue to the results screen with
      // clearly-labeled placeholder data so the rest of the app stays walkable.
      const demoPayload = {
        bodyPart,
        isDemo: true,
        refCode: "DZ-" + Date.now().toString(36).toUpperCase(),
        predictions: [
          { id: "demo-nv", name: "nv", probability: 0.82 },
          { id: "demo-bkl", name: "bkl", probability: 0.11 },
          { id: "demo-mel", name: "mel", probability: 0.07 },
        ],
        report:
          "The real analysis model (Vertex AI) isn't connected yet, so this is placeholder (demo) data. Once the endpoint is deployed, real analysis results will be shown here.",
        texture_note: "Demo data — not a result from real image analysis.",
        pigment_note: "Demo data — not a result from real image analysis.",
        self_care: "Demo data — not a result from real image analysis.",
      };
      try {
        sessionStorage.setItem("dermalyze_result", JSON.stringify({ ...demoPayload, imageDataUrl: selectedDataUrl }));
      } catch {
        sessionStorage.setItem("dermalyze_result", JSON.stringify(demoPayload));
      }
      window.location.href = "results.html";
      return;
    } else if (err.status === 502) {
      // Env vars are set, but the actual Vertex AI call failed (bad endpoint, auth, quota, etc).
      showBanner(errorEl, "The analysis model is connected but the prediction failed: " + err.message);
    } else {
      showBanner(errorEl, err.message);
    }
    setButtonBusy(analyzeBtn, false);
  }
});
