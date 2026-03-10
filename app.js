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

  const { config, members, sponsors, teams, benchTeam, storage, stats, approvedPlayers } = data;
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
  renderTeams(teams, benchTeam);
  renderRankings(stats);
  populatePlayerDropdown(approvedPlayers || []);
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

    const avatarImg = node.querySelector('.confirmed-avatar');
    const avatarFallback = node.querySelector('.confirmed-avatar-fallback');
    if (member.photoData) {
      avatarImg.src = member.photoData;
      avatarImg.alt = member.name;
      avatarImg.style.display = 'block';
      avatarFallback.style.display = 'none';
    } else {
      avatarImg.style.display = 'none';
      avatarFallback.style.display = 'flex';
      avatarFallback.textContent = member.name.charAt(0).toUpperCase();
    }
    container.appendChild(node);
  });

  if (members.length < maxSlots) {
    for (let i = members.length; i < maxSlots; i += 1) {
      const empty = document.createElement('div');
      empty.className = 'confirmed-item confirmed-item--empty';
      empty.innerHTML = `<span class="confirmed-index">${i + 1}</span><div class="confirmed-avatar-wrap"><div class="confirmed-avatar-fallback" style="opacity:0.25">+</div></div><span class="confirmed-name" style="color: var(--muted)">Disponível</span>`;
      container.appendChild(empty);
    }
  }
}

function renderSponsors(sponsors) {
  const container = $('sponsor-grid-home');
  container.innerHTML = '';

  if (!sponsors || !sponsors.length) {
    container.innerHTML = '<div class="empty-state">Patrocinadores em atualização.</div>';
    return;
  }

  sponsors.forEach((sponsor) => {
    const phoneLink = sponsor.phone
      ? `https://wa.me/${String(sponsor.phone).replace(/\D/g, '')}`
      : '';

    const card = document.createElement('article');
    card.className = 'sponsor-feature-card';

    card.innerHTML = `
      <div class="sponsor-feature-media">
        <img src="${escapeHtml(sponsor.logoUrl || '')}" alt="${escapeHtml(sponsor.name)}" class="sponsor-feature-logo" />
      </div>
      <div class="sponsor-feature-body">
        <div class="sponsor-feature-kicker">Patrocinador</div>
        <h3 class="sponsor-feature-title">${escapeHtml(sponsor.name)}</h3>
        <div class="sponsor-feature-subtitle">${escapeHtml(sponsor.subtitle || '')}</div>
        <p class="sponsor-feature-description">${escapeHtml(sponsor.description || '')}</p>
        <div class="sponsor-feature-actions">
          <a class="btn btn-secondary" href="${escapeHtml(sponsor.url || '#')}" target="_blank" rel="noopener noreferrer">
            ${escapeHtml(sponsor.ctaLabel || 'Ver mais')}
          </a>
          ${phoneLink ? `
            <a class="btn btn-primary" href="${phoneLink}" target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
          ` : ''}
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

const TEAM_CONFIG = {
  Vermelho: { label: '🔴 Time Vermelho', id: 'team-vermelho', cardClass: 'team-card--vermelho' },
  Amarelo:  { label: '🟡 Time Amarelo',  id: 'team-amarelo',  cardClass: 'team-card--amarelo'  },
  Azul:     { label: '🔵 Time Azul',     id: 'team-azul',     cardClass: 'team-card--azul'     },
};

function renderTeams(teams, benchTeam) {
  const grid  = $('teams-grid');
  const empty = $('teams-empty');
  const keys  = ['Vermelho', 'Amarelo', 'Azul'];
  const hasTeams = keys.some((k) => teams[k] && teams[k].length);

  if (!hasTeams) {
    grid.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }

  grid.classList.remove('hidden');
  empty.classList.add('hidden');

  keys.forEach((key) => {
    const cfg    = TEAM_CONFIG[key];
    const target = $(cfg.id);
    const card   = target.closest('.team-card');
    const isBench = benchTeam === key;

    // Mark bench team
    card.classList.toggle('team-card--bench', isBench);

    // Bench badge on header
    const header = card.querySelector('.team-header');
    header.innerHTML = cfg.label + (isBench ? ' <span class="bench-badge">aguarda</span>' : '');

    target.innerHTML = '';
    (teams[key] || []).forEach((player, i) => {
      const row = document.createElement('div');
      row.className = 'team-player';
      row.innerHTML = `<span class="team-player-num">${i + 1}</span><strong>${escapeHtml(player)}</strong>`;
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

// ─── Photo capture & stylize ────────────────────────────────────────────────

const photoState = { dataUrl: null };
const proofState = { dataUrl: null };

function initPhotoUpload() {
  // Profile photo (with face crop + filter)
  const area   = $('photo-upload-area');
  const input  = $('photo-input');
  const canvas = $('photo-canvas');
  const regBtn = $('register-submit-btn');
  if (area && input) {
    area.addEventListener('click', () => input.click());
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => processPhoto(ev.target.result, canvas, () => {
        area.classList.add('has-photo');
        $('photo-preview-wrap').style.display = 'flex';
        if (regBtn) regBtn.disabled = false;
      });
      reader.readAsDataURL(file);
    });
  }

  // Payment proof (no crop, just compress)
  const proofArea  = $('proof-upload-area');
  const proofInput = $('proof-input');
  const joinBtn    = $('join-submit-btn');
  if (proofArea && proofInput) {
    proofArea.addEventListener('click', () => proofInput.click());
    proofInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        compressImage(ev.target.result, 800, 0.82, (dataUrl) => {
          proofState.dataUrl = dataUrl;
          const img = $('proof-preview-img');
          img.src = dataUrl;
          img.style.display = 'block';
          $('proof-preview-wrap').style.display = 'flex';
          $('proof-instructions').style.display = 'none';
          proofArea.classList.add('has-photo');
          updateJoinSubmitState();
        });
      };
      reader.readAsDataURL(file);
    });
  }

  // Signup tabs
  document.querySelectorAll('.signup-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.signup-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.signupTab;
      $('signup-panel-register').classList.toggle('hidden', target !== 'register');
      $('signup-panel-join').classList.toggle('hidden', target !== 'join');
    });
  });
}

function compressImage(srcDataUrl, maxDim, quality, callback) {
  const img = new Image();
  img.onload = () => {
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    callback(canvas.toDataURL('image/jpeg', quality));
  };
  img.src = srcDataUrl;
}

function updateJoinSubmitState() {
  const btn = $('join-submit-btn');
  const playerSelected = $('join-player-select')?.value;
  if (btn) btn.disabled = !(playerSelected && proofState.dataUrl);
}

function populatePlayerDropdown(players) {
  const sel = $('join-player-select');
  if (!sel) return;
  if (!players || !players.length) {
    sel.innerHTML = '<option value="">Nenhum jogador aprovado ainda</option>';
    return;
  }
  sel.innerHTML = '<option value="">Selecione seu perfil...</option>' +
    players.map((p) => `<option value="${p.id}">${escapeHtml(p.fullName)} — ${p.state}</option>`).join('');
  sel.addEventListener('change', updateJoinSubmitState);
}

function processPhoto(srcDataUrl, canvas, onDone) {
  const img = new Image();
  img.onload = () => {
    const size = 120;
    const ctx = canvas.getContext('2d');
    canvas.width = size;
    canvas.height = size;

    const minDim = Math.min(img.width, img.height);
    const cropSize = minDim;
    const sx = (img.width - cropSize) / 2;
    const sy = Math.max(0, (img.height - cropSize) * 0.25);

    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.filter = 'contrast(1.25) saturate(0.75) brightness(1.05)';
    ctx.drawImage(img, sx, sy, cropSize, cropSize, 0, 0, size, size);
    ctx.restore();

    const vignette = ctx.createRadialGradient(size/2, size/2, size*0.3, size/2, size/2, size/2);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.save();
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/2, 0, Math.PI*2);
    ctx.clip();
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, size, size);
    ctx.restore();

    photoState.dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    if (onDone) onDone();
  };
  img.src = srcDataUrl;
}

async function submitRegisterForm(event) {
  event.preventDefault();
  const feedback = $('register-feedback');
  const btn = $('register-submit-btn');
  feedback.textContent = '';

  const firstName = $('reg-first-name').value.trim();
  const lastName  = $('reg-last-name').value.trim();
  const phone     = $('reg-phone').value.trim();
  const state     = $('reg-state').value;

  if (!firstName || !lastName) { feedback.textContent = 'Nome e sobrenome são obrigatórios.'; return; }
  if (!state) { feedback.textContent = 'Selecione seu estado.'; return; }
  if (!photoState.dataUrl) { feedback.textContent = 'Adicione sua foto de perfil.'; return; }

  btn.disabled = true;
  btn.textContent = 'Enviando…';

  try {
    await request('/api/register', {
      method: 'POST',
      body: JSON.stringify({ firstName, lastName, phone, state, photoData: photoState.dataUrl }),
    });
    feedback.style.color = 'var(--green)';
    feedback.textContent = '✓ Cadastro enviado! Aguarde a aprovação do admin para entrar na lista.';
    $('register-form').reset();
    photoState.dataUrl = null;
    $('photo-upload-area')?.classList.remove('has-photo');
    $('photo-canvas')?.getContext('2d').clearRect(0, 0, 120, 120);
    btn.disabled = true;
    btn.textContent = 'Cadastrar perfil';
  } catch (err) {
    feedback.style.color = 'var(--yellow)';
    feedback.textContent = err.message;
    btn.disabled = false;
    btn.textContent = 'Cadastrar perfil';
  }
}

async function submitJoinForm(event) {
  event.preventDefault();
  const feedback = $('join-feedback');
  const btn = $('join-submit-btn');
  const playerId = Number($('join-player-select').value);

  if (!playerId) { feedback.textContent = 'Selecione seu perfil.'; return; }
  if (!proofState.dataUrl) { feedback.textContent = 'Anexe o comprovante de pagamento.'; return; }

  btn.disabled = true;
  btn.textContent = 'Enviando…';
  feedback.textContent = '';

  try {
    await request('/api/join', {
      method: 'POST',
      body: JSON.stringify({ playerId, paymentProof: proofState.dataUrl }),
    });
    feedback.style.color = 'var(--green)';
    feedback.textContent = '✓ Pedido enviado! Aguarde a aprovação do admin.';
    proofState.dataUrl = null;
    $('proof-upload-area')?.classList.remove('has-photo');
    const img = $('proof-preview-img');
    if (img) { img.src = ''; img.style.display = 'none'; }
    $('proof-instructions').style.display = '';
    $('join-player-select').value = '';
    btn.disabled = true;
    btn.textContent = 'Entrar na lista';
    await loadPublicState();
    if (state.isAdmin) await loadAdminState();
  } catch (err) {
    feedback.style.color = 'var(--yellow)';
    feedback.textContent = err.message;
    btn.disabled = false;
    btn.textContent = 'Entrar na lista';
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

  renderPendingPlayers(data.pendingPlayers || []);
  renderApprovedPlayers(data.approvedPlayers || []);
  renderPendingAdmin(data.pendingMembers || []);
  renderAdminMembers(data.members || []);
  renderCaptainsPicker(data.members || []);
  renderAdminGameResults(data.members || [], data.gameDays || []);
}

function renderPendingPlayers(items) {
  const container = $('pending-players-list');
  if (!items.length) {
    container.innerHTML = '<div class="empty-state">Nenhum cadastro pendente.</div>';
    return;
  }
  container.innerHTML = items.map((p) => `
    <div class="admin-item">
      <div class="admin-item-profile">
        ${p.photoData ? `<img class="admin-player-avatar" src="${p.photoData}" alt="${escapeHtml(p.fullName)}" />` : `<div class="admin-player-avatar admin-player-avatar-fallback">${p.firstName.charAt(0)}</div>`}
        <div>
          <div class="name">${escapeHtml(p.fullName)}</div>
          <div class="meta">${escapeHtml(p.state)} · ${escapeHtml(p.phone || '—')} · ${escapeHtml(p.createdAtLabel)}</div>
        </div>
      </div>
      <div class="row-actions">
        <button class="btn btn-primary btn-sm" data-approve-player="${p.id}">Aprovar</button>
        <button class="btn btn-danger btn-sm" data-delete-player="${p.id}">Rejeitar</button>
      </div>
    </div>
  `).join('');
}

function renderApprovedPlayers(items) {
  const container = $('approved-players-list');
  if (!items.length) {
    container.innerHTML = '<div class="empty-state">Nenhum jogador aprovado ainda.</div>';
    return;
  }
  container.innerHTML = items.map((p) => `
    <div class="admin-item">
      <div class="admin-item-profile">
        ${p.photoData ? `<img class="admin-player-avatar" src="${p.photoData}" alt="${escapeHtml(p.fullName)}" />` : `<div class="admin-player-avatar admin-player-avatar-fallback">${p.firstName.charAt(0)}</div>`}
        <div>
          <div class="name">${escapeHtml(p.fullName)}</div>
          <div class="meta">${escapeHtml(p.state)} · ${escapeHtml(p.phone || '—')}</div>
        </div>
      </div>
      <div class="row-actions">
        <button class="btn btn-danger btn-sm" data-delete-player="${p.id}">Remover</button>
      </div>
    </div>
  `).join('');
}

async function handlePlayerListClick(event) {
  const approveId = event.target.getAttribute('data-approve-player');
  const deleteId  = event.target.getAttribute('data-delete-player');
  if (!approveId && !deleteId) return;
  try {
    if (approveId) {
      await request('/api/admin/players', {
        method: 'PATCH',
        body: JSON.stringify({ id: Number(approveId), action: 'approve' }),
      });
    }
    if (deleteId) {
      await request('/api/admin/players', {
        method: 'DELETE',
        body: JSON.stringify({ id: Number(deleteId) }),
      });
    }
    await Promise.all([loadPublicState(), loadAdminState()]);
  } catch (err) {
    alert(err.message);
  }
}

function renderPendingAdmin(items) {
  const container = $('pending-list');
  if (!items.length) {
    container.innerHTML = '<div class="empty-state">Nenhum pedido pendente no momento.</div>';
    return;
  }

  container.innerHTML = items.map((item) => `
    <div class="admin-item">
      <div class="admin-item-profile">
        ${item.photoData ? `<img class="admin-player-avatar" src="${item.photoData}" alt="${escapeHtml(item.name)}" />` : `<div class="admin-player-avatar admin-player-avatar-fallback">${item.name.charAt(0)}</div>`}
        <div>
          <div class="name">${escapeHtml(item.name)}</div>
          <div class="meta">Pedido em ${escapeHtml(item.createdAtLabel)}</div>
        </div>
      </div>
      <div class="row-actions">
        ${item.paymentProof ? `<a class="btn btn-ghost btn-sm" href="${item.paymentProof}" target="_blank" rel="noopener">Ver comprovante</a>` : ''}
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

// ─── Rankings ────────────────────────────────────────────────────────────────

function renderRankings(stats) {
  if (!stats) return;
  renderGoat(stats.goatRanking || [], stats.totalDays || 0);
  renderGoldenBoot(stats.goldenBoot || []);
}

function avatarHtml(player, size = 40) {
  if (player.photo) {
    return `<img class="rank-avatar" src="${player.photo}" alt="${escapeHtml(player.name)}" style="width:${size}px;height:${size}px" />`;
  }
  return `<div class="rank-avatar rank-avatar-fallback" style="width:${size}px;height:${size}px">${escapeHtml(player.name.charAt(0).toUpperCase())}</div>`;
}

function renderGoat(ranking, totalDays) {
  const container = $('goat-list');
  if (!ranking.length) {
    container.innerHTML = `<div class="empty-state">Nenhum dado ainda. Registre os resultados após o jogo!</div>`;
    return;
  }
  const maxMinutes = ranking[0]?.totalMinutes || 1;
  container.innerHTML = ranking.map((p, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
    const barPct = Math.min(100, (p.totalMinutes / Math.max(1, totalDays * 120)) * 100);
    return `
      <div class="rank-item">
        <div class="rank-medal">${medal}</div>
        ${avatarHtml(p)}
        <div class="rank-info">
          <div class="rank-name">${escapeHtml(p.name)}</div>
          <div class="rank-bar-wrap">
            <div class="rank-bar" style="width:${barPct}%"></div>
          </div>
          <div class="rank-meta">${p.totalMinutes.toFixed(1)} min · ${p.ratio}% do tempo total</div>
        </div>
        <div class="rank-value">${p.ratio}%</div>
      </div>`;
  }).join('');
}

function renderGoldenBoot(ranking) {
  const container = $('boot-list');
  if (!ranking.length) {
    container.innerHTML = `<div class="empty-state">Nenhum gol registrado ainda.</div>`;
    return;
  }
  container.innerHTML = ranking.map((p, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
    return `
      <div class="rank-item">
        <div class="rank-medal">${medal}</div>
        ${avatarHtml(p)}
        <div class="rank-info">
          <div class="rank-name">${escapeHtml(p.name)}</div>
          <div class="rank-meta">${p.totalGoals} gol${p.totalGoals !== 1 ? 's' : ''}</div>
        </div>
        <div class="rank-value rank-value--goals">⚽ ${p.totalGoals}</div>
      </div>`;
  }).join('');
}

// ─── Admin: game results ─────────────────────────────────────────────────────

function renderAdminGameResults(members, gameDays) {
  // Populate goals grid with confirmed members
  const goalsGrid = $('gr-goals-list');
  if (!goalsGrid) return;

  if (!members || !members.length) {
    goalsGrid.innerHTML = '<div class="empty-state">Adicione jogadores confirmados primeiro.</div>';
  } else {
    goalsGrid.innerHTML = members.map((m) => `
      <div class="gr-goal-row">
        ${m.photoData ? `<img class="gr-goal-avatar" src="${m.photoData}" alt="${escapeHtml(m.name)}" />` : `<div class="gr-goal-avatar gr-goal-avatar-fallback">${m.name.charAt(0).toUpperCase()}</div>`}
        <span class="gr-goal-name">${escapeHtml(m.name)}</span>
        <div class="gr-goal-counter">
          <button type="button" class="gr-count-btn" data-action="dec" data-name="${escapeHtml(m.name)}">−</button>
          <span class="gr-count-val" id="goals-${escapeHtml(m.name).replace(/\s/g, '_')}">0</span>
          <button type="button" class="gr-count-btn" data-action="inc" data-name="${escapeHtml(m.name)}">+</button>
        </div>
      </div>
    `).join('');
  }

  // Set today's date as default
  if ($('gr-date') && !$('gr-date').value) {
    $('gr-date').value = new Date().toISOString().slice(0, 10);
  }

  // Render game day history
  renderGameDayHistory(gameDays || []);
}

function renderGameDayHistory(gameDays) {
  const container = $('gr-history');
  if (!container) return;
  if (!gameDays.length) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = `
    <h4 class="top-gap">Histórico de jogos</h4>
    ${gameDays.map((d) => `
      <div class="admin-item">
        <div><div class="name">${d.game_date}</div></div>
        <div class="row-actions">
          <button class="btn btn-danger btn-sm" data-delete-gameday="${d.id}">Remover</button>
        </div>
      </div>
    `).join('')}
  `;
}

async function saveGameResults() {
  const feedback = $('gr-feedback');
  feedback.textContent = '';
  feedback.style.color = 'var(--yellow)';

  const gameDate = $('gr-date').value;
  if (!gameDate) { feedback.textContent = 'Selecione a data do jogo.'; return; }

  const teamResults = {
    Vermelho: { wins: Number($('gr-wins-Vermelho').value || 0), losses: Number($('gr-losses-Vermelho').value || 0) },
    Amarelo:  { wins: Number($('gr-wins-Amarelo').value  || 0), losses: Number($('gr-losses-Amarelo').value  || 0) },
    Azul:     { wins: Number($('gr-wins-Azul').value     || 0), losses: Number($('gr-losses-Azul').value     || 0) },
  };

  // Collect goals
  const playerGoals = [];
  document.querySelectorAll('#gr-goals-list .gr-goal-row').forEach((row) => {
    const name = row.querySelector('.gr-goal-name').textContent;
    const valEl = row.querySelector('.gr-count-val');
    const goals = Number(valEl?.textContent || 0);
    playerGoals.push({ name, goals });
  });

  try {
    const btn = $('save-game-results-btn');
    btn.disabled = true;
    btn.textContent = 'Salvando…';
    const data = await request('/api/admin/game-results', {
      method: 'POST',
      body: JSON.stringify({ gameDate, teamResults, playerGoals }),
    });
    feedback.style.color = 'var(--green)';
    feedback.textContent = '✓ Resultado salvo com sucesso!';
    // Reset counters
    document.querySelectorAll('.gr-count-val').forEach((el) => { el.textContent = '0'; });
    ['Vermelho', 'Amarelo', 'Azul'].forEach((t) => {
      $(`gr-wins-${t}`).value = '0';
      $(`gr-losses-${t}`).value = '0';
    });
    state.publicData = data.state;
    renderPublic();
    // Refresh history
    const histData = await request('/api/admin/game-results');
    renderGameDayHistory(histData.gameDays || []);
  } catch (err) {
    feedback.textContent = err.message;
  } finally {
    const btn = $('save-game-results-btn');
    btn.disabled = false;
    btn.textContent = 'Salvar resultado';
  }
}

function attachEvents() {
  $('register-form').addEventListener('submit', submitRegisterForm);
  $('join-form').addEventListener('submit', submitJoinForm);
  $('scroll-signup-btn').addEventListener('click', () => {
    $('signup-section').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  $('open-admin-btn').addEventListener('click', openAdmin);
  document.querySelectorAll('[data-close-modal]').forEach((node) => node.addEventListener('click', closeAdmin));
  $('admin-login-form').addEventListener('submit', loginAdmin);
  $('config-form').addEventListener('submit', saveConfig);
  $('add-member-form').addEventListener('submit', addConfirmedMember);
  $('pending-players-list').addEventListener('click', handlePlayerListClick);
  $('approved-players-list').addEventListener('click', handlePlayerListClick);
  $('pending-list').addEventListener('click', handleAdminListClick);
  $('admin-members-list').addEventListener('click', handleAdminListClick);
  $('generate-teams-btn').addEventListener('click', generateTeams);
  $('save-game-results-btn').addEventListener('click', saveGameResults);
  $('admin-refresh-btn').addEventListener('click', async () => {
    await Promise.all([loadPublicState(), loadAdminState()]);
  });
  $('admin-logout-btn').addEventListener('click', logoutAdmin);

  // Ranking tabs
  document.querySelectorAll('.ranking-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.ranking-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      $('ranking-goat').classList.toggle('hidden', target !== 'goat');
      $('ranking-boot').classList.toggle('hidden', target !== 'boot');
    });
  });

  // Goal counter buttons (delegated)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.gr-count-btn');
    if (!btn) return;
    const name = btn.dataset.name;
    const id = `goals-${name.replace(/\s/g, '_')}`;
    const el = document.getElementById(id);
    if (!el) return;
    let val = Number(el.textContent);
    if (btn.dataset.action === 'inc') val++;
    if (btn.dataset.action === 'dec' && val > 0) val--;
    el.textContent = String(val);
  });

  // Delete game day (delegated)
  $('gr-history')?.addEventListener('click', async (e) => {
    const id = e.target.getAttribute('data-delete-gameday');
    if (!id) return;
    if (!confirm('Remover este dia de jogo e todos os dados relacionados?')) return;
    try {
      await request('/api/admin/game-results', {
        method: 'DELETE',
        body: JSON.stringify({ id: Number(id) }),
      });
      const histData = await request('/api/admin/game-results');
      renderGameDayHistory(histData.gameDays || []);
      await loadPublicState();
    } catch (err) {
      alert(err.message);
    }
  });
}

async function bootstrap() {
  attachEvents();
  initPhotoUpload();

  // Triple-click on logo opens admin (hidden entry point)
  const logo = document.querySelector('.club-logo');
  if (logo) {
    let clickCount = 0, clickTimer = null;
    logo.style.cursor = 'pointer';
    logo.addEventListener('click', () => {
      clickCount++;
      clearTimeout(clickTimer);
      clickTimer = setTimeout(() => { clickCount = 0; }, 600);
      if (clickCount >= 3) {
        clickCount = 0;
        openAdmin();
      }
    });
  }

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
