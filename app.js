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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000); // 12s timeout

  let response;
  try {
    response = await fetch(url, {
      credentials: 'include',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error('Tempo esgotado. Verifique sua conexão e tente novamente.');
    throw new Error('Sem conexão. Verifique sua internet e recarregue a página.');
  }

  clearTimeout(timer);

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

function showLoadError(msg) {
  // Show a visible retry banner on the hero area
  const banner = document.createElement('div');
  banner.id = 'load-error-banner';
  banner.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1a2e22;border:1px solid rgba(231,76,60,0.5);color:#ff9f9f;padding:14px 20px;border-radius:14px;font-size:0.9rem;font-weight:600;z-index:999;display:flex;gap:12px;align-items:center;max-width:calc(100vw - 32px);box-shadow:0 8px 32px rgba(0,0,0,0.5);';
  banner.innerHTML = `<span>⚠️ ${msg}</span><button onclick="location.reload()" style="background:rgba(46,204,113,0.2);border:1px solid rgba(46,204,113,0.4);color:#2ecc71;padding:6px 14px;border-radius:999px;font-weight:700;cursor:pointer;white-space:nowrap;font-size:0.85rem;">Tentar novamente</button>`;
  document.body.appendChild(banner);
}

async function loadPublicState(retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const data = await request('/api/public-state');
      // Remove any previous error banner on success
      document.getElementById('load-error-banner')?.remove();
      state.publicData = data;
      renderPublic();
      return;
    } catch (err) {
      if (attempt === retries) {
        showLoadError(err.message);
        throw err;
      }
      // Wait before retrying (1s, 2s)
      await new Promise((res) => setTimeout(res, attempt * 1000));
    }
  }
}
  renderPublic();
}

function renderPublic() {
  const data = state.publicData;
  if (!data) return;

  const { config, members, sponsors, teams, benchTeam, storage, stats, approvedPlayers } = data;
  $('hero-date').textContent = formatPrettyDate(config.gameDate);
  $('hero-arrival').textContent = `Chegada ${config.arrivalTime}`;
  $('hero-window').textContent = `Início: ${config.startTime} — ${config.endTime}`;
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
  renderMaps(members, approvedPlayers);
  renderSponsors(sponsors);
  renderTeams(teams, benchTeam);
  renderRankings(stats);
  populatePlayerDropdown(approvedPlayers || []);
  startCountdown(config.gameDate, config.startTime);
}

// ─── Brazil Map ─────────────────────────────────────────────────────────────

const BRAZIL_PATHS = {"RR":"M107.4,4.3 L158.3,4.3 L160.5,56.7 L124.3,63.8 L107.4,42.5 Z","AP":"M254.3,14.2 L277.0,17.0 L273.6,70.9 L251.0,73.7 L243.0,49.6 Z","AM":"M11.3,79.4 L73.5,85.1 L101.7,106.3 L104.0,212.7 L73.5,233.9 L11.3,219.7 L11.3,148.9 Z","PA":"M175.2,42.5 L277.0,52.5 L305.2,99.2 L305.2,198.5 L260.0,198.5 L220.4,163.0 L175.2,134.7 Z","RO":"M90.4,184.3 L158.3,184.3 L160.5,269.4 L118.7,269.4 L96.1,233.9 Z","AC":"M5.7,184.3 L84.8,177.2 L67.8,241.0 L5.7,226.8 Z","MT":"M152.6,184.3 L265.7,184.3 L260.0,333.2 L158.3,311.9 L147.0,248.1 Z","TO":"M265.7,155.9 L316.5,155.9 L316.5,262.3 L260.0,269.4 Z","MA":"M288.3,99.2 L367.4,106.3 L373.0,198.5 L333.5,205.6 L310.9,170.1 L293.9,134.7 Z","PI":"M327.8,113.4 L367.4,113.4 L378.7,233.9 L339.1,241.0 L322.2,170.1 Z","CE":"M367.4,117.7 L412.6,117.7 L443.1,155.9 L412.6,184.3 L378.7,184.3 L367.4,134.7 Z","RN":"M412.6,141.8 L440.9,146.0 L443.1,170.1 L418.3,174.4 Z","PB":"M401.3,163.0 L443.1,163.0 L443.1,191.4 L401.3,191.4 Z","PE":"M367.4,184.3 L440.9,184.3 L443.1,212.7 L401.3,212.7 L367.4,205.6 Z","AL":"M401.3,198.5 L440.9,198.5 L440.9,226.8 L401.3,219.7 Z","SE":"M412.6,219.7 L429.6,219.7 L429.6,241.0 L412.6,233.9 Z","BA":"M316.5,198.5 L412.6,198.5 L412.6,326.1 L390.0,326.1 L378.7,276.5 L322.2,276.5 L310.9,248.1 Z","GO":"M237.4,248.1 L316.5,248.1 L305.2,347.3 L248.7,333.2 L237.4,304.8 Z","DF":"M290.5,297.7 L301.8,297.7 L301.8,306.2 L290.5,306.2 Z","MS":"M180.9,319.0 L260.0,326.1 L254.3,418.2 L220.4,418.2 L180.9,368.6 Z","MG":"M260.0,276.5 L384.3,283.5 L378.7,397.0 L327.8,404.1 L254.3,397.0 L248.7,340.3 Z","ES":"M373.0,326.1 L395.7,326.1 L390.0,382.8 L367.4,375.7 Z","RJ":"M327.8,375.7 L378.7,375.7 L361.7,411.1 L327.8,404.1 Z","SP":"M237.4,354.4 L339.1,361.5 L333.5,418.2 L282.6,439.5 L231.7,418.2 Z","PR":"M220.4,397.0 L293.9,411.1 L288.3,467.8 L220.4,460.8 Z","SC":"M220.4,439.5 L288.3,439.5 L288.3,496.2 L220.4,482.0 Z","RS":"M186.5,460.8 L277.0,460.8 L277.0,557.2 L231.7,557.2 L186.5,517.5 Z"};
const BRAZIL_CENTROIDS = {"RR":[131.6,34.3],"AP":[259.8,45.1],"AM":[55.2,155.1],"PA":[245.5,127.0],"RO":[124.8,228.3],"AC":[41.0,207.3],"MT":[196.7,252.4],"TO":[289.7,210.9],"MA":[327.8,152.4],"PI":[347.0,174.4],"CE":[397.0,149.1],"RN":[431.7,158.1],"PB":[422.2,177.2],"PE":[404.0,199.9],"AL":[424.1,210.9],"SE":[424.1,228.6],"BA":[363.4,264.3],"GO":[269.0,296.3],"DF":[301.1,301.9],"MS":[219.3,370.0],"MG":[309.0,349.7],"ES":[385.5,352.7],"RJ":[349.0,393.6],"SP":[284.9,398.4],"PR":[255.8,434.2],"SC":[254.4,464.3],"RS":[231.7,510.7]};

// One unique hue per state (evenly spread around the wheel, skipping green ≈ 120° which is our brand)
const STATE_ORDER = ['AM','PA','MT','GO','MS','BA','MG','SP','RS','PR','SC','RJ','ES','TO','MA','PI','CE','PE','PB','RN','AL','SE','RO','AC','RR','AP','DF'];
const STATE_HUES = (() => {
  const hues = {};
  STATE_ORDER.forEach((s, i) => {
    // spread 27 states across 360°, offset 200° to avoid brand green
    hues[s] = Math.round((200 + i * (360 / STATE_ORDER.length)) % 360);
  });
  return hues;
})();

function stateColor(code, count) {
  if (code === 'INTL') return null; // drawn separately
  const h = STATE_HUES[code] ?? 200;
  if (!count) return `hsla(${h},18%,38%,0.35)`;
  const lightness = Math.min(72, 52 + count * 4);
  const sat       = Math.min(90, 60 + count * 6);
  return `hsla(${h},${sat}%,${lightness}%,0.92)`;
}

function buildStateCounts(list) {
  const counts = {};
  (list || []).forEach((item) => {
    const s = item.state || item.s;
    if (s) counts[s] = (counts[s] || 0) + 1;
  });
  return counts;
}

function renderBrazilMap(list, svgId, legendId) {
  const svg    = $(svgId);
  const legend = $(legendId);
  if (!svg || !legend) return;

  const counts = buildStateCounts(list);
  const ns     = 'http://www.w3.org/2000/svg';

  // Clear
  svg.innerHTML   = '';
  legend.innerHTML = '';

  // Background rectangle
  const bg = document.createElementNS(ns, 'rect');
  bg.setAttribute('width', '520'); bg.setAttribute('height', '560');
  bg.setAttribute('fill', 'transparent');
  svg.appendChild(bg);

  // Draw each state
  Object.entries(BRAZIL_PATHS).forEach(([code, d]) => {
    const count = counts[code] || 0;
    const fill  = stateColor(code, count);

    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', fill);
    path.setAttribute('stroke', 'rgba(255,255,255,0.12)');
    path.setAttribute('stroke-width', '1.2');
    path.setAttribute('class', 'map-state');
    if (count) path.setAttribute('data-count', count);
    svg.appendChild(path);

    // State abbreviation label inside polygon
    const [cx, cy] = BRAZIL_CENTROIDS[code];
    const text = document.createElementNS(ns, 'text');
    text.setAttribute('x', cx);
    text.setAttribute('y', cy + 4);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', code === 'DF' ? '5' : '9');
    text.setAttribute('font-weight', '700');
    text.setAttribute('fill', count ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.28)');
    text.setAttribute('pointer-events', 'none');
    text.textContent = code;
    svg.appendChild(text);
  });

  // Legend: only states with people, sorted by count desc
  const active = Object.entries(counts)
    .filter(([k]) => k !== 'INTL')
    .sort((a, b) => b[1] - a[1]);

  const intlCount = counts['INTL'] || 0;

  if (!active.length && !intlCount) {
    legend.innerHTML = '<span class="map-legend-empty">Nenhum estado representado ainda.<br>Os estados vão acender conforme as pessoas se cadastrarem.</span>';
    return;
  }

  active.forEach(([code, n]) => {
    const h    = STATE_HUES[code] ?? 200;
    const chip = document.createElement('div');
    chip.className = 'map-legend-item';
    chip.innerHTML = `
      <span class="map-legend-dot" style="background:hsla(${h},75%,60%,1)"></span>
      <span class="map-legend-code">${code}</span>
      <span class="map-legend-count">${n}</span>`;
    legend.appendChild(chip);
  });

  if (intlCount) {
    const chip = document.createElement('div');
    chip.className = 'map-legend-item';
    chip.innerHTML = `
      <span class="map-legend-dot" style="background:#a78bfa"></span>
      <span class="map-legend-code">🌍 Intl</span>
      <span class="map-legend-count">${intlCount}</span>`;
    legend.appendChild(chip);
  }
}

function renderMaps(members, approvedPlayers) {
  // Game map — always show; lights up as members with state are confirmed
  const gameBlock = $('game-map-block');
  if (gameBlock) gameBlock.style.display = '';
  renderBrazilMap(members || [], 'game-map-svg', 'game-map-legend');

  // Members map — always show
  const membersSection = $('members-map-section');
  if (membersSection) membersSection.style.display = '';
  renderBrazilMap(approvedPlayers || [], 'members-map-svg', 'members-map-legend');
}


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

      // Show processing state
      const instructions = area.querySelector('.photo-upload-instructions span');
      if (instructions) instructions.textContent = 'Processando…';

      const reader = new FileReader();
      reader.onload = (ev) => processPhoto(ev.target.result, canvas, () => {
        area.classList.add('has-photo');
        $('photo-preview-wrap').style.display = 'flex';
        $('photo-upload-area')?.querySelector('.photo-upload-instructions')?.style.setProperty('display', 'none');
        if (regBtn) regBtn.disabled = false;
        // Reset input so same file can be re-selected if needed
        input.value = '';
      });
      reader.onerror = () => {
        if (instructions) instructions.textContent = 'Toque para escolher uma foto';
        input.value = '';
      };
      reader.readAsDataURL(file);
    });
  }

  // Payment proof (no crop, just compress)
  const proofArea  = $('proof-upload-area');
  const proofInput = $('proof-input');
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
          proofInput.value = '';
          updateJoinSubmitState();
        });
      };
      reader.onerror = () => { proofInput.value = ''; };
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
    // Fully reset photo state
    photoState.dataUrl = null;
    const area = $('photo-upload-area');
    if (area) {
      area.classList.remove('has-photo');
      const instr = area.querySelector('.photo-upload-instructions');
      if (instr) instr.style.display = '';
      const instrSpan = area.querySelector('.photo-upload-instructions span');
      if (instrSpan) instrSpan.textContent = 'Toque para escolher uma foto';
    }
    const previewWrap = $('photo-preview-wrap');
    if (previewWrap) previewWrap.style.display = 'none';
    const canvas = $('photo-canvas');
    if (canvas) canvas.getContext('2d').clearRect(0, 0, 120, 120);
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
    const proofInstr = $('proof-instructions');
    if (proofInstr) proofInstr.style.display = '';
    const proofPreview = $('proof-preview-wrap');
    if (proofPreview) proofPreview.style.display = 'none';
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

  await loadPublicState().catch(() => {
    $('hero-date').textContent    = '—';
    $('hero-arrival').textContent = 'Erro ao carregar';
    $('hero-window').textContent  = 'Recarregue a página';
  });
  try {
    await loadAdminState();
    state.isAdmin = true;
    $('admin-login-view').classList.add('hidden');
    $('admin-app-view').classList.remove('hidden');
  } catch {
    state.isAdmin = false;
  }
}

bootstrap().catch(() => {
  // Errors already surfaced via showLoadError banner
});
