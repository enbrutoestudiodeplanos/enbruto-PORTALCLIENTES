const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwN-0FLG5GAxrI7PB5cXSEziMegrkN4XHRQvdPZHuc7US34KX2OrFnzRRN1nlXoltJITQ/exec';

let orderSubmitting = false;
let allOrders = [];
let showingAll = false;
let selectedFile = null;

// ── Utilidades de sesión ──────────────────────────────────────────────────────

function setMessage(el, message, type = '') {
  if (!el) return;
  el.textContent = message;
  el.classList.remove('is-error', 'is-success');
  if (type) el.classList.add(type);
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('enbrutoPortalUser') || 'null');
  } catch {
    return null;
  }
}

function setStoredUser(user) {
  localStorage.setItem('enbrutoPortalUser', JSON.stringify(user));
}

function clearStoredUser() {
  localStorage.removeItem('enbrutoPortalUser');
}

// ── Red ───────────────────────────────────────────────────────────────────────

async function postData(payload) {
  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('La respuesta del servidor no es válida.');
  }
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

// ── Render panel ─────────────────────────────────────────────────────────────

function fillPanel(profile) {
  const panelStudio = document.getElementById('panelStudio');
  const panelEmail  = document.getElementById('panelEmail');
  const orderStudy  = document.getElementById('orderStudy');

  if (panelStudio) panelStudio.textContent = profile.estudio || '—';
  if (panelEmail)  panelEmail.textContent  = profile.email   || '—';
  if (orderStudy)  orderStudy.value        = profile.estudio || '';
}

function fillProfile(profile) {
  const profileStudio = document.getElementById('profileStudio');
  const profileEmail  = document.getElementById('profileEmail');
  const profilePhone  = document.getElementById('profilePhone');

  if (profileStudio) profileStudio.textContent = profile.estudio  || '—';
  if (profileEmail)  profileEmail.textContent  = profile.email    || '—';
  if (profilePhone)  profilePhone.textContent  = profile.telefono || '—';
}

function fillActivityStats(orders = []) {
  const statTotal  = document.getElementById('statTotal');
  const statMedida = document.getElementById('statMedida');
  const statMes    = document.getElementById('statMes');

  if (statTotal) statTotal.textContent = orders.length || '0';

  if (statMedida) {
    const freq = {};
    orders.forEach(o => { if (o.medida) freq[o.medida] = (freq[o.medida] || 0) + 1; });
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
    statMedida.textContent = top ? top[0] : '—';
  }

  if (statMes) {
    const now   = new Date();
    const mes   = now.getMonth();
    const anio  = now.getFullYear();
    const count = orders.filter(o => {
      if (!o.fecha) return false;
      const parts = o.fecha.split('/');
      if (parts.length < 2) return false;
      const m = parseInt(parts[1], 10) - 1;
      const a = parts[2] ? parseInt(parts[2], 10) : anio;
      return m === mes && a === anio;
    }).length;
    statMes.textContent = count;
  }
}

function renderLastOrder(orders = []) {
  const wrap = document.getElementById('lastOrderContent');
  if (!wrap) return;

  if (!orders.length) {
    wrap.innerHTML = '<span class="profile-empty">Sin pedidos registrados.</span>';
    return;
  }

  const item     = orders[0];
  const obra     = item.obra           || 'Sin obra';
  const medida   = item.medida         || '';
  const tipo     = item.tipo_impresion || '';
  const cantidad = item.cantidad ? `${item.cantidad} copia${item.cantidad == 1 ? '' : 's'}` : '';
  const estado   = item.estado         || 'recibido';
  const fecha    = item.fecha          || '';

  wrap.innerHTML = `
    <div class="last-order-row">
      <div class="history-meta">
        <div class="history-title">${obra}${fecha ? `<span class="history-date">${fecha}</span>` : ''}</div>
        <div class="history-sub">${[medida, tipo, cantidad].filter(Boolean).join(' · ')}</div>
      </div>
      <div class="history-estado">
        ${renderEstado(estado)}
      </div>
    </div>
  `;
}

function renderFiles(items = []) {
  const wrap = document.getElementById('sharedFiles');
  if (!wrap) return;

  wrap.innerHTML = '';

  if (!items.length) {
    wrap.innerHTML = `<div class="file-row"><div class="file-meta"><div class="file-sub">No hay archivos disponibles.</div></div></div>`;
    return;
  }

  items.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'file-row';
    row.innerHTML = `
      <div class="file-meta">
        <div class="file-title">${item.archivo || 'Archivo'}</div>
        <div class="file-sub">${item.tipo || 'Disponible'}</div>
      </div>
      <a class="file-link" href="${item.link || '#'}" target="_blank" rel="noopener">Descargar</a>
    `;
    wrap.appendChild(row);
  });
}

// ── Estado visual de pedidos ──────────────────────────────────────────────────

const ESTADOS = ['recibido', 'en proceso', 'en impresión', 'listo', 'entregado'];

function estadoIndex(estado = '') {
  const e = estado.toLowerCase().trim();
  const idx = ESTADOS.findIndex(s => s === e);
  return idx >= 0 ? idx : 0;
}

function renderEstado(estado = '') {
  const idx   = estadoIndex(estado);
  const label = ESTADOS[idx];
  const clase = label.replace(/\s/g, '-');

  const steps = ESTADOS.map((s, i) => {
    const active  = i <= idx ? 'active'  : '';
    const current = i === idx ? 'current' : '';
    return `<span class="estado-step ${active} ${current}" title="${s}"></span>`;
  }).join('');

  return `
    <div class="estado-badge estado-${clase}">${label}</div>
    <div class="estado-track">${steps}</div>
  `;
}

function renderHistory(items = [], limit = 3) {
  allOrders = items;
  const wrap = document.getElementById('orderHistory');
  if (!wrap) return;

  wrap.innerHTML = '';

  if (!items.length) {
    wrap.innerHTML = `<div class="history-row"><div class="history-meta"><div class="history-sub">No hay pedidos registrados.</div></div></div>`;
    updateToggleButton();
    return;
  }

  const visible = showingAll ? items : items.slice(0, limit);

  visible.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'history-row';

    const obra     = item.obra             || 'Sin obra';
    const medida   = item.medida           || '';
    const tipo     = item.tipo_impresion   || '';
    const cantidad = item.cantidad ? `${item.cantidad} copia${item.cantidad == 1 ? '' : 's'}` : '';
    const estado   = item.estado           || 'recibido';
    const fecha    = item.fecha            ? `<span class="history-date">${item.fecha}</span>` : '';

    row.innerHTML = `
      <div class="history-main">
        <div class="history-meta">
          <div class="history-title">${obra}${fecha}</div>
          <div class="history-sub">${[medida, tipo, cantidad].filter(Boolean).join(' · ')}</div>
        </div>
        <div class="history-estado">
          ${renderEstado(estado)}
        </div>
      </div>
    `;

    wrap.appendChild(row);
  });

  updateToggleButton();
}

function updateToggleButton() {
  const btn = document.getElementById('toggleHistory');
  if (!btn) return;

  if (allOrders.length <= 3) {
    btn.style.display = 'none';
    return;
  }

  btn.style.display = 'inline-flex';
  btn.textContent = showingAll ? 'VER MENOS' : `VER TODOS (${allOrders.length})`;
}

// ── Drag & Drop para PDF ──────────────────────────────────────────────────────

function initDropZone() {
  const dropZone  = document.getElementById('dropZone');
  const fileInput = document.getElementById('orderFile');
  const dropLabel = document.getElementById('dropLabel');

  if (!dropZone || !fileInput) return;

  function handleFile(file) {
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setDropError('Solo se admite PDF.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setDropError('El archivo supera 20 MB.');
      return;
    }

    selectedFile = file;
    dropZone.classList.add('has-file');
    dropZone.classList.remove('drop-error');
    if (dropLabel) {
      const kb = (file.size / 1024).toFixed(0);
      dropLabel.innerHTML = `<span class="drop-filename">📄 ${file.name}</span><span class="drop-size">${kb} KB</span>`;
    }
  }

  function setDropError(msg) {
    selectedFile = null;
    dropZone.classList.remove('has-file');
    dropZone.classList.add('drop-error');
    if (dropLabel) dropLabel.textContent = msg;
  }

  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer?.files?.[0];
    handleFile(file);
  });

  fileInput.addEventListener('change', () => {
    handleFile(fileInput.files?.[0]);
  });
}

// ── Modal de confirmación ─────────────────────────────────────────────────────

function buildConfirmModal() {
  if (document.getElementById('confirmModal')) return;

  const modal = document.createElement('div');
  modal.id = 'confirmModal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-box">
      <p class="eyebrow">Confirmá tu pedido</p>
      <div id="confirmDetails" class="confirm-details"></div>
      <div class="modal-actions">
        <button id="confirmCancel" class="mini-button" type="button">CANCELAR</button>
        <button id="confirmSend"   class="primary-button" type="button">CONFIRMAR Y ENVIAR</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('confirmCancel').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
}

function openConfirmModal(data) {
  buildConfirmModal();
  const details = document.getElementById('confirmDetails');
  details.innerHTML = `
    <div class="confirm-row"><span>Estudio</span><strong>${data.estudio}</strong></div>
    <div class="confirm-row"><span>Obra</span><strong>${data.obra}</strong></div>
    <div class="confirm-row"><span>Medida</span><strong>${data.medida}</strong></div>
    <div class="confirm-row"><span>Impresión</span><strong>${data.tipo}</strong></div>
    <div class="confirm-row"><span>Cantidad</span><strong>${data.cantidad} copia${data.cantidad == 1 ? '' : 's'}</strong></div>
    ${data.notas ? `<div class="confirm-row"><span>Notas</span><strong>${data.notas}</strong></div>` : ''}
    <div class="confirm-row"><span>Archivo</span><strong>📄 ${data.fileName}</strong></div>
  `;

  const modal = document.getElementById('confirmModal');
  modal.classList.add('is-open');

  return new Promise((resolve) => {
    const sendBtn = document.getElementById('confirmSend');
    const newBtn  = sendBtn.cloneNode(true);
    sendBtn.parentNode.replaceChild(newBtn, sendBtn);

    newBtn.addEventListener('click', () => {
      closeModal();
      resolve(true);
    });

    document.getElementById('confirmCancel').addEventListener('click', () => {
      resolve(false);
    }, { once: true });
  });
}

function closeModal() {
  const modal = document.getElementById('confirmModal');
  if (modal) modal.classList.remove('is-open');
}

// ── Login ─────────────────────────────────────────────────────────────────────

async function handleLogin(event) {
  event.preventDefault();

  const form       = event.currentTarget;
  const emailInput = form.querySelector('input[name="email"]') || document.getElementById('portalEmail');
  const email      = (emailInput?.value || '').trim().toLowerCase();
  const msg        = document.getElementById('portalLoginMessage');

  if (!email) {
    setMessage(msg, 'Ingresá un correo válido.', 'is-error');
    return;
  }

  try {
    setMessage(msg, 'Validando acceso…');

    const data = await postData({ action: 'login', email });

    if (!data.ok) throw new Error('Este correo aún no fue autorizado.');

    const profile = {
      estudio:  data.estudio  || '—',
      email:    data.email    || email,
      telefono: data.telefono || ''
    };

    setStoredUser(profile);
    window.location.href = 'panel.html';
  } catch (error) {
    setMessage(msg, error.message || 'Este correo aún no fue autorizado.', 'is-error');
  }
}

// ── Envío de pedido ───────────────────────────────────────────────────────────

async function handleOrderSubmit(event) {
  event.preventDefault();
  if (orderSubmitting) return;

  const form         = event.currentTarget;
  const msg          = document.getElementById('orderMessage');
  const submitButton = form.querySelector('button[type="submit"]');
  const user         = getStoredUser();

  if (!user || !user.email || !user.estudio) {
    clearStoredUser();
    window.location.href = 'index.html';
    return;
  }

  const fileInput = form.querySelector('input[name="file"]');
  const file = selectedFile || fileInput?.files?.[0];

  if (!file) {
    setMessage(msg, 'Adjuntá un PDF.', 'is-error');
    return;
  }
  if (file.type !== 'application/pdf') {
    setMessage(msg, 'Solo se admite PDF.', 'is-error');
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    setMessage(msg, 'El archivo supera el tamaño recomendado de 20 MB.', 'is-error');
    return;
  }

  const obraInput     = form.querySelector('input[name="code"]');
  const medidaInput   = form.querySelector('select[name="size"]');
  const tipoInput     = form.querySelector('select[name="type"]');
  const cantidadInput = form.querySelector('input[name="quantity"]');
  const notasInput    = form.querySelector('textarea[name="notes"]');

  const obra     = (obraInput?.value     || '').trim();
  const medida   =  medidaInput?.value   || '';
  const tipo     =  tipoInput?.value     || '';
  const cantidad =  cantidadInput?.value || '';
  const notas    = (notasInput?.value    || '').trim();

  if (!obra)     { setMessage(msg, 'Ingresá una obra o código.',        'is-error'); return; }
  if (!medida)   { setMessage(msg, 'Seleccioná una medida.',            'is-error'); return; }
  if (!tipo)     { setMessage(msg, 'Seleccioná el tipo de impresión.',  'is-error'); return; }
  if (!cantidad || Number(cantidad) < 1) {
    setMessage(msg, 'Ingresá una cantidad válida.', 'is-error');
    return;
  }

  const confirmed = await openConfirmModal({
    estudio: user.estudio,
    obra, medida, tipo, cantidad, notas,
    fileName: file.name
  });

  if (!confirmed) return;

  try {
    orderSubmitting = true;
    if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'ENVIANDO…'; }
    setMessage(msg, 'Enviando pedido…');

    const base64   = await toBase64(file);
    const fileData = base64.split(',')[1];

    const data = await postData({
      action: 'crear_pedido',
      estudio: user.estudio,
      email:   user.email,
      obra, medida, tipo, cantidad, notas,
      fileName: file.name,
      fileData
    });

    if (!data.ok) throw new Error(data.error || 'No se pudo enviar el pedido.');

    setMessage(msg, 'Pedido recibido. Te contactaremos por la vía habitual.', 'is-success');
    form.reset();
    resetDropZone();
    selectedFile = null;

    const orderStudy = document.getElementById('orderStudy');
    if (orderStudy) orderStudy.value = user.estudio || '';

    await loadDashboard();
  } catch (error) {
    setMessage(msg, error.message || 'No se pudo enviar el pedido.', 'is-error');
  } finally {
    orderSubmitting = false;
    if (submitButton) { submitButton.disabled = false; submitButton.textContent = 'SOLICITAR IMPRESIÓN'; }
  }
}

function resetDropZone() {
  const dropZone  = document.getElementById('dropZone');
  const dropLabel = document.getElementById('dropLabel');
  if (dropZone) {
    dropZone.classList.remove('has-file', 'drop-error', 'drag-over');
  }
  if (dropLabel) {
    dropLabel.innerHTML = `<span>Arrastrá tu PDF acá</span><span class="drop-hint">o hacé clic para seleccionar</span>`;
  }
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

async function loadDashboard() {
  const user = getStoredUser();

  if (!user || !user.email || !user.estudio) {
    clearStoredUser();
    window.location.href = 'index.html';
    return;
  }

  fillPanel(user);

  try {
    const filesData = await postData({ action: 'get_files', email: user.email });
    renderFiles(filesData.ok ? (filesData.files || []) : []);
  } catch {
    renderFiles([]);
  }

  try {
    const ordersData = await postData({ action: 'get_orders', email: user.email });
    renderHistory(ordersData.ok ? (ordersData.orders || []) : []);
  } catch {
    renderHistory([]);
  }
}

// ── Perfil ────────────────────────────────────────────────────────────────────

async function loadProfile() {
  const user = getStoredUser();

  if (!user || !user.email || !user.estudio) {
    clearStoredUser();
    window.location.href = 'index.html';
    return;
  }

  fillProfile(user);

  try {
    const profileData = await postData({ action: 'get_profile', email: user.email });
    if (profileData.ok && profileData.profile) {
      setStoredUser(profileData.profile);
      fillProfile(profileData.profile);
    }
  } catch {
    fillProfile(user);
  }

  try {
    const ordersData = await postData({ action: 'get_orders', email: user.email });
    const orders = ordersData.ok ? (ordersData.orders || []) : [];
    fillActivityStats(orders);
    renderLastOrder(orders);
  } catch {
    fillActivityStats([]);
    renderLastOrder([]);
  }
}

// ── Botones globales ──────────────────────────────────────────────────────────

function bindGlobalButtons() {
  document.getElementById('profileButton')?.addEventListener('click', () => {
    window.location.href = 'perfil.html';
  });

  document.getElementById('logoutButton')?.addEventListener('click', () => {
    clearStoredUser();
    window.location.href = 'index.html';
  });

  document.getElementById('backToPanel')?.addEventListener('click', () => {
    window.location.href = 'panel.html';
  });

  document.getElementById('goToOrder')?.addEventListener('click', () => {
    window.location.href = 'panel.html#order';
  });

  document.getElementById('toggleHistory')?.addEventListener('click', () => {
    showingAll = !showingAll;
    renderHistory(allOrders);
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  bindGlobalButtons();

  const params       = new URLSearchParams(window.location.search);
  const sessionParam = params.get('session');

  if (sessionParam) {
    try {
      const profile = JSON.parse(decodeURIComponent(escape(atob(sessionParam))));
      if (profile && profile.email && profile.estudio) {
        setStoredUser(profile);
        window.location.replace('panel.html');
        return;
      }
    } catch {
      // Si falla el decode, seguimos con el flujo normal
    }
  }

  const loginForm = document.getElementById('portalLoginForm');
  if (loginForm) {
    const emailParam  = params.get('email');
    const portalEmail = document.getElementById('portalEmail');

    if (emailParam && portalEmail) portalEmail.value = emailParam;

    loginForm.addEventListener('submit', handleLogin);
  }

  const orderForm = document.getElementById('orderForm');
  if (orderForm) {
    loadDashboard();
    initDropZone();
    orderForm.addEventListener('submit', handleOrderSubmit);
  }

  const profileStudio = document.getElementById('profileStudio');
  if (profileStudio) loadProfile();
});
