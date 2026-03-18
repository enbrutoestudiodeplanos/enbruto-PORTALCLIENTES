const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyOXk1eSBz_OuVeDagtYTbMYQvjVtdcBRaXTHf-X926DcOGp-XFWEveAvKJp0RoYI4ftg/exec';

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
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
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

function fillPanel(profile) {
  const panelStudio = document.getElementById('panelStudio');
  const panelEmail = document.getElementById('panelEmail');
  const orderStudy = document.getElementById('orderStudy');

  if (panelStudio) panelStudio.textContent = profile.estudio || '—';
  if (panelEmail) panelEmail.textContent = profile.email || '—';
  if (orderStudy) orderStudy.value = profile.estudio || '';
}

function fillProfile(profile) {
  const profileStudio = document.getElementById('profileStudio');
  const profileEmail = document.getElementById('profileEmail');
  const profilePhone = document.getElementById('profilePhone');

  if (profileStudio) profileStudio.textContent = profile.estudio || '—';
  if (profileEmail) profileEmail.textContent = profile.email || '—';
  if (profilePhone) profilePhone.textContent = profile.telefono || '—';
}

function renderFiles(items = []) {
  const wrap = document.getElementById('sharedFiles');
  if (!wrap) return;

  wrap.innerHTML = '';

  if (!items.length) {
    wrap.innerHTML = `
      <div class="file-row">
        <div class="file-meta">
          <div class="file-sub">No hay archivos disponibles.</div>
        </div>
      </div>
    `;
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

function renderHistory(items = []) {
  const wrap = document.getElementById('orderHistory');
  if (!wrap) return;

  wrap.innerHTML = '';

  if (!items.length) {
    wrap.innerHTML = `
      <div class="history-row">
        <div class="history-meta">
          <div class="history-sub">No hay pedidos registrados.</div>
        </div>
      </div>
    `;
    return;
  }

  items.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'history-row';

    const obra = item.obra || 'Sin obra';
    const medida = item.medida || '';
    const tipo = item.tipo_impresion || '';
    const cantidad = item.cantidad ? `${item.cantidad} copia${item.cantidad == 1 ? '' : 's'}` : '';
    const estado = item.estado || '';

    row.innerHTML = `
      <div class="history-meta">
        <div class="history-title">${obra}</div>
        <div class="history-sub">${[medida, tipo, cantidad, estado].filter(Boolean).join(' · ')}</div>
      </div>
    `;

    wrap.appendChild(row);
  });
}

async function handleLogin(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const emailInput = form.querySelector('input[name="email"]') || document.getElementById('portalEmail');
  const email = (emailInput?.value || '').trim().toLowerCase();
  const msg = document.getElementById('portalLoginMessage');

  if (!email) {
    setMessage(msg, 'Ingresá un correo válido.', 'is-error');
    return;
  }

  try {
    setMessage(msg, 'Validando acceso…');

    const data = await postData({
      action: 'login',
      email
    });

    if (!data.ok) {
      throw new Error('Este correo aún no fue autorizado.');
    }

    const profile = {
      estudio: data.estudio || '—',
      email: data.email || email,
      telefono: data.telefono || ''
    };

    setStoredUser(profile);
    window.location.href = 'panel.html';
  } catch (error) {
    setMessage(msg, error.message || 'Este correo aún no fue autorizado.', 'is-error');
  }
}

async function handleOrderSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const msg = document.getElementById('orderMessage');
  const user = getStoredUser();

  if (!user || !user.email || !user.estudio) {
    clearStoredUser();
    window.location.href = 'index.html';
    return;
  }

  const fileInput = form.querySelector('input[name="file"]');
  const file = fileInput?.files?.[0];

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

  const obraInput = form.querySelector('input[name="code"]');
  const medidaInput = form.querySelector('select[name="size"]');
  const tipoInput = form.querySelector('select[name="type"]');
  const cantidadInput = form.querySelector('input[name="quantity"]');
  const notasInput = form.querySelector('textarea[name="notes"]');

  const obra = (obraInput?.value || '').trim();
  const medida = medidaInput?.value || '';
  const tipo = tipoInput?.value || '';
  const cantidad = cantidadInput?.value || '';
  const notas = (notasInput?.value || '').trim();

  if (!obra) {
    setMessage(msg, 'Ingresá una obra o código de obra.', 'is-error');
    return;
  }

  if (!medida) {
    setMessage(msg, 'Seleccioná una medida.', 'is-error');
    return;
  }

  if (!tipo) {
    setMessage(msg, 'Seleccioná el tipo de impresión.', 'is-error');
    return;
  }

  if (!cantidad || Number(cantidad) < 1) {
    setMessage(msg, 'Ingresá una cantidad válida.', 'is-error');
    return;
  }

  try {
    setMessage(msg, 'Enviando pedido…');

    const base64 = await toBase64(file);
    const fileData = base64.split(',')[1];

    const data = await postData({
      action: 'crear_pedido',
      estudio: user.estudio,
      email: user.email,
      obra,
      medida,
      tipo,
      cantidad,
      notas,
      fileName: file.name,
      fileData
    });

    if (!data.ok) {
      throw new Error('No se pudo enviar el pedido.');
    }

    setMessage(msg, 'Pedido recibido. Te contactaremos por la vía habitual.', 'is-success');
    form.reset();

    const orderStudy = document.getElementById('orderStudy');
    if (orderStudy) orderStudy.value = user.estudio || '';

    await loadDashboard();
  } catch (error) {
    setMessage(msg, error.message || 'No se pudo enviar el pedido.', 'is-error');
  }
}

async function loadDashboard() {
  const user = getStoredUser();

  if (!user || !user.email || !user.estudio) {
    clearStoredUser();
    window.location.href = 'index.html';
    return;
  }

  fillPanel(user);

  try {
    const filesData = await postData({
      action: 'get_files',
      email: user.email
    });

    if (filesData.ok) {
      renderFiles(filesData.files || []);
    } else {
      renderFiles([]);
    }
  } catch {
    renderFiles([]);
  }

  try {
    const ordersData = await postData({
      action: 'get_orders',
      email: user.email
    });

    if (ordersData.ok) {
      renderHistory(ordersData.orders || []);
    } else {
      renderHistory([]);
    }
  } catch {
    renderHistory([]);
  }
}

async function loadProfile() {
  const user = getStoredUser();

  if (!user || !user.email || !user.estudio) {
    clearStoredUser();
    window.location.href = 'index.html';
    return;
  }

  fillProfile(user);

  try {
    const profileData = await postData({
      action: 'get_profile',
      email: user.email
    });

    if (profileData.ok && profileData.profile) {
      setStoredUser(profileData.profile);
      fillProfile(profileData.profile);
    }
  } catch {
    fillProfile(user);
  }
}

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
}

document.addEventListener('DOMContentLoaded', () => {
  bindGlobalButtons();

  const loginForm = document.getElementById('portalLoginForm');
  if (loginForm) {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get('email');
    const portalEmail = document.getElementById('portalEmail');

    if (emailParam && portalEmail) {
      portalEmail.value = emailParam;
    }

    loginForm.addEventListener('submit', handleLogin);
  }

  const orderForm = document.getElementById('orderForm');
  if (orderForm) {
    loadDashboard();
    orderForm.addEventListener('submit', handleOrderSubmit);
  }

  const profileStudio = document.getElementById('profileStudio');
  if (profileStudio) {
    loadProfile();
  }
});
