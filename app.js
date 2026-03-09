const state = {
  publicData: null,
  adminData: null,
  isAdmin: false,
  countdownTimer: null,
};

const WHATSAPP_URL = 'https://chat.whatsapp.com/GmARWruqeGgApY8gQY7rcb';

const $ = (id) => document.getElementById(id);

function euro(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'EUR' }).format(Number(value || 0));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(payload.error || 'Erro ao processar a solicitação.');
  }
  return payload;
}

async function loadPublicState() {
  const data = await request('/api/public-state');
  state.publicData = data;
  renderPublic();
}

function renderPublic() {
  const data = state.publicData;
  if (!data) return;

  const { config, members, sponsors, teams, storage } = data;
  $('hero-date').textContent = formatPrettyDate(config.gameDate);
  $('hero-arrival').textContent = `Chegada ${config.arrivalTime}`;
  $('hero-window').textContent = `${config.startTime} — ${config.endTime}`;
  $('game-date-inline').textContent = formatPrettyDate(config.gameDate);
  $('arrival-inline').textContent = config.arrivalTime;
  $('window-inline').textContent = `${config.startTime} — ${config.endTime}`;
  $('venue-name').textContent = config.venue;
  $('venue-address').textContent = config.address;
  $('max-slots-label').textContent = String(config.maxSlots);
  $('players-count').textContent = String(members.length);
  $('payment-inline').textContent = `${euro(config.paymentAmount)} por jogador`;
  $('maps-link').href = config.mapsUrl || '#';
  $('pay-btn').textContent = `Pagar ${euro(config.paymentAmount)}`;
  $('pay-btn').href = config.paymentLink || '#';
  $('whatsapp-btn').href = config.whatsappLink || WHATSAPP_URL;
  $('storage-badge').textContent = storage || 'Cloudflare D1';
  $('progress-count').textContent = String(members.length);

  const progress = Math.min(100, Math.round((members.length / Math.max(1, config.maxSlots)) * 100));
  $('progress-fill').style.width = `${progress}%`;

  renderConfirmed(members, config.maxSlots);
  renderSponsors(sponsors);
  renderTeams(teams);
  startCountdown(config.gameDate, config.startTime);
}

function renderConfirmed(members, maxSlots) {
  const container = $('confirmed-list');
  container.innerHTML = '';

  if (!members.length) {
    container.innerHTML = '<div class="empty-state">Ainda não há jogadores confirmados.</div>';
    return;
  }

  const template = $('confirmed-item-template');
  members.forEach((member, index) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector('.confirmed-index').textContent = String(index + 1);
    node.querySelector('.confirmed-name').textContent = member.name;
    container.appendChild(node);
  });

  if (members.length < maxSlots) {
    for (let i = members.length; i < maxSlots; i += 1) {
      const empty = document.createElement('div');
      empty.className = 'confirmed-item';
      empty.innerHTML = `<span class="confirmed-index">${i + 1}</span><span class="confirmed-name" style="color: var(--muted)">Disponível</span>`;
      container.appendChild(empty);
    }
  }
}

function sponsorBadgeText(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function renderSponsors(sponsors) {
  const container = $('sponsor-grid-home');
  container.innerHTML = '';
  const template = $('sponsor-card-template');

  sponsors.forEach((sponsor) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.href = sponsor.url;
    node.querySelector('.sponsor-badge').textContent = sponsorBadgeText(sponsor.name);
    node.querySelector('.sponsor-name').textContent = sponsor.name;
    node.querySelector('.sponsor-subtitle').textContent = sponsor.subtitle;
    container.appendChild(node);
  });
}

function renderTeams(teams) {
  const grid = $('teams-grid');
  const empty = $('teams-empty');
  const keys = ['A', 'B', 'C'];
  const hasTeams = keys.some((key) => teams[key] && teams[key].length);

  if (!hasTeams) {
    grid.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }

  grid.classList.remove('hidden');
  empty.classList.add('hidden');

  keys.forEach((key) => {
    const target = document.getElementById(`team-${key.toLowerCase()}`);
    target.innerHTML = '';
    (teams[key] || []).forEach((player) => {
      const row = document.createElement('div');
      row.className = 'team-player';
      row.innerHTML = `<strong>${escapeHtml(player)}</strong>`;
      target.appendChild(row);
    });
  });
}

function formatPrettyDate(dateString) {
  if (!dateString) return '--';
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return dateString;
  const dt = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(dt);
}

function startCountdown(gameDate, startTime) {
  if (state.countdownTimer) clearInterval(state.countdownTimer);

  const tick = () => {
    const target = new Date(`${gameDate}T${startTime}:00`);
    const now = new Date();
    const diff = target.getTime() - now.getTime();
    if (Number.isNaN(diff) || diff <= 0) {
      $('cd-d').textContent = '0';
      $('cd-h').textContent = '00';
      $('cd-m').textContent = '00';
      return;
    }
    const totalMinutes = Math.floor(diff / 60000);
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;
    $('cd-d').textContent = String(days);
    $('cd-h').textContent = String(hours).padStart(2, '0');
    $('cd-m').textContent = String(minutes).padStart(2, '0');
  };

  tick();
  state.countdownTimer = setInterval(tick, 30000);
}

async function submitJoinForm(event) {
  event.preventDefault();
  const input = $('join-name');
  const feedback = $('join-feedback');
  const name = input.value.trim();
  if (!name) return;

  try {
    await request('/api/join', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    feedback.textContent = 'Nome enviado com sucesso. Aguarde a aprovação do admin.';
    input.value = '';
    await loadPublicState();
    if (state.isAdmin) await loadAdminState();
  } catch (error) {
    feedback.textContent = error.message;
  }
}

function openAdmin() {
  $('admin-modal').classList.remove('hidden');
  $('admin-modal').setAttribute('aria-hidden', 'false');
}

function closeAdmin() {
  $('admin-modal').classList.add('hidden');
  $('admin-modal').setAttribute('aria-hidden', 'true');
}

async function loginAdmin(event) {
  event.preventDefault();
  const feedback = $('admin-login-feedback');
  feedback.textContent = '';
  try {
    await request('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({
        username: $('admin-user').value.trim(),
        password: $('admin-password').value,
      }),
    });
    state.isAdmin = true;
    $('admin-login-view').classList.add('hidden');
    $('admin-app-view').classList.remove('hidden');
    await loadAdminState();
  } catch (error) {
    feedback.textContent = error.message;
  }
}

async function loadAdminState() {
  const data = await request('/api/admin/state');
  state.adminData = data;
  renderAdmin();
}

function renderAdmin() {
  const data = state.adminData;
  if (!data) return;

  $('cfg-game-date').value = data.config.gameDate;
  $('cfg-arrival').value = data.config.arrivalTime;
  $('cfg-start').value = data.config.startTime;
  $('cfg-end').value = data.config.endTime;
  $('cfg-payment-link').value = data.config.paymentLink;
  $('cfg-max-slots').value = data.config.maxSlots;

  renderPendingAdmin(data.pendingMembers || []);
  renderAdminMembers(data.members || []);
  renderCaptainsPicker(data.members || []);
}

function renderPendingAdmin(items) {
  const container = $('pending-list');
  if (!items.length) {
    container.innerHTML = '<div class="empty-state">Nenhum pedido pendente no momento.</div>';
    return;
  }

  container.innerHTML = items.map((item) => `
    <div class="admin-item">
      <div>
        <div class="name">${escapeHtml(item.name)}</div>
        <div class="meta">Pedido enviado em ${escapeHtml(item.createdAtLabel)}</div>
      </div>
      <div class="row-actions">
        <button class="btn btn-primary btn-sm" data-approve-id="${item.id}">Aprovar</button>
        <button class="btn btn-danger btn-sm" data-delete-id="${item.id}">Remover</button>
      </div>
    </div>
  `).join('');
}

function renderAdminMembers(items) {
  const container = $('admin-members-list');
  if (!items.length) {
    container.innerHTML = '<div class="empty-state">Nenhum jogador confirmado ainda.</div>';
    return;
  }

  container.innerHTML = items.map((item, index) => `
    <div class="admin-item">
      <div>
        <div class="name">${index + 1}. ${escapeHtml(item.name)}</div>
        <div class="meta">Confirmado</div>
      </div>
      <div class="row-actions">
        <button class="btn btn-danger btn-sm" data-delete-id="${item.id}">Remover</button>
      </div>
    </div>
  `).join('');
}

function renderCaptainsPicker(items) {
  const container = $('captains-picker');
  if (!items.length) {
    container.innerHTML = '<div class="empty-state">Adicione jogadores para selecionar capitães.</div>';
    return;
  }

  container.innerHTML = items.map((item) => `
    <label class="captain-option">
      <input type="checkbox" value="${item.id}" />
      <span>${escapeHtml(item.name)}</span>
    </label>
  `).join('');
}

async function saveConfig(event) {
  event.preventDefault();
  const feedback = $('config-feedback');
  feedback.textContent = '';
  try {
    await request('/api/admin/config', {
      method: 'PUT',
      body: JSON.stringify({
        gameDate: $('cfg-game-date').value,
        arrivalTime: $('cfg-arrival').value,
        startTime: $('cfg-start').value,
        endTime: $('cfg-end').value,
        paymentLink: $('cfg-payment-link').value.trim(),
        maxSlots: Number($('cfg-max-slots').value),
      }),
    });
    feedback.textContent = 'Configurações salvas com sucesso.';
    await loadPublicState();
    await loadAdminState();
  } catch (error) {
    feedback.textContent = error.message;
  }
}

async function addConfirmedMember(event) {
  event.preventDefault();
  const input = $('add-member-name');
  const name = input.value.trim();
  if (!name) return;
  try {
    await request('/api/admin/members', {
      method: 'POST',
      body: JSON.stringify({ name, status: 'confirmed' }),
    });
    input.value = '';
    await Promise.all([loadPublicState(), loadAdminState()]);
  } catch (error) {
    alert(error.message);
  }
}

async function handleAdminListClick(event) {
  const approveId = event.target.getAttribute('data-approve-id');
  const deleteId = event.target.getAttribute('data-delete-id');
  if (!approveId && !deleteId) return;

  try {
    if (approveId) {
      await request('/api/admin/members', {
        method: 'PATCH',
        body: JSON.stringify({ id: Number(approveId), action: 'approve' }),
      });
    }
    if (deleteId) {
      await request('/api/admin/members', {
        method: 'DELETE',
        body: JSON.stringify({ id: Number(deleteId) }),
      });
    }
    await Promise.all([loadPublicState(), loadAdminState()]);
  } catch (error) {
    alert(error.message);
  }
}

async function generateTeams() {
  const ids = [...document.querySelectorAll('#captains-picker input:checked')].map((input) => Number(input.value));
  const feedback = $('teams-feedback');
  feedback.textContent = '';
  try {
    await request('/api/admin/teams', {
      method: 'POST',
      body: JSON.stringify({ captainIds: ids }),
    });
    feedback.textContent = 'Times gerados com sucesso.';
    await Promise.all([loadPublicState(), loadAdminState()]);
  } catch (error) {
    feedback.textContent = error.message;
  }
}

async function logoutAdmin() {
  await request('/api/admin/logout', { method: 'POST' });
  state.isAdmin = false;
  state.adminData = null;
  $('admin-login-view').classList.remove('hidden');
  $('admin-app-view').classList.add('hidden');
  $('admin-login-form').reset();
  closeAdmin();
}

function attachEvents() {
  $('join-form').addEventListener('submit', submitJoinForm);
  $('scroll-signup-btn').addEventListener('click', () => {
    $('signup-section').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  $('open-admin-btn').addEventListener('click', openAdmin);
  document.querySelectorAll('[data-close-modal]').forEach((node) => node.addEventListener('click', closeAdmin));
  $('admin-login-form').addEventListener('submit', loginAdmin);
  $('config-form').addEventListener('submit', saveConfig);
  $('add-member-form').addEventListener('submit', addConfirmedMember);
  $('pending-list').addEventListener('click', handleAdminListClick);
  $('admin-members-list').addEventListener('click', handleAdminListClick);
  $('generate-teams-btn').addEventListener('click', generateTeams);
  $('admin-refresh-btn').addEventListener('click', async () => {
    await Promise.all([loadPublicState(), loadAdminState()]);
  });
  $('admin-logout-btn').addEventListener('click', logoutAdmin);
}

async function bootstrap() {
  attachEvents();
  await loadPublicState();
  try {
    await loadAdminState();
    state.isAdmin = true;
    $('admin-login-view').classList.add('hidden');
    $('admin-app-view').classList.remove('hidden');
  } catch {
    state.isAdmin = false;
  }
}

bootstrap().catch((error) => {
  $('storage-badge').textContent = error.message || 'Erro ao carregar';
});
