import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

const DEFAULT_CONFIG = {
  paymentAmount: 4,
  paymentUrl: 'https://tikkie.me/SEU-LINK-AQUI',
  venue: 'ACLO Groningen',
  address: 'Blauwborgje 16, 9747 AC Groningen',
  mapsUrl: 'https://maps.google.com/?q=Blauwborgje+16,+9747+AC+Groningen',
  gameDate: '',
  arrival: '14:50',
  start: '15:00',
  end: '17:00',
  maxSlots: 18
};

const DEFAULT_SPONSORS = [
  {
    id: 'global-food-import',
    name: 'Global Food Import',
    tagline: 'Importadora tropical em Groningen',
    description: 'Conecta produtos naturais tropicais ao mercado europeu com presença local em Groningen.',
    website: 'https://globalfoodimport.com/',
    whatsapp: 'https://wa.me/31640357378',
    badge: 'Parceiro oficial',
    theme: 'gold',
    highlights: [
      { title: 'Distribuição local', text: 'Atendimento na região norte da Holanda.' },
      { title: 'Portfólio tropical', text: 'Produtos naturais e conexão direta com a Amazônia.' }
    ]
  },
  {
    id: 'tribe-the-native-food',
    name: 'Tribe The Native Food',
    tagline: 'Açaí e ingredientes amazônicos',
    description: 'Marca com foco em açaí, sorbets naturais e soluções para food service.',
    website: 'https://tribeacai.com/',
    whatsapp: 'https://tribeacai.com/en/b2b/',
    badge: 'Marca parceira',
    theme: 'green',
    highlights: [
      { title: 'Natural', text: 'Posicionamento clean label e proposta vegana.' },
      { title: 'B2B', text: 'Soluções para horeca, revenda e operação profissional.' }
    ]
  },
  {
    id: 'ramos-klus-schoonmaak',
    name: 'Ramos Klus & Schoonmaak',
    tagline: 'Serviços locais em Groningen',
    description: 'Rede local de manutenção e limpeza que fortalece a comunidade brasileira da região.',
    website: '',
    whatsapp: '',
    badge: 'Serviços locais',
    theme: 'blue',
    highlights: [
      { title: 'Atuação regional', text: 'Presença próxima da comunidade.' },
      { title: 'Conexão local', text: 'Suporte a negócios e parcerias em Groningen.' }
    ]
  }
];

const state = {
  config: { ...DEFAULT_CONFIG },
  game: { players: {}, pending: {}, teams: null },
  sponsors: [...DEFAULT_SPONSORS],
  isAdmin: false,
  selectedCaptains: [],
  uploadedReceipt: '',
  firebaseReady: false,
  usingLocal: true,
  meta: {
    storageMode: 'local',
    syncState: 'Carregando cache…',
    lastSavedAt: null,
    lastRemoteSyncAt: null
  }
};

const storageKeys = {
  config: 'brazuca_v5_config',
  game: 'brazuca_v5_game',
  sponsors: 'brazuca_v5_sponsors',
  meta: 'brazuca_v5_meta'
};

const legacyKeys = {
  config: 'brazuca_v4_config',
  game: 'brazuca_v4_game',
  sponsors: 'brazuca_v4_sponsors'
};

const els = {
  tabs: [...document.querySelectorAll('.nav-btn')],
  tabPanels: [...document.querySelectorAll('.tab')],
  payBtn: document.getElementById('pay-btn'),
  signupBtn: document.getElementById('signup-btn'),
  adminFab: document.getElementById('admin-fab'),
  toast: document.getElementById('toast'),
  pendingBadge: document.getElementById('pending-badge'),
  storageBadge: document.getElementById('storage-badge'),
  storageInline: document.getElementById('storage-inline'),
  adminStatus: document.getElementById('admin-status')
};

let app = null;
let db = null;
let auth = null;
let unsubscribers = [];
let toastTimer = null;

function euro(value) {
  return `€${Number(value || 0).toFixed(2).replace('.', ',')}`;
}

function toast(message, type = '') {
  els.toast.textContent = message;
  els.toast.className = `toast ${type}`.trim();
  els.toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.add('hidden'), 2600);
}

function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function nowLabel(date = new Date()) {
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatGameDate(dateString) {
  if (!dateString) return 'Data a definir';
  const parsed = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return 'Data a definir';
  return parsed.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
}

function updateStorageMeta(partial) {
  state.meta = { ...state.meta, ...partial };
  saveLocal(storageKeys.meta, state.meta);
  renderStorageStatus();
}

function renderStorageStatus() {
  const modeLabel = state.firebaseReady ? 'Firebase + cache local' : 'Cache local do navegador';
  const lastSaved = state.meta.lastSavedAt ? `Último save: ${state.meta.lastSavedAt}` : 'Ainda sem salvamento';
  const remoteInfo = state.meta.lastRemoteSyncAt ? ` · Sync remoto: ${state.meta.lastRemoteSyncAt}` : '';
  const text = `${modeLabel} · ${state.meta.syncState}`;
  if (els.storageBadge) els.storageBadge.textContent = text;
  if (els.storageInline) els.storageInline.textContent = `${text} · ${lastSaved}${remoteInfo}`;
  if (els.adminStatus) els.adminStatus.textContent = `${text}. ${lastSaved}${remoteInfo}`;
}

function getAvailableSlots() {
  const maxSlots = Number(state.config.maxSlots || DEFAULT_CONFIG.maxSlots);
  const available = [];
  for (let i = 1; i <= maxSlots; i += 1) {
    if (!state.game.players[i]) available.push(i);
  }
  return available;
}

function resolveGameDate() {
  if (state.config.gameDate) {
    const target = new Date(`${state.config.gameDate}T${state.config.start || '15:00'}:00`);
    if (!Number.isNaN(target.getTime())) return target;
  }
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? (now.getHours() >= 17 ? 7 : 0) : 7 - day;
  const target = new Date(now);
  target.setDate(now.getDate() + diff);
  const [hours, minutes] = String(state.config.start || '15:00').split(':').map(Number);
  target.setHours(hours || 15, minutes || 0, 0, 0);
  return target;
}

function updateCountdown() {
  const target = resolveGameDate();
  const now = new Date();
  const diff = target - now;
  document.getElementById('hero-date').textContent = target.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase();
  document.getElementById('game-date-inline').textContent = formatGameDate(state.config.gameDate || target.toISOString().slice(0, 10));
  if (diff <= 0) {
    ['cd-d', 'cd-h', 'cd-m'].forEach((id) => { document.getElementById(id).textContent = '00'; });
    return;
  }
  document.getElementById('cd-d').textContent = String(Math.floor(diff / 86400000)).padStart(2, '0');
  document.getElementById('cd-h').textContent = String(Math.floor((diff % 86400000) / 3600000)).padStart(2, '0');
  document.getElementById('cd-m').textContent = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
}

function renderTopInfo() {
  document.getElementById('hero-arrival').textContent = `Chegada ${state.config.arrival}`;
  document.getElementById('hero-window').textContent = `${state.config.start} — ${state.config.end}`;
  document.getElementById('venue-name').textContent = state.config.venue;
  document.getElementById('venue-address').textContent = state.config.address;
  document.getElementById('payment-inline').textContent = `${euro(state.config.paymentAmount)} por jogador`;
  document.getElementById('maps-link').href = state.config.mapsUrl;
  document.getElementById('pay-btn').textContent = `Pagar ${euro(state.config.paymentAmount)}`;
  document.getElementById('max-slots-label').textContent = state.config.maxSlots;
}

function renderSlots() {
  const container = document.getElementById('slots-grid');
  const maxSlots = Number(state.config.maxSlots || 18);
  const players = state.game.players || {};
  const pending = state.game.pending || {};
  const pendingBySlot = Object.values(pending).reduce((acc, item) => {
    acc[item.slot] = item;
    return acc;
  }, {});

  let confirmedCount = 0;
  let html = '';
  for (let slot = 1; slot <= maxSlots; slot += 1) {
    const playerName = players[slot];
    const pendingRequest = pendingBySlot[slot];
    const isExtra = slot === maxSlots;
    if (playerName) confirmedCount += 1;
    const classes = ['slot'];
    let tag = '';
    let displayName = 'Disponível';
    if (playerName) {
      classes.push('filled');
      displayName = playerName;
      if (state.isAdmin) tag = `<button class="btn btn-danger btn-sm" data-remove-slot="${slot}">Remover</button>`;
    } else if (pendingRequest) {
      classes.push('pending');
      displayName = pendingRequest.name;
      tag = '<span class="slot-tag">Pendente</span>';
    } else if (isExtra) {
      classes.push('extra');
      tag = '<span class="slot-tag">Extra</span>';
    }

    html += `
      <article class="${classes.join(' ')}">
        <div class="slot-num">Vaga ${slot}</div>
        <div class="slot-name">${displayName}</div>
        ${tag}
      </article>
    `;
  }

  container.innerHTML = html;
  document.getElementById('players-count').textContent = confirmedCount;
  document.getElementById('progress-count').textContent = confirmedCount;
  document.getElementById('progress-fill').style.width = `${(confirmedCount / Math.max(maxSlots, 1)) * 100}%`;

  container.querySelectorAll('[data-remove-slot]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.stopPropagation();
      const slot = Number(button.dataset.removeSlot);
      const name = state.game.players[slot];
      if (!name) return;
      if (!window.confirm(`Remover ${name} da vaga ${slot}?`)) return;
      delete state.game.players[slot];
      await persistGame();
      renderAll();
      toast('Jogador removido.');
    });
  });
}

function renderTeams() {
  const empty = document.getElementById('teams-empty');
  const grid = document.getElementById('teams-grid');
  const teams = state.game.teams;
  if (!teams || !teams.A) {
    empty.classList.remove('hidden');
    grid.classList.add('hidden');
    return;
  }
  empty.classList.add('hidden');
  grid.classList.remove('hidden');
  ['A', 'B', 'C'].forEach((key) => {
    const container = document.getElementById(`team-${key.toLowerCase()}`);
    const team = teams[key];
    const rows = [`<div class="team-player"><strong>${team.captain}</strong><span>Capitão</span></div>`];
    (team.players || []).forEach((name) => rows.push(`<div class="team-player"><span>${name}</span><span>⚽</span></div>`));
    container.innerHTML = rows.join('');
  });
}

function sponsorActions(sponsor) {
  const actions = [];
  if (sponsor.website) actions.push(`<a class="btn btn-primary btn-sm" href="${sponsor.website}" target="_blank" rel="noopener">Website</a>`);
  if (sponsor.whatsapp) actions.push(`<a class="btn btn-secondary btn-sm" href="${sponsor.whatsapp}" target="_blank" rel="noopener">Contato</a>`);
  return actions.join('');
}

function renderSponsors() {
  const stack = document.getElementById('sponsor-stack');
  stack.innerHTML = state.sponsors.map((sponsor) => {
    const highlights = (sponsor.highlights || []).slice(0, 2).map((item) => `
      <div class="sponsor-highlight">
        <strong>${item.title}</strong>
        <span>${item.text}</span>
      </div>
    `).join('');

    return `
      <article class="sponsor-card theme-${sponsor.theme || 'gold'}">
        <div class="sponsor-top">
          <span class="sponsor-badge">${sponsor.badge || 'Parceiro'}</span>
        </div>
        <h3 class="sponsor-name">${sponsor.name}</h3>
        <div class="sponsor-tagline">${sponsor.tagline || ''}</div>
        <p class="sponsor-description">${sponsor.description || ''}</p>
        <div class="sponsor-highlights">${highlights}</div>
        <div class="inline-actions">${sponsorActions(sponsor)}</div>
      </article>
    `;
  }).join('');
}

function renderPending() {
  const pendingList = document.getElementById('pending-list');
  const empty = document.getElementById('pending-empty');
  const items = Object.entries(state.game.pending || {});
  els.pendingBadge.textContent = String(items.length);
  els.pendingBadge.classList.toggle('hidden', items.length === 0);

  if (!items.length) {
    pendingList.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  pendingList.innerHTML = items.map(([id, item]) => `
    <article class="pending-item">
      <div class="pending-top">
        <div>
          <strong>${item.name}</strong>
          <div class="subcopy">Vaga ${item.slot}</div>
        </div>
        <div class="inline-actions">
          <button class="btn btn-primary btn-sm" data-approve="${id}">Aprovar</button>
          <button class="btn btn-danger btn-sm" data-reject="${id}">Rejeitar</button>
        </div>
      </div>
      ${item.receipt ? `<img src="${item.receipt}" alt="Comprovante de ${item.name}" />` : '<div class="subcopy">Sem comprovante anexado</div>'}
    </article>
  `).join('');

  pendingList.querySelectorAll('[data-approve]').forEach((button) => button.addEventListener('click', () => approvePending(button.dataset.approve)));
  pendingList.querySelectorAll('[data-reject]').forEach((button) => button.addEventListener('click', () => rejectPending(button.dataset.reject)));
}

function renderSelectOptions() {
  const slots = getAvailableSlots();
  const selects = [document.getElementById('admin-player-slot'), document.getElementById('signup-slot')];
  selects.forEach((select) => {
    const current = select.value;
    select.innerHTML = slots.length
      ? slots.map((slot) => `<option value="${slot}">Vaga ${slot}${slot === Number(state.config.maxSlots) ? ' (extra)' : ''}</option>`).join('')
      : '<option value="">Sem vagas disponíveis</option>';
    if (slots.includes(Number(current))) select.value = current;
  });
}

function renderConfigForm() {
  document.getElementById('cfg-game-date').value = state.config.gameDate || '';
  document.getElementById('cfg-payment-url').value = state.config.paymentUrl;
  document.getElementById('cfg-arrival').value = state.config.arrival;
  document.getElementById('cfg-start').value = state.config.start;
  document.getElementById('cfg-end').value = state.config.end;
  document.getElementById('cfg-max-slots').value = state.config.maxSlots;
}

function renderCaptains() {
  const container = document.getElementById('captains-list');
  const players = Object.values(state.game.players || {});
  container.innerHTML = players.map((name) => `
    <div class="captain-item ${state.selectedCaptains.includes(name) ? 'selected' : ''}" data-captain="${name}">
      <strong>${name}</strong>
      <span>${state.selectedCaptains.includes(name) ? 'Selecionado' : 'Disponível'}</span>
    </div>
  `).join('');
  container.querySelectorAll('[data-captain]').forEach((item) => item.addEventListener('click', () => toggleCaptain(item.dataset.captain)));
}

function renderAll() {
  renderTopInfo();
  renderSlots();
  renderTeams();
  renderSponsors();
  renderPending();
  renderSelectOptions();
  renderConfigForm();
  renderStorageStatus();
  updateCountdown();
}

function saveLocal(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function loadLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function migrateLegacyLocalData() {
  if (!localStorage.getItem(storageKeys.config) && localStorage.getItem(legacyKeys.config)) {
    localStorage.setItem(storageKeys.config, localStorage.getItem(legacyKeys.config));
  }
  if (!localStorage.getItem(storageKeys.game) && localStorage.getItem(legacyKeys.game)) {
    localStorage.setItem(storageKeys.game, localStorage.getItem(legacyKeys.game));
  }
  if (!localStorage.getItem(storageKeys.sponsors) && localStorage.getItem(legacyKeys.sponsors)) {
    localStorage.setItem(storageKeys.sponsors, localStorage.getItem(legacyKeys.sponsors));
  }
}

function mirrorStateToLocal() {
  saveLocal(storageKeys.config, state.config);
  saveLocal(storageKeys.game, state.game);
  saveLocal(storageKeys.sponsors, state.sponsors);
  updateStorageMeta({ lastSavedAt: nowLabel() });
}

async function persistDoc(remoteDoc, payload, successLabel) {
  mirrorStateToLocal();
  if (!state.firebaseReady || !db) {
    updateStorageMeta({ storageMode: 'local', syncState: 'Salvo localmente' });
    return;
  }

  try {
    await setDoc(doc(db, 'brazuca', remoteDoc), { ...payload, updatedAt: serverTimestamp() }, { merge: true });
    updateStorageMeta({ storageMode: 'firebase', syncState: successLabel, lastRemoteSyncAt: nowLabel() });
  } catch (error) {
    console.error(error);
    updateStorageMeta({ storageMode: 'local', syncState: 'Falha remota; cache local preservado' });
    toast('Falha ao sincronizar com o Firebase. O cache local foi preservado.', 'error');
  }
}

async function persistConfig() {
  await persistDoc('config', state.config, 'Config sincronizada');
}

async function persistGame() {
  await persistDoc('game', state.game, 'Lista sincronizada');
}

async function seedIfNeeded() {
  if (!state.firebaseReady || !db) return;
  const configRef = doc(db, 'brazuca', 'config');
  const gameRef = doc(db, 'brazuca', 'game');
  const sponsorsRef = doc(db, 'brazuca', 'sponsors');
  const [configSnap, gameSnap, sponsorsSnap] = await Promise.all([getDoc(configRef), getDoc(gameRef), getDoc(sponsorsRef)]);

  if (!configSnap.exists()) await setDoc(configRef, { ...DEFAULT_CONFIG, updatedAt: serverTimestamp() });
  if (!gameSnap.exists()) await setDoc(gameRef, { players: {}, pending: {}, teams: null, updatedAt: serverTimestamp() });
  if (!sponsorsSnap.exists()) await setDoc(sponsorsRef, { items: DEFAULT_SPONSORS, updatedAt: serverTimestamp() });
}

function attachLocalState() {
  migrateLegacyLocalData();
  state.config = { ...DEFAULT_CONFIG, ...loadLocal(storageKeys.config, DEFAULT_CONFIG) };
  state.game = { players: {}, pending: {}, teams: null, ...loadLocal(storageKeys.game, { players: {}, pending: {}, teams: null }) };
  state.sponsors = loadLocal(storageKeys.sponsors, DEFAULT_SPONSORS);
  state.meta = { ...state.meta, ...loadLocal(storageKeys.meta, {}) };
  updateStorageMeta({ storageMode: 'local', syncState: 'Cache restaurado após refresh' });
}

async function initFirebase() {
  const cfg = window.APP_CONFIG?.firebase || {};
  if (!cfg.apiKey || !cfg.projectId) {
    state.firebaseReady = false;
    state.usingLocal = true;
    updateStorageMeta({ storageMode: 'local', syncState: 'Modo local com persistência ativa' });
    return;
  }

  try {
    app = initializeApp(cfg);
    db = getFirestore(app);
    auth = getAuth(app);
    state.firebaseReady = true;
    state.usingLocal = false;
    updateStorageMeta({ storageMode: 'firebase', syncState: 'Conectando ao Firebase…' });

    await seedIfNeeded();
    unsubscribers.forEach((fn) => fn());
    unsubscribers = [
      onSnapshot(doc(db, 'brazuca', 'config'), (snapshot) => {
        state.config = { ...DEFAULT_CONFIG, ...(snapshot.data() || {}) };
        saveLocal(storageKeys.config, state.config);
        updateStorageMeta({ storageMode: 'firebase', syncState: 'Config atualizada do banco', lastRemoteSyncAt: nowLabel() });
        renderAll();
      }),
      onSnapshot(doc(db, 'brazuca', 'game'), (snapshot) => {
        state.game = { players: {}, pending: {}, teams: null, ...(snapshot.data() || {}) };
        saveLocal(storageKeys.game, state.game);
        updateStorageMeta({ storageMode: 'firebase', syncState: 'Lista restaurada do banco', lastRemoteSyncAt: nowLabel() });
        renderAll();
      }),
      onSnapshot(doc(db, 'brazuca', 'sponsors'), (snapshot) => {
        state.sponsors = snapshot.data()?.items?.length ? snapshot.data().items : [...DEFAULT_SPONSORS];
        saveLocal(storageKeys.sponsors, state.sponsors);
        updateStorageMeta({ storageMode: 'firebase', syncState: 'Patrocinadores atualizados', lastRemoteSyncAt: nowLabel() });
        renderAll();
      })
    ];

    onAuthStateChanged(auth, (user) => {
      if (!user && !state.isAdmin) closeModal('admin-modal');
      renderAll();
    });
  } catch (error) {
    console.error(error);
    state.firebaseReady = false;
    state.usingLocal = true;
    updateStorageMeta({ storageMode: 'local', syncState: 'Firebase indisponível; cache local ativo' });
    toast('Firebase indisponível. O app continua salvando no navegador.', 'error');
  }
}

async function loginAdmin() {
  const username = document.getElementById('auth-username').value.trim();
  const password = document.getElementById('auth-password').value;
  const localUser = window.APP_CONFIG?.localAdminUser || 'itamar';
  const localPassword = window.APP_CONFIG?.localAdminPassword || 'futsal2026';

  if (username === localUser && password === localPassword) {
    state.isAdmin = true;
    closeModal('auth-modal');
    openModal('admin-modal');
    renderAll();
    toast('Admin autenticado.');
    return;
  }

  if (state.firebaseReady && auth && username.includes('@')) {
    try {
      await signInWithEmailAndPassword(auth, username, password);
      state.isAdmin = true;
      closeModal('auth-modal');
      openModal('admin-modal');
      renderAll();
      toast('Login realizado.');
    } catch (error) {
      console.error(error);
      toast('Falha no login.', 'error');
    }
    return;
  }

  toast('Usuário ou senha incorretos.', 'error');
}

async function logoutAdmin() {
  if (state.firebaseReady && auth) {
    try { await signOut(auth); } catch {}
  }
  state.isAdmin = false;
  closeModal('admin-modal');
  renderAll();
}

async function saveConfigFromForm() {
  state.config = {
    ...state.config,
    paymentAmount: 4,
    paymentUrl: document.getElementById('cfg-payment-url').value.trim() || DEFAULT_CONFIG.paymentUrl,
    gameDate: document.getElementById('cfg-game-date').value || '',
    arrival: document.getElementById('cfg-arrival').value || DEFAULT_CONFIG.arrival,
    start: document.getElementById('cfg-start').value || DEFAULT_CONFIG.start,
    end: document.getElementById('cfg-end').value || DEFAULT_CONFIG.end,
    maxSlots: Number(document.getElementById('cfg-max-slots').value || DEFAULT_CONFIG.maxSlots)
  };
  await persistConfig();
  renderAll();
  toast('Configurações salvas.');
}

async function addManualPlayer() {
  const name = document.getElementById('admin-player-name').value.trim();
  const slot = Number(document.getElementById('admin-player-slot').value);
  if (!name || !slot) {
    toast('Informe nome e vaga.', 'error');
    return;
  }
  if (state.game.players[slot]) {
    toast('Vaga já ocupada.', 'error');
    return;
  }
  state.game.players[slot] = name;
  document.getElementById('admin-player-name').value = '';
  await persistGame();
  renderAll();
  toast('Jogador adicionado.');
}

async function approvePending(id) {
  const request = state.game.pending[id];
  if (!request) return;
  if (state.game.players[request.slot]) {
    toast('A vaga já foi ocupada.', 'error');
    return;
  }
  state.game.players[request.slot] = request.name;
  delete state.game.pending[id];
  await persistGame();
  renderAll();
  toast('Solicitação aprovada.');
}

async function rejectPending(id) {
  if (!state.game.pending[id]) return;
  delete state.game.pending[id];
  await persistGame();
  renderAll();
  toast('Solicitação rejeitada.');
}

async function clearRound() {
  if (!window.confirm('Limpar toda a rodada, incluindo lista, pendências e times?')) return;
  state.game = { players: {}, pending: {}, teams: null };
  await persistGame();
  renderAll();
  toast('Rodada limpa.');
}

function openPayment() {
  if (!state.config.paymentUrl || state.config.paymentUrl.includes('SEU-LINK')) {
    toast('Configure o link de pagamento no painel admin.', 'error');
    return;
  }
  window.open(state.config.paymentUrl, '_blank', 'noopener');
}

function handleReceiptUpload(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    state.uploadedReceipt = String(reader.result || '');
    const preview = document.getElementById('receipt-preview');
    preview.src = state.uploadedReceipt;
    preview.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

async function submitSignup() {
  const name = document.getElementById('signup-name').value.trim();
  const slot = Number(document.getElementById('signup-slot').value);
  if (!name || !slot) {
    toast('Informe nome e vaga.', 'error');
    return;
  }
  if (!state.uploadedReceipt) {
    toast('Anexe o comprovante.', 'error');
    return;
  }
  if (state.game.players[slot]) {
    toast('Vaga ocupada. Escolha outra.', 'error');
    renderSelectOptions();
    return;
  }

  const id = `req_${Date.now()}`;
  state.game.pending[id] = { name, slot, receipt: state.uploadedReceipt, createdAt: Date.now() };
  await persistGame();
  renderAll();
  closeModal('signup-modal');
  document.getElementById('signup-name').value = '';
  state.uploadedReceipt = '';
  document.getElementById('receipt-preview').classList.add('hidden');
  toast('Solicitação enviada.');
}

function toggleCaptain(name) {
  if (state.selectedCaptains.includes(name)) {
    state.selectedCaptains = state.selectedCaptains.filter((item) => item !== name);
  } else {
    if (state.selectedCaptains.length >= 3) {
      toast('Selecione apenas 3 capitães.', 'error');
      return;
    }
    state.selectedCaptains.push(name);
  }
  renderCaptains();
}

async function generateTeams() {
  if (state.selectedCaptains.length !== 3) {
    toast('Escolha exatamente 3 capitães.', 'error');
    return;
  }

  const remaining = Object.values(state.game.players).filter((name) => !state.selectedCaptains.includes(name));
  for (let i = remaining.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
  }

  const buckets = { A: [], B: [], C: [] };
  remaining.forEach((name, index) => {
    const key = ['A', 'B', 'C'][index % 3];
    buckets[key].push(name);
  });

  state.game.teams = {
    A: { captain: state.selectedCaptains[0], players: buckets.A },
    B: { captain: state.selectedCaptains[1], players: buckets.B },
    C: { captain: state.selectedCaptains[2], players: buckets.C }
  };

  await persistGame();
  state.selectedCaptains = [];
  closeModal('captains-modal');
  renderAll();
  showTab('teams');
  toast('Times gerados.');
}

function shareTeams() {
  if (!state.game.teams) {
    toast('Ainda não há times para compartilhar.', 'error');
    return;
  }

  const lines = ['⚽ *BRAZUCA FC GRONINGEN*', ''];
  [['A', '🟢 Time Verde'], ['B', '🔵 Time Azul'], ['C', '🟠 Time Laranja']].forEach(([key, label]) => {
    const team = state.game.teams[key];
    lines.push(`*${label}*`);
    lines.push(`👑 ${team.captain}`);
    (team.players || []).forEach((name) => lines.push(`⚽ ${name}`));
    lines.push('');
  });
  lines.push(`📅 ${formatGameDate(state.config.gameDate)}`);
  lines.push(`📍 ${state.config.venue}`);
  lines.push(`🕒 ${state.config.start} — ${state.config.end}`);

  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener');
}

async function syncNow() {
  if (!state.firebaseReady) {
    updateStorageMeta({ storageMode: 'local', syncState: 'Sem Firebase; dados salvos no navegador' });
    toast('No momento o app está usando apenas persistência local.', 'error');
    return;
  }
  await Promise.all([persistConfig(), persistGame()]);
  renderAll();
  toast('Sincronização concluída.');
}

function showTab(tab) {
  els.tabs.forEach((button) => button.classList.toggle('active', button.dataset.tab === tab));
  els.tabPanels.forEach((panel) => panel.classList.toggle('active', panel.id === `tab-${tab}`));
}

function wireEvents() {
  els.tabs.forEach((button) => button.addEventListener('click', () => showTab(button.dataset.tab)));
  document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => closeModal(button.dataset.close)));
  document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) backdrop.classList.add('hidden');
    });
  });

  els.payBtn.addEventListener('click', openPayment);
  els.signupBtn.addEventListener('click', () => {
    renderSelectOptions();
    openModal('signup-modal');
  });
  els.adminFab.addEventListener('click', () => {
    if (state.isAdmin) openModal('admin-modal');
    else openModal('auth-modal');
  });

  document.getElementById('auth-login-btn').addEventListener('click', loginAdmin);
  document.getElementById('admin-logout-btn').addEventListener('click', logoutAdmin);
  document.getElementById('save-config-btn').addEventListener('click', saveConfigFromForm);
  document.getElementById('sync-now-btn').addEventListener('click', syncNow);
  document.getElementById('add-player-btn').addEventListener('click', addManualPlayer);
  document.getElementById('clear-list-btn').addEventListener('click', clearRound);
  document.getElementById('submit-signup-btn').addEventListener('click', submitSignup);
  document.getElementById('receipt-input').addEventListener('change', (event) => handleReceiptUpload(event.target.files?.[0]));

  document.getElementById('open-captains-btn').addEventListener('click', () => {
    if (Object.keys(state.game.players || {}).length < 3) {
      toast('Precisa de ao menos 3 jogadores confirmados.', 'error');
      return;
    }
    state.selectedCaptains = [];
    renderCaptains();
    openModal('captains-modal');
  });

  document.getElementById('generate-teams-btn').addEventListener('click', generateTeams);
  document.getElementById('share-teams-btn').addEventListener('click', shareTeams);
}

async function boot() {
  wireEvents();
  attachLocalState();
  renderAll();
  await initFirebase();
  renderAll();
  updateCountdown();
  setInterval(updateCountdown, 30000);
}

boot().catch((error) => {
  console.error(error);
  attachLocalState();
  renderAll();
  toast('Falha ao iniciar o app.', 'error');
});
