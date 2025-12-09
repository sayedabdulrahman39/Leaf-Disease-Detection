/* main.js — final UI + falling leaves + theme toggler + core logic */

// CONFIG
const SERVER_URL = 'http://127.0.0.1:5000'; // change to PC LAN IP if testing from phone
const PREDICT_ENDPOINT = SERVER_URL + '/predict';
const LEAF_COUNT = 16;

// DOM
const fileInput = document.getElementById('fileInput');
const uploadedImg = document.getElementById('uploadedImg');
const uploadAnalyzeBtn = document.getElementById('uploadAnalyzeBtn');

const startCamBtn = document.getElementById('startCamBtn');
const stopCamBtn = document.getElementById('stopCamBtn');
const snapBtn = document.getElementById('snapBtn');
const camVideo = document.getElementById('cam');
const snapCanvas = document.getElementById('snapCanvas');
const camImg = document.getElementById('camImg');

const resultArea = document.getElementById('resultArea');
const leafLayer = document.getElementById('leaf-layer');
const themeToggle = document.getElementById('themeToggle');

let stream = null;
let isRequestInProgress = false;

// THEME
function getSavedTheme() {
  try { return localStorage.getItem('theme') || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); }
  catch(e){ return 'light'; }
}
function applyTheme(t) {
  if (t === 'dark') document.documentElement.classList.add('dark');
  else document.documentElement.classList.remove('dark');
  if (themeToggle) themeToggle.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
  if (themeToggle) {
    const moon = themeToggle.querySelector('.moon'), sun = themeToggle.querySelector('.sun');
    if (moon && sun) { moon.style.display = t === 'dark' ? 'none' : 'inline'; sun.style.display = t === 'dark' ? 'inline' : 'none'; }
  }
  updateLeafColors(t);
}
function toggleTheme() {
  const current = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try { localStorage.setItem('theme', next); } catch(e){}
}
themeToggle && themeToggle.addEventListener('click', toggleTheme);
applyTheme(getSavedTheme());

// LEAVES
function leafSvgPath() {
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M32 4c12 0 28 10 28 28 0 12-10 24-28 28 0 0-4-16-28-28C4 16 20 4 32 4z"></path></svg>`;
}
function rand(min,max){ return Math.random()*(max-min)+min; }

function createLeaves(count) {
  if (!leafLayer) return;
  leafLayer.innerHTML = '';
  for (let i=0;i<count;i++){
    const el = document.createElement('div');
    el.className = 'leaf';
    const left = rand(-5, 105);
    const delay = rand(0, 8);
    const duration = rand(10, 26);
    const scale = rand(0.7, 1.2);
    const rotate = rand(-40, 40);
    el.style.left = left + 'vw';
    el.style.top = rand(-20, -5) + 'vh';
    el.style.width = Math.round(28 * scale) + 'px';
    el.style.height = Math.round(28 * scale) + 'px';
    el.style.transform = `rotate(${rotate}deg)`;
    el.style.opacity = (0.6 + Math.random()*0.4).toFixed(2);
    el.style.animation = `fall ${duration}s linear ${delay}s infinite`;
    el.innerHTML = leafSvgPath();
    const path = el.querySelector('svg path');
    if (path) {
      const fill = getComputedStyle(document.documentElement).getPropertyValue('--leaf-color-1').trim() || '#2b7a78';
      path.setAttribute('fill', fill);
    }
    leafLayer.appendChild(el);
    (function sway(node) {
      const t = rand(4000, 9000);
      node.animate([
        { transform: node.style.transform + ' translateX(0px)' },
        { transform: node.style.transform + ' translateX(' + rand(-18, 18).toFixed(0) + 'px)' },
        { transform: node.style.transform + ' translateX(0px)' }
      ], { duration: t, iterations: Infinity, easing: 'ease-in-out', delay: delay*1000 });
    })(el);
  }
}
function updateLeafColors() {
  const paths = leafLayer.querySelectorAll('svg path');
  const fill = getComputedStyle(document.documentElement).getPropertyValue('--leaf-color-1').trim() || '#2b7a78';
  paths.forEach(p => p.setAttribute('fill', fill));
}
createLeaves(LEAF_COUNT);
updateLeafColors();
new MutationObserver(() => { createLeaves(LEAF_COUNT); updateLeafColors(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

// CORE APP
function setControlsDisabled(disabled) {
  uploadAnalyzeBtn.disabled = disabled;
  startCamBtn.disabled = disabled;
  stopCamBtn.disabled = disabled;
  snapBtn.disabled = disabled;
  fileInput.disabled = disabled;
  isRequestInProgress = disabled;
}
function updatePreviewEmpty(previewEl) {
  const empty = previewEl.querySelector('.preview-empty');
  const img = previewEl.querySelector('img');
  if (img && img.src) { if (empty) empty.style.display = 'none'; }
  else { if (empty) empty.style.display = 'block'; }
}

fileInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  uploadedImg.src = url;
  updatePreviewEmpty(document.getElementById('uploadPreview'));
  resultArea.innerHTML = `<p class="hint">Ready to analyze.</p>`;
});

uploadAnalyzeBtn.addEventListener('click', async () => {
  const file = fileInput.files[0];
  if (!file) { alert('Please choose an image file first.'); return; }
  await sendImageFile(file);
});

startCamBtn.addEventListener('click', async () => {
  if (stream) return;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    camVideo.srcObject = stream;
    camVideo.play();
    resultArea.innerHTML = `<p class="hint">Camera started — click Capture & Analyze.</p>`;
  } catch (err) {
    alert('Unable to access camera. Allow camera permission or use a secure context (https).');
    console.error('Camera error:', err);
  }
});
stopCamBtn.addEventListener('click', () => {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
    camVideo.srcObject = null;
    resultArea.innerHTML = `<p class="hint">Camera stopped.</p>`;
  }
});

snapBtn.addEventListener('click', async () => {
  if (!stream) { alert('Start the camera first.'); return; }
  const ctx = snapCanvas.getContext('2d');
  ctx.drawImage(camVideo, 0, 0, snapCanvas.width, snapCanvas.height);
  snapCanvas.toBlob(async (blob) => {
    camImg.src = URL.createObjectURL(blob);
    updatePreviewEmpty(document.getElementById('camPreview'));
    await sendImageFile(new File([blob], 'camera.png', { type: 'image/png' }));
  }, 'image/png');
});

async function sendImageFile(file) {
  if (isRequestInProgress) { console.warn('Request already in progress — ignoring new request.'); return; }
  showResult({ status: 'loading' });
  setControlsDisabled(true);
  try {
    const fd = new FormData();
    fd.append('image', file);
    const res = await fetch(PREDICT_ENDPOINT, { method: 'POST', body: fd });
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      if (!res.ok) throw new Error(`Server returned ${res.status}: ${JSON.stringify(json)}`);
      showResult({ status: 'ok', data: json });
    } catch (parseErr) {
      if (!res.ok) showResult({ status: 'error', error: `Server error ${res.status}: ${text}` });
      else showResult({ status: 'error', error: 'Invalid response from server (not JSON).' });
    }
  } catch (err) {
    console.error('Fetch/network error:', err);
    showResult({ status: 'error', error: err.message || String(err) });
  } finally {
    setControlsDisabled(false);
  }
}

function showResult(payload) {
  if (payload.status === 'loading') {
    resultArea.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px">
        <div class="tiny-spinner" aria-hidden="true" style="width:18px;height:18px;border-radius:50%;border:3px solid rgba(0,0,0,0.08);border-top-color:var(--accent);animation:spin .9s linear infinite"></div>
        <div class="hint">Analyzing... <small style="color:var(--muted)">waiting response from server</small></div>
      </div>`;
    return;
  }
  if (payload.status === 'error') {
    resultArea.innerHTML = `<p class="hint">Error: ${escapeHtml(payload.error || 'Unknown error')}</p>`;
    return;
  }
  const data = payload.data;
  if (!data) { resultArea.innerHTML = `<p class="hint">No result data returned from server.</p>`; return; }

  const cls = data.class || 'Unknown';
  let confVal = 0;
  if (typeof data.confidence === 'number') confVal = data.confidence;
  else if (typeof data.confidence === 'string' && !isNaN(Number(data.confidence))) confVal = Number(data.confidence);
  confVal = Math.max(0, Math.min(1, confVal));
  const tips = data.tips || '';

  const healthyClass = cls.toLowerCase().includes('healthy');
  const clsHtml = `<div class="result-title">Prediction: <span class="${healthyClass ? 'result-ok' : 'result-bad'}">${escapeHtml(cls)}</span></div>`;
  const confHtml = `<div><strong>Confidence:</strong> ${(confVal*100).toFixed(1)}%</div>`;
  const barHtml = `<div class="confidence" aria-hidden="true"><i style="width:${(confVal*100).toFixed(1)}%"></i></div>`;
  const tipsHtml = tips ? `<div style="margin-top:8px"><strong>Suggested action:</strong><div>${escapeHtml(tips)}</div></div>` : '';

  resultArea.innerHTML = `
    <div class="result-row">
      <div style="min-width:220px">${clsHtml}${confHtml}</div>
      <div style="flex:1">${barHtml}</div>
    </div>
    ${tipsHtml}
  `;
}

function escapeHtml(text) {
  if (!text && text !== 0) return '';
  return String(text).replace(/[&<>"'`=\/]/g, function (s) {
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','/':'&#x2F;','`':'&#x60;','=':'&#x3D;'} )[s];
  });
}

// quick URL test helper
window.testPredictWithUrl = async function(imageUrl) {
  try {
    uploadedImg.src = imageUrl; updatePreviewEmpty(document.getElementById('uploadPreview'));
    const imgResp = await fetch(imageUrl); const blob = await imgResp.blob();
    const fd = new FormData(); fd.append('image', blob, 'test.jpg');
    showResult({ status: 'loading' }); setControlsDisabled(true);
    const r = await fetch(PREDICT_ENDPOINT, { method: 'POST', body: fd });
    const t = await r.text();
    try { const json = JSON.parse(t); showResult({ status:'ok', data:json }); } catch(e) { showResult({status:'error', error:t}); }
  } catch(e) { console.error('testPredictWithUrl error:', e); showResult({ status:'error', error:String(e)}); }
  finally { setControlsDisabled(false); }
};

// spinner keyframes
(function ensureSpinnerKeyframes() {
  const id = '__mainjs_spinner_kf';
  if (document.getElementById(id)) return;
  const style = document.createElement('style'); style.id = id;
  style.innerHTML = `@keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}`;
  document.head.appendChild(style);
})();
