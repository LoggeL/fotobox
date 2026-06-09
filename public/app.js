// Fotobox-Frontend: Sucher -> Countdown -> Aufnahme -> Vorschau -> QR on demand

const finder = document.getElementById("finder");
const canvas = document.getElementById("capture-canvas");
const preview = document.getElementById("preview");
const countdownEl = document.getElementById("countdown");
const countdownNum = document.getElementById("countdown-number");
const flash = document.getElementById("flash");
const controlsLive = document.getElementById("controls-live");
const controlsReview = document.getElementById("controls-review");
const btnCapture = document.getElementById("btn-capture");
const btnRetake = document.getElementById("btn-retake");
const btnQr = document.getElementById("btn-qr");
const btnQrClose = document.getElementById("btn-qr-close");
const qrOverlay = document.getElementById("qr-overlay");
const qrHolder = document.getElementById("qr-holder");
const errorBox = document.getElementById("error-box");

const COUNTDOWN_SECONDS = 3;

let currentDataUrl = null; // JPEG der letzten Aufnahme
let currentId = null;      // Server-ID, sobald hochgeladen
let busy = false;

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.hidden = false;
  setTimeout(() => (errorBox.hidden = true), 4000);
}

async function startCamera() {
  try {
    // moderate Aufloesung + 30 fps: bei max. Aufloesung drosseln viele Webcams
    // die Framerate massiv, der 4:3-Zuschnitt passiert ohnehin im Canvas
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 960 },
        frameRate: { ideal: 30 },
        facingMode: "user",
      },
      audio: false,
    });
    finder.srcObject = stream;
  } catch (err) {
    showError("Kamera nicht verfügbar: " + err.message);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runCountdown() {
  countdownEl.hidden = false;
  for (let n = COUNTDOWN_SECONDS; n >= 1; n--) {
    countdownNum.textContent = n;
    // Animation neu anstossen
    countdownNum.style.animation = "none";
    void countdownNum.offsetWidth;
    countdownNum.style.animation = "";
    await sleep(1000);
  }
  countdownEl.hidden = true;
}

function takePhoto() {
  const w = finder.videoWidth;
  const h = finder.videoHeight;
  if (!w || !h) throw new Error("Kein Kamerabild");

  // auf 4:3 zuschneiden (mittig), Foto ungespiegelt
  const targetRatio = 4 / 3;
  let sw = w, sh = h, sx = 0, sy = 0;
  if (w / h > targetRatio) {
    sw = Math.round(h * targetRatio);
    sx = Math.round((w - sw) / 2);
  } else {
    sh = Math.round(w / targetRatio);
    sy = Math.round((h - sh) / 2);
  }
  canvas.width = sw;
  canvas.height = sh;
  canvas.getContext("2d").drawImage(finder, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas.toDataURL("image/jpeg", 0.92);
}

async function onCapture() {
  if (busy) return;
  busy = true;
  controlsLive.hidden = true;
  try {
    await runCountdown();
    flash.classList.remove("zap");
    void flash.offsetWidth;
    flash.classList.add("zap");

    currentDataUrl = takePhoto();
    currentId = null;

    preview.src = currentDataUrl;
    preview.hidden = false;
    controlsReview.hidden = false;
  } catch (err) {
    showError(err.message);
    controlsLive.hidden = false;
  } finally {
    busy = false;
  }
}

function backToFinder() {
  preview.hidden = true;
  qrOverlay.hidden = true;
  controlsReview.hidden = true;
  controlsLive.hidden = false;
  currentDataUrl = null;
  currentId = null;
}

async function uploadIfNeeded() {
  if (currentId) return currentId;
  const res = await fetch("/api/photos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: currentDataUrl }),
  });
  if (!res.ok) throw new Error("Upload fehlgeschlagen");
  const { id } = await res.json();
  currentId = id;
  return id;
}

async function onShowQr() {
  if (!currentDataUrl || busy) return;
  busy = true;
  btnQr.disabled = true;
  try {
    const id = await uploadIfNeeded();
    const res = await fetch(`/api/photos/${id}/qr`);
    if (!res.ok) throw new Error("QR-Code fehlgeschlagen");
    qrHolder.innerHTML = await res.text();
    qrOverlay.hidden = false;
  } catch (err) {
    showError(err.message);
  } finally {
    btnQr.disabled = false;
    busy = false;
  }
}

btnCapture.addEventListener("click", onCapture);
btnRetake.addEventListener("click", backToFinder);
btnQr.addEventListener("click", onShowQr);
btnQrClose.addEventListener("click", () => (qrOverlay.hidden = true));

startCamera();
