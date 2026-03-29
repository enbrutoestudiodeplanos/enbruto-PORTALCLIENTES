// ═══════════════════════════════════════════════════════════════════
// EN BRUTO ESTUDIO — app.js
// Lógica de sesión segura · Magic link · Validación server-side
// ═══════════════════════════════════════════════════════════════════

const APPS_SCRIPT_URL = ‘https://script.google.com/macros/s/AKfycbwN-0FLG5GAxrI7PB5cXSEziMegrkN4XHRQvdPZHuc7US34KX2OrFnzRRN1nlXoltJITQ/exec’;

let orderSubmitting = false;
let allOrders       = [];
let showingAll      = false;
let selectedFile    = null;
let priceTable      = {};

// ── Sesión ────────────────────────────────────────────────────────
// Ya no almacenamos datos de usuario — solo el sessionId opaco.
// sessionStorage se limpia automáticamente al cerrar el tab.

function getSessionId() {
return sessionStorage.getItem(‘portalSid’) || ‘’;
}

function setSessionId(sid) {
sessionStorage.setItem(‘portalSid’, sid);
}

function clearSession() {
sessionStorage.removeItem(‘portalSid’);
}

// ── Red ───────────────────────────────────────────────────────────

async function postData(payload) {
const sid = getSessionId();
const body = sid ? { …payload, sessionId: sid } : payload;

const response = await fetch(APPS_SCRIPT_URL, {
method:  ‘POST’,
headers: { ‘Content-Type’: ‘text/plain;charset=utf-8’ },
body:    JSON.stringify(body),
});

const text = await response.text();
try {
return JSON.parse(text);
} catch {
throw new Error(‘La respuesta del servidor no es válida.’);
}
}

function toBase64(file) {
return new Promise((resolve, reject) => {
const reader = new FileReader();
reader.onload  = () => resolve(reader.result);
reader.onerror = () => reject(new Error(‘No se pudo leer el archivo.’));
reader.readAsDataURL(file);
});
}

// ── Helpers de UI ─────────────────────────────────────────────────

function setMessage(el, message, type = ‘’) {
if (!el) return;
el.textContent = message;
el.classList.remove(‘is-error’, ‘is-success’);
if (type) el.classList.add(type);
}

function isUrgent() {
return document.getElementById(‘urgentCheck’)?.checked === true;
}

// ── Precios ───────────────────────────────────────────────────────

async function fetchPrices() {
try {
const data = await postData({ action: ‘get_prices’ });
priceTable  = (data.ok && data.prices) ? data.prices : {};
} catch {
priceTable = {};
}
updatePriceDisplay();
}

function getPriceKey(medida, tipo) {
const tipoKey = String(tipo).toLowerCase().includes(‘color’) ? ‘color’ : ‘byn’;
return `${medida}_${tipoKey}`;
}

function calculatePrice() {
const medida   = document.getElementById(‘orderSize’)?.value || ‘’;
const tipo     = document.getElementById(‘orderType’)?.value || ‘’;
const cantidad = parseInt(document.getElementById(‘orderQty’)?.value || ‘1’, 10) || 1;
const key      = getPriceKey(medida, tipo);
const unitPrice = Number(priceTable[key]);
if (!unitPrice) return null;
const subtotal = unitPrice * cantidad;
const recargo  = isUrgent() ? Math.round(subtotal * 0.25) : 0;
return { unitPrice, cantidad, subtotal, recargo, total: subtotal + recargo };
}

function formatARS(amount) {
return new Intl.NumberFormat(‘es-AR’, {
style: ‘currency’, currency: ‘ARS’,
minimumFractionDigits: 0, maximumFractionDigits: 0,
}).format(amount);
}

function updatePriceDisplay() {
const display   = document.getElementById(‘priceDisplay’);
const valueEl   = document.getElementById(‘priceValue’);
const breakdown = document.getElementById(‘priceBreakdown’);
if (!display || !valueEl) return;

const result = calculatePrice();
if (!result) { display.style.display = ‘none’; return; }

display.style.display = ‘flex’;
valueEl.textContent   = formatARS(result.total);

if (breakdown) {
const parts = [];
if (result.cantidad > 1) parts.push(`${result.cantidad} × ${formatARS(result.unitPrice)}`);
if (result.recargo  > 0) parts.push(`<span class="price-urgent">urgente +${formatARS(result.recargo)}</span>`);
breakdown.innerHTML = parts.join(’ · ’);
}
}

// ── Render panel ──────────────────────────────────────────────────

function fillPanel(profile) {
const panelStudio = document.getElementById(‘panelStudio’);
const panelEmail  = document.getElementById(‘panelEmail’);
const orderStudy  = document.getElementById(‘orderStudy’);
if (panelStudio) panelStudio.textContent = profile.estudio || ‘—’;
if (panelEmail)  panelEmail.textContent  = profile.email   || ‘’;
if (orderStudy)  orderStudy.value        = profile.estudio || ‘’;
}

function fillProfile(profile) {
const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || ‘—’; };
set(‘profileStudio’, profile.estudio);
set(‘profileEmail’,  profile.email);
set(‘profilePhone’,  profile.telefono);
if (profile.expiresAt) {
const exp = new Date(profile.expiresAt);
set(‘profileSessionExp’, exp.toLocaleString(‘es-AR’));
}
}

function fillActivityStats(orders = []) {
const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = String(val); };
set(‘statTotal’, orders.length || 0);

const freq = {};
orders.forEach(o => { if (o.medida) freq[o.medida] = (freq[o.medida] || 0) + 1; });
const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
set(‘statMedida’, top ? top[0] : ‘—’);

const now  = new Date();
const mes  = now.getMonth();
const anio = now.getFullYear();
const count = orders.filter(o => {
if (!o.fecha) return false;
const parts = String(o.fecha).split(’/’);
if (parts.length < 2) return false;
const m = parseInt(parts[1], 10) - 1;
const a = parts[2] ? parseInt(parts[2], 10) : anio;
return m === mes && a === anio;
}).length;
set(‘statMes’, count);
}

function renderLastOrder(orders = []) {
const wrap = document.getElementById(‘lastOrderContent’);
if (!wrap) return;
if (!orders.length) {
wrap.innerHTML = ‘<span class="profile-empty">Sin pedidos registrados.</span>’;
return;
}
const item     = orders[0];
const obra     = item.obra    || ‘Sin obra’;
const medida   = item.medida  || ‘’;
const tipo     = item.tipo_impresion || ‘’;
const cantidad = item.cantidad ? `${item.cantidad} copia${item.cantidad == 1 ? '' : 's'}` : ‘’;
const estado   = item.estado  || ‘recibido’;
const fecha    = item.fecha   || ‘’;
wrap.innerHTML = `<div class="last-order-row"> <div class="history-meta"> <div class="history-title"> ${obra}${fecha ?`<span class="history-date">${fecha}</span>`: ''} </div> <div class="history-sub">${[medida, tipo, cantidad].filter(Boolean).join(' · ')}</div> </div> <div class="history-estado">${renderEstado(estado)}</div> </div>`;
}

function renderFiles(items = []) {
const wrap = document.getElementById(‘sharedFiles’);
if (!wrap) return;
wrap.innerHTML = ‘’;
if (!items.length) {
wrap.innerHTML = `<div class="file-row"><div class="file-meta"><div class="file-sub">No hay archivos disponibles.</div></div></div>`;
return;
}
items.forEach(item => {
const row = document.createElement(‘div’);
row.className = ‘file-row’;
row.innerHTML = `<div class="file-meta"> <div class="file-title">${item.archivo || 'Archivo'}</div> <div class="file-sub">${item.tipo || 'Disponible'}</div> </div> <a class="file-link" href="${item.link || '#'}" target="_blank" rel="noopener">Descargar</a>`;
wrap.appendChild(row);
});
}

// ── Estado visual de pedidos ──────────────────────────────────────

const ESTADOS = [‘recibido’, ‘en proceso’, ‘en impresión’, ‘listo’, ‘entregado’];

function estadoIndex(estado = ‘’) {
const e   = estado.toLowerCase().trim();
const idx = ESTADOS.findIndex(s => s === e);
return idx >= 0 ? idx : 0;
}

function renderEstado(estado = ‘’) {
const idx   = estadoIndex(estado);
const label = ESTADOS[idx];
const clase = label.replace(/\s/g, ‘-’);
const steps = ESTADOS.map((s, i) => {
const active  = i <= idx ? ‘active’  : ‘’;
const current = i === idx ? ‘current’ : ‘’;
return `<span class="estado-step ${active} ${current}" title="${s}"></span>`;
}).join(’’);
return `<div class="estado-badge estado-${clase}">${label}</div> <div class="estado-track">${steps}</div>`;
}

function renderHistory(items = [], limit = 3) {
allOrders = items;
const wrap = document.getElementById(‘orderHistory’);
if (!wrap) return;
wrap.innerHTML = ‘’;

if (!items.length) {
wrap.innerHTML = `<div class="history-row"><div class="history-main"><div class="history-meta"><div class="history-sub">No hay pedidos registrados.</div></div></div></div>`;
updateToggleButton();
return;
}

const visible = showingAll ? items : items.slice(0, limit);
visible.forEach(item => {
const row      = document.createElement(‘div’);
row.className  = ‘history-row’;
const obra     = item.obra    || ‘Sin obra’;
const medida   = item.medida  || ‘’;
const tipo     = item.tipo_impresion || ‘’;
const cantidad = item.cantidad ? `${item.cantidad} copia${item.cantidad == 1 ? '' : 's'}` : ‘’;
const estado   = item.estado  || ‘recibido’;
const fecha    = item.fecha   ? `<span class="history-date">${item.fecha}</span>` : ‘’;
const entrega  = item.entrega ? ` · ${item.entrega}` : ‘’;
const urgente  = item.urgente === ‘si’ ? ’ <span class="badge-urgent">urgente</span>’ : ‘’;
row.innerHTML = `<div class="history-main"> <div class="history-meta"> <div class="history-title">${obra}${fecha}${urgente}</div> <div class="history-sub">${[medida, tipo, cantidad].filter(Boolean).join(' · ')}${entrega}</div> </div> <div class="history-estado">${renderEstado(estado)}</div> </div>`;
wrap.appendChild(row);
});

updateToggleButton();
}

function updateToggleButton() {
const btn = document.getElementById(‘toggleHistory’);
if (!btn) return;
if (allOrders.length <= 3) { btn.style.display = ‘none’; return; }
btn.style.display  = ‘inline-flex’;
btn.textContent    = showingAll ? ‘VER MENOS’ : `VER TODOS (${allOrders.length})`;
}

// ── Drop zone ─────────────────────────────────────────────────────

function initDropZone() {
const dropZone  = document.getElementById(‘dropZone’);
const fileInput = document.getElementById(‘orderFile’);
const dropLabel = document.getElementById(‘dropLabel’);
if (!dropZone || !fileInput) return;

function setDropError(msg) {
selectedFile = null;
fileInput.value = ‘’;
dropZone.classList.remove(‘has-file’);
dropZone.classList.add(‘drop-error’);
if (dropLabel) dropLabel.innerHTML = `<span>${msg}</span><span class="drop-hint">Solo PDF hasta 20 MB</span>`;
}

function handleFile(file) {
if (!file) return;
if (file.type !== ‘application/pdf’) { setDropError(‘Solo se admite PDF.’); return; }
if (file.size > 20 * 1024 * 1024)   { setDropError(‘El archivo supera 20 MB.’); return; }
selectedFile = file;
dropZone.classList.add(‘has-file’);
dropZone.classList.remove(‘drop-error’);
if (dropLabel) {
const kb = (file.size / 1024).toFixed(0);
dropLabel.innerHTML = `<span class="drop-filename">📄 ${file.name}</span><span class="drop-size">${kb} KB</span>`;
}
}

dropZone.addEventListener(‘click’,    () => fileInput.click());
dropZone.addEventListener(‘keydown’,  e  => { if (e.key === ‘Enter’ || e.key === ’ ’) { e.preventDefault(); fileInput.click(); } });
dropZone.addEventListener(‘dragover’, e  => { e.preventDefault(); dropZone.classList.add(‘drag-over’); });
dropZone.addEventListener(‘dragleave’,()  => dropZone.classList.remove(‘drag-over’));
dropZone.addEventListener(‘drop’,     e  => {
e.preventDefault();
dropZone.classList.remove(‘drag-over’);
handleFile(e.dataTransfer?.files?.[0]);
});
fileInput.addEventListener(‘change’, () => handleFile(fileInput.files?.[0]));
}

const DELIVERY_LABELS = { obra: ‘Obra’, archivo: ‘Archivo’, final: ‘Cliente final’ };

// ── Modal de confirmación ─────────────────────────────────────────

function buildConfirmModal() {
if (document.getElementById(‘confirmModal’)) return;
const modal = document.createElement(‘div’);
modal.id        = ‘confirmModal’;
modal.className = ‘modal-overlay’;
modal.innerHTML = `<div class="modal-box"> <p class="eyebrow">Confirmá tu pedido</p> <div id="confirmDetails" class="confirm-details"></div> <div id="confirmPriceWrap" class="confirm-price-wrap" style="display:none"> <div class="confirm-price-inner"> <span class="confirm-price-label">Total estimado</span> <span id="confirmPriceValue" class="confirm-price-value">—</span> </div> <p class="confirm-price-note">Precio de referencia. El valor final puede ajustarse según revisión del archivo, terminación y cantidad efectiva.</p> </div> <div class="modal-actions"> <button id="confirmCancel" class="mini-button" type="button">CANCELAR</button> <button id="confirmSend"   class="primary-button" type="button"><span>CONFIRMAR Y ENVIAR</span></button> </div> </div>`;
document.body.appendChild(modal);
document.getElementById(‘confirmCancel’)?.addEventListener(‘click’, closeModal);
modal.addEventListener(‘click’, e => { if (e.target === modal) closeModal(); });
}

function openConfirmModal(data) {
buildConfirmModal();
const details   = document.getElementById(‘confirmDetails’);
const priceWrap = document.getElementById(‘confirmPriceWrap’);
const priceValue = document.getElementById(‘confirmPriceValue’);

if (details) {
details.innerHTML = `<div class="confirm-row"><span>Obra</span><strong>${data.obra}</strong></div> <div class="confirm-row"><span>Medida</span><strong>${data.medida}</strong></div> <div class="confirm-row"><span>Impresión</span><strong>${data.tipo}</strong></div> <div class="confirm-row"><span>Cantidad</span><strong>${data.cantidad} copia${data.cantidad == 1 ? '' : 's'}</strong></div> <div class="confirm-row"><span>Entrega</span><strong>${DELIVERY_LABELS[data.entrega] || data.entrega}</strong></div> <div class="confirm-row"><span>Prioridad</span><strong>${data.urgente ? 'Urgente (+25%)' : 'Normal'}</strong></div> ${data.notas ?`<div class="confirm-row"><span>Notas</span><strong>${data.notas}</strong></div>`: ''} <div class="confirm-row"><span>Archivo</span><strong>📄 ${data.fileName}</strong></div>`;
}

if (data.price && priceWrap && priceValue) {
priceWrap.style.display = ‘flex’;
priceValue.textContent  = formatARS(data.price.total);
const breakdown = [];
if (data.price.cantidad > 1) breakdown.push(`${data.price.cantidad} × ${formatARS(data.price.unitPrice)}`);
if (data.price.recargo  > 0) breakdown.push(`⚡ urgente +${formatARS(data.price.recargo)}`);
if (breakdown.length) {
const note = priceWrap.querySelector(’.confirm-price-note’);
if (note) note.textContent = `${breakdown.join(' · ')} · Precio de referencia, puede variar.`;
}
} else if (priceWrap) {
priceWrap.style.display = ‘none’;
}

document.getElementById(‘confirmModal’)?.classList.add(‘is-open’);

return new Promise(resolve => {
const sendBtn   = document.getElementById(‘confirmSend’);
const cancelBtn = document.getElementById(‘confirmCancel’);
if (!sendBtn || !cancelBtn || !sendBtn.parentNode) { resolve(false); return; }

```
const newSend   = sendBtn.cloneNode(true);
const newCancel = cancelBtn.cloneNode(true);
sendBtn.parentNode.replaceChild(newSend, sendBtn);
cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

newSend.addEventListener('click',   () => { closeModal(); resolve(true);  }, { once: true });
newCancel.addEventListener('click', () => { closeModal(); resolve(false); }, { once: true });
```

});
}

function closeModal() {
document.getElementById(‘confirmModal’)?.classList.remove(‘is-open’);
}

// ── LOGIN — Solicitar magic link ──────────────────────────────────

async function handleLogin(event) {
event.preventDefault();
const emailInput = document.getElementById(‘portalEmail’);
const email      = (emailInput?.value || ‘’).trim().toLowerCase();
const msg        = document.getElementById(‘portalLoginMessage’);
const btn        = event.currentTarget.querySelector(‘button[type=“submit”]’);

if (!email || !/^[^\s@]+@[^\s@]+.[^\s@]+$/.test(email)) {
setMessage(msg, ‘Ingresá un correo válido.’, ‘is-error’);
return;
}

setMessage(msg, ‘Enviando enlace…’);
if (btn) { btn.disabled = true; btn.innerHTML = ‘<span class="btn-spinner"></span><span>Enviando…</span>’; }

try {
// Llamada al backend — siempre responde genéricamente por seguridad
await postData({ action: ‘request_access’, email });

```
// Mostrar vista de "enlace enviado" independientemente de si el email existe
const loginView = document.getElementById('loginView');
const sentView  = document.getElementById('sentView');
if (loginView) loginView.style.display = 'none';
if (sentView)  sentView.style.display  = 'block';
```

} catch {
setMessage(msg, ‘Error de conexión. Intentá de nuevo.’, ‘is-error’);
if (btn) { btn.disabled = false; btn.innerHTML = ‘<span>Solicitar acceso</span>’; }
}
}

// ── AUTH — Validar token del magic link ───────────────────────────
// Se ejecuta solo en auth.html cuando hay ?token= en la URL

async function handleAuthPage() {
const params = new URLSearchParams(window.location.search);
const token  = params.get(‘token’) || ‘’;

if (!token || token.length < 20) {
showAuthError(‘Enlace inválido’, ‘Este enlace no tiene el formato correcto.’);
return;
}

try {
const data = await postData({ action: ‘validate_token’, token });

```
if (!data.ok) {
  showAuthError('Acceso denegado', data.error || 'El enlace no es válido o ya fue utilizado.');
  return;
}

// Guardar sessionId opaco y limpiar la URL
setSessionId(data.sessionId);
window.location.replace('panel.html');
```

} catch {
showAuthError(‘Error de conexión’, ‘No se pudo verificar el acceso. Intentá de nuevo.’);
}
}

function showAuthError(title, msg) {
const loading = document.getElementById(‘authLoading’);
const error   = document.getElementById(‘authError’);
if (loading) loading.style.display = ‘none’;
if (error)   error.style.display   = ‘block’;
const titleEl = document.getElementById(‘authErrorTitle’);
const msgEl   = document.getElementById(‘authErrorMsg’);
if (titleEl) titleEl.textContent = title;
if (msgEl)   msgEl.textContent   = msg;
}

// ── SESIÓN — Verificar con el backend ────────────────────────────

async function requireSession() {
const sid = getSessionId();
if (!sid) { window.location.replace(‘index.html’); return null; }

try {
const data = await postData({ action: ‘get_session’ });
if (!data.ok) {
clearSession();
window.location.replace(‘index.html’);
return null;
}
return data; // { email, estudio, expiresAt, … }
} catch {
// Si hay error de red, no cerrar sesión — podría ser transitorio
return null;
}
}

// ── DASHBOARD ─────────────────────────────────────────────────────

async function loadDashboard() {
const session = await requireSession();
if (!session) return;

fillPanel(session);

try {
const data = await postData({ action: ‘get_dashboard’ });
if (data.ok) {
fillPanel(data.profile || session);
renderHistory(data.orders || []);
renderFiles(data.files   || []);
}
} catch {
renderHistory([]);
renderFiles([]);
}
}

// ── PERFIL ────────────────────────────────────────────────────────

async function loadProfile() {
const session = await requireSession();
if (!session) return;

fillProfile(session);

try {
const profileData = await postData({ action: ‘get_profile’ });
if (profileData.ok && profileData.profile) fillProfile({ …profileData.profile, expiresAt: session.expiresAt });
} catch { /* usar datos de sesión */ }

try {
const ordersData = await postData({ action: ‘get_orders’ });
const orders = ordersData.ok ? (ordersData.orders || []) : [];
fillActivityStats(orders);
renderLastOrder(orders);
} catch {
fillActivityStats([]);
renderLastOrder([]);
}
}

// ── LOGOUT ────────────────────────────────────────────────────────

async function handleLogout() {
try {
await postData({ action: ‘logout’ });
} catch { /* continuar de todas formas */ }
clearSession();
window.location.replace(‘index.html’);
}

// ── ENVÍO DE PEDIDO ───────────────────────────────────────────────

async function handleOrderSubmit(event) {
event.preventDefault();
if (orderSubmitting) return;

const form         = event.currentTarget;
const msg          = document.getElementById(‘orderMessage’);
const submitButton = document.getElementById(‘orderSubmitBtn’);

const file = selectedFile;
if (!file)                       { setMessage(msg, ‘Adjuntá un PDF.’, ‘is-error’); return; }
if (file.type !== ‘application/pdf’) { setMessage(msg, ‘Solo se admite PDF.’, ‘is-error’); return; }
if (file.size > 20 * 1024 * 1024)   { setMessage(msg, ‘El archivo supera 20 MB.’, ‘is-error’); return; }

const obra     = (form.querySelector(‘input[name=“code”]’)?.value     || ‘’).trim();
const medida   =  form.querySelector(‘select[name=“size”]’)?.value    || ‘’;
const tipo     =  form.querySelector(‘select[name=“type”]’)?.value    || ‘’;
const cantidad =  form.querySelector(‘input[name=“quantity”]’)?.value || ‘’;
const notas    = (form.querySelector(‘textarea[name=“notes”]’)?.value || ‘’).trim();
const entrega  =  form.querySelector(‘input[name=“delivery”]:checked’)?.value || ‘’;
const urgente  = isUrgent();

if (!obra)    { setMessage(msg, ‘Ingresá una obra o código.’, ‘is-error’); return; }
if (!medida)  { setMessage(msg, ‘Seleccioná una medida.’, ‘is-error’); return; }
if (!tipo)    { setMessage(msg, ‘Seleccioná el tipo de impresión.’, ‘is-error’); return; }
if (!cantidad || Number(cantidad) < 1) { setMessage(msg, ‘Ingresá una cantidad válida.’, ‘is-error’); return; }
if (!entrega) { setMessage(msg, ‘Seleccioná el tipo de entrega.’, ‘is-error’); return; }

const price = calculatePrice();

const confirmed = await openConfirmModal({
obra, medida, tipo, cantidad, notas, entrega,
urgente, fileName: file.name, price,
});
if (!confirmed) return;

try {
orderSubmitting = true;
if (submitButton) { submitButton.disabled = true; submitButton.innerHTML = ‘<span class="btn-spinner"></span><span>ENVIANDO…</span>’; }
setMessage(msg, ‘Enviando pedido…’);

```
const base64   = await toBase64(file);
const fileData = String(base64).split(',')[1];

const data = await postData({
  action:          'crear_pedido',
  obra, medida, tipo, cantidad, notas, entrega,
  urgente:         urgente ? 'si' : 'no',
  precio_estimado: price ? price.total : '',
  fileName:        file.name,
  fileData,
});

if (!data.ok) throw new Error(data.error || 'No se pudo enviar el pedido.');

setMessage(msg, 'Pedido recibido. Te contactaremos por la vía habitual.', 'is-success');
form.reset();
resetDropZone();
selectedFile = null;
updatePriceDisplay();
await loadDashboard();
```

} catch (error) {
setMessage(msg, error.message || ‘No se pudo enviar el pedido.’, ‘is-error’);
} finally {
orderSubmitting = false;
if (submitButton) { submitButton.disabled = false; submitButton.innerHTML = ‘<span>Solicitar impresión</span>’; }
}
}

function resetDropZone() {
const dropZone  = document.getElementById(‘dropZone’);
const dropLabel = document.getElementById(‘dropLabel’);
const fileInput = document.getElementById(‘orderFile’);
if (dropZone)  dropZone.classList.remove(‘has-file’, ‘drop-error’, ‘drag-over’);
if (dropLabel) dropLabel.innerHTML = ‘<span>Arrastrá tu PDF acá</span><span class="drop-hint">o hacé clic para seleccionar</span>’;
if (fileInput) fileInput.value = ‘’;
}

// ── Listeners de precio en vivo ───────────────────────────────────

function bindPriceListeners() {
[‘orderSize’, ‘orderType’, ‘orderQty’].forEach(id => {
document.getElementById(id)?.addEventListener(‘change’, updatePriceDisplay);
document.getElementById(id)?.addEventListener(‘input’,  updatePriceDisplay);
});
document.getElementById(‘urgentCheck’)?.addEventListener(‘change’, updatePriceDisplay);
}

// ── Botones globales ──────────────────────────────────────────────

function bindGlobalButtons() {
document.getElementById(‘profileButton’)?.addEventListener(‘click’, () => {
window.location.href = ‘perfil.html’;
});
document.getElementById(‘logoutButton’)?.addEventListener(‘click’, handleLogout);
document.getElementById(‘backToPanel’)?.addEventListener(‘click’, () => {
window.location.href = ‘panel.html’;
});
document.getElementById(‘goToOrder’)?.addEventListener(‘click’, () => {
window.location.href = ‘panel.html#order’;
});
document.getElementById(‘toggleHistory’)?.addEventListener(‘click’, () => {
showingAll = !showingAll;
renderHistory(allOrders);
});
document.getElementById(‘resendBtn’)?.addEventListener(‘click’, () => {
const loginView = document.getElementById(‘loginView’);
const sentView  = document.getElementById(‘sentView’);
const emailInput = document.getElementById(‘portalEmail’);
if (loginView) loginView.style.display = ‘block’;
if (sentView)  sentView.style.display  = ‘none’;
if (emailInput) { emailInput.value = ‘’; emailInput.focus(); }
});
}

// ── INIT ──────────────────────────────────────────────────────────

document.addEventListener(‘DOMContentLoaded’, () => {
bindGlobalButtons();

const path = window.location.pathname;
const page = path.split(’/’).pop() || ‘index.html’;

// ── auth.html — validar token del magic link
if (page === ‘auth.html’) {
handleAuthPage();
return;
}

// ── index.html — si ya hay sesión válida, ir directo al panel
const loginForm = document.getElementById(‘portalLoginForm’);
if (loginForm) {
loginForm.addEventListener(‘submit’, handleLogin);

```
// Si ya hay sesión, redirigir sin validar de nuevo (UX)
const sid = getSessionId();
if (sid) {
  postData({ action: 'get_session' }).then(data => {
    if (data.ok) window.location.replace('panel.html');
  }).catch(() => {});
}
return;
```

}

// ── panel.html
const orderForm = document.getElementById(‘orderForm’);
if (orderForm) {
loadDashboard();
fetchPrices();
initDropZone();
bindPriceListeners();
orderForm.addEventListener(‘submit’, handleOrderSubmit);
return;
}

// ── perfil.html
if (document.getElementById(‘profileStudio’)) {
loadProfile();
return;
}
});
