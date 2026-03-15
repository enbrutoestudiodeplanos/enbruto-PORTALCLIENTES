const APPS_SCRIPT_URL = 'PEGAR_AQUI_TU_URL_DE_APPS_SCRIPT';
const DEMO_PROFILE = {
  studio: 'Estudio Norte',
  email: 'contacto@estudio.com',
  phone: '11 2345 6789'
};
const DEMO_FILES = [
  { name: 'planta_general_v3.pdf', date: 'Disponible', url: '#' },
  { name: 'instalaciones_v2.pdf', date: 'Disponible', url: '#' },
  { name: 'estructura_v1.pdf', date: 'Disponible', url: '#' }
];
const DEMO_HISTORY = [
  { title: 'Casa Pérez', sub: 'A1 · Blanco y negro · 3 copias · recibido' },
  { title: 'Casa Pérez', sub: 'A3 · Color · 1 copia · listo' }
];

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

async function postData(payload) {
  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });
  return response.json();
}

function renderFiles(items) {
  const wrap = document.getElementById('sharedFiles');
  if (!wrap) return;
  wrap.innerHTML = '';
  items.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'file-row';
    row.innerHTML = `
      <div class="file-meta">
        <div class="file-title">${item.name}</div>
        <div class="file-sub">${item.date || 'Disponible'}</div>
      </div>
      <a class="file-link" href="${item.url || '#'}" ${item.url && item.url !== '#' ? 'target="_blank" rel="noopener"' : ''}>Descargar</a>
    `;
    wrap.appendChild(row);
  });
}

function renderHistory(items) {
  const wrap = document.getElementById('orderHistory');
  if (!wrap) return;
  wrap.innerHTML = '';
  items.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'history-row';
    row.innerHTML = `
      <div class="history-meta">
        <div class="history-title">${item.title}</div>
        <div class="history-sub">${item.sub}</div>
      </div>
    `;
    wrap.appendChild(row);
  });
}

function fillPanel(profile) {
  const user = profile || DEMO_PROFILE;
  const panelStudio = document.getElementById('panelStudio');
  const panelEmail = document.getElementById('panelEmail');
  const orderStudy = document.getElementById('orderStudy');
  if (panelStudio) panelStudio.textContent = user.studio || 'Estudio';
  if (panelEmail) panelEmail.textContent = user.email || '';
  if (orderStudy) orderStudy.value = user.studio || '';
}

function fillProfile(profile) {
  const user = profile || DEMO_PROFILE;
  const map = {
    profileStudio: user.studio || 'Estudio',
    profileEmail: user.email || '',
    profilePhone: user.phone || '—'
  };
  Object.entries(map).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  });
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const email = form.email.value.trim();
  const msg = document.getElementById('portalLoginMessage');
  if (!email) {
    setMessage(msg, 'Ingresá un correo válido.', 'is-error');
    return;
  }

  if (APPS_SCRIPT_URL.includes('PEGAR_AQUI')) {
    setStoredUser({ ...DEMO_PROFILE, email });
    setMessage(msg, 'Acceso habilitado en modo demo…');
    setTimeout(() => { window.location.href = 'panel.html'; }, 250);
    return;
  }

  try {
    setMessage(msg, 'Validando acceso…');
    const data = await postData({ action: 'checkAccess', email });
    if (!data.ok) throw new Error(data.error || 'Este correo aún no fue autorizado.');
    setStoredUser(data.profile);
    window.location.href = 'panel.html';
  } catch (error) {
    setMessage(msg, error.message || 'Este correo aún no fue autorizado.', 'is-error');
  }
}

async function initPanel() {
  const user = getStoredUser() || DEMO_PROFILE;
  fillPanel(user);
  renderFiles(DEMO_FILES);
  renderHistory(DEMO_HISTORY);

  if (!APPS_SCRIPT_URL.includes('PEGAR_AQUI')) {
    try {
      const data = await postData({ action: 'getDashboard', email: user.email });
      if (data.ok) {
        fillPanel(data.profile);
        renderFiles(data.files || []);
        renderHistory(data.orders || []);
        setStoredUser(data.profile);
      }
    } catch {}
  }

  document.getElementById('profileButton')?.addEventListener('click', () => {
    window.location.href = 'perfil.html';
  });
  document.getElementById('logoutButton')?.addEventListener('click', () => {
    clearStoredUser();
    window.location.href = 'index.html';
  });

  document.getElementById('orderForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const msg = document.getElementById('orderMessage');
    const file = form.file.files[0];

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

    if (APPS_SCRIPT_URL.includes('PEGAR_AQUI')) {
      setMessage(msg, 'Pedido recibido. Te contactaremos por la vía habitual.', 'is-success');
      form.reset();
      document.getElementById('orderStudy').value = user.studio || '';
      return;
    }

    try {
      setMessage(msg, 'Enviando pedido…');
      const base64 = await toBase64(file);
      const payload = {
        action: 'createOrder',
        email: user.email,
        studio: user.studio,
        code: form.code.value.trim(),
        size: form.size.value,
        type: form.type.value,
        quantity: form.quantity.value,
        notes: form.notes.value.trim(),
        fileName: file.name,
        fileMime: file.type,
        fileBase64: base64.split(',')[1]
      };
      const data = await postData(payload);
      if (!data.ok) throw new Error(data.error || 'No se pudo enviar el pedido.');
      setMessage(msg, 'Pedido recibido. Te contactaremos por la vía habitual.', 'is-success');
      form.reset();
      document.getElementById('orderStudy').value = user.studio || '';
    } catch (error) {
      setMessage(msg, error.message || 'No se pudo enviar el pedido.', 'is-error');
    }
  });
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function initProfile() {
  const user = getStoredUser() || DEMO_PROFILE;
  fillProfile(user);

  if (!APPS_SCRIPT_URL.includes('PEGAR_AQUI')) {
    try {
      const data = await postData({ action: 'getProfile', email: user.email });
      if (data.ok) {
        fillProfile(data.profile);
        setStoredUser(data.profile);
      }
    } catch {}
  }

  document.getElementById('backToPanel')?.addEventListener('click', () => {
    window.location.href = 'panel.html';
  });
}

if (document.getElementById('portalLoginForm')) {
  const params = new URLSearchParams(window.location.search);
  const emailParam = params.get('email');
  if (emailParam) document.getElementById('portalEmail').value = emailParam;
  document.getElementById('portalLoginForm').addEventListener('submit', handleLogin);
}

if (document.getElementById('orderForm')) {
  initPanel();
}

if (document.getElementById('profileStudio')) {
  initProfile();
}
