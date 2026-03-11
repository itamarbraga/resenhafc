import { DEFAULT_WHATSAPP, prettyCreatedAt } from './helpers.js';

const DEFAULT_CONFIG = {
  gameDate: '2026-03-15',
  arrivalTime: '14:50',
  startTime: '15:00',
  endTime: '17:00',
  paymentLink: 'https://revolut.me/itamar',
  paymentAmount: '4',
  venue: 'ACLO Groningen',
  address: 'Blauwborgje 16, 9747 AC Groningen',
  mapsUrl: 'https://maps.google.com/?q=Blauwborgje+16,+9747+AC+Groningen',
  maxSlots: '18',
  whatsappLink: DEFAULT_WHATSAPP,
};

const DEFAULT_SPONSORS = [
  {
    name: 'Global Food Import',
    subtitle: 'Importadora e distribuidora',
    url: 'https://globalfoodimport.com',
    phone: '+31 6 40357378',
    logoUrl: '/assets/sponsors/global-food-import.png',
    description: 'Produtos selecionados e catálogo disponível no WhatsApp Business.',
    ctaLabel: 'Ver catálogo',
    sortOrder: 1,
  },
  {
    name: 'Tribe The Native Food',
    subtitle: 'Açaí e sabores naturais',
    url: 'https://www.tribeacai.com',
    phone: '+351 243 247 593',
    logoUrl: '/assets/sponsors/tribe.jpg',
    description: 'Sabores autênticos, identidade forte e presença marcante na comunidade.',
    ctaLabel: 'Conhecer a Tribe',
    sortOrder: 2,
  },
  {
    name: 'Ramos Klus en Schoonmaakbedrijf',
    subtitle: 'Klus en schoonmaakbedrijf',
    url: 'https://resenhafc.pages.dev',
    phone: '',
    logoUrl: '/assets/sponsors/ramos.jpg',
    description: 'Serviços de manutenção e limpeza com identidade profissional forte.',
    ctaLabel: 'Ver parceiro',
    sortOrder: 3,
  },
];

async function ensureColumn(env, tableName, columnName, columnSql) {
  const info = await env.DB.prepare(`PRAGMA table_info(${tableName})`).all();
  const columns = (info.results || []).map((row) => row.name);
  if (!columns.includes(columnName)) {
    await env.DB.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnSql}`).run();
  }
}

// Cache initialization — runs at most once per Worker isolate lifetime.
// Cloudflare isolates are reused across requests, so this avoids 30+ sequential
// D1 queries on every API hit (the #1 cause of cold-start timeouts on mobile).
let _dbInitialized = false;
let _dbInitPromise = null;

export async function initializeDb(env) {
  if (_dbInitialized) return;
  if (_dbInitPromise) { await _dbInitPromise; return; }
  _dbInitPromise = _runInit(env);
  await _dbInitPromise;
  _dbInitialized = true;
}

async function _runInit(env) {
  const statements = [
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS sponsors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      subtitle TEXT NOT NULL,
      url TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      phone TEXT,
      logo_url TEXT,
      description TEXT,
      cta_label TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_key TEXT NOT NULL,
      player_name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      username TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL DEFAULT '',
      password_salt TEXT NOT NULL DEFAULT '',
      phone TEXT,
      state TEXT NOT NULL,
      photo_data TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS game_days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS team_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_day_id INTEGER NOT NULL,
      team_key TEXT NOT NULL,
      wins INTEGER NOT NULL DEFAULT 0,
      losses INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS player_minutes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_day_id INTEGER NOT NULL,
      player_name TEXT NOT NULL,
      minutes REAL NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS player_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_day_id INTEGER NOT NULL,
      player_name TEXT NOT NULL,
      goals INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS gallery (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'photo',
      photo_data TEXT,
      video_url TEXT,
      caption TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  ];

  for (const sql of statements) {
    await env.DB.prepare(sql).run();
  }

  await ensureColumn(env, 'sponsors', 'phone', 'phone TEXT');
  await ensureColumn(env, 'sponsors', 'logo_url', 'logo_url TEXT');
  await ensureColumn(env, 'sponsors', 'description', 'description TEXT');
  await ensureColumn(env, 'sponsors', 'cta_label', 'cta_label TEXT');
  await ensureColumn(env, 'members', 'photo_data', 'photo_data TEXT');
  await ensureColumn(env, 'members', 'player_id', 'player_id INTEGER');
  await ensureColumn(env, 'members', 'payment_proof', 'payment_proof TEXT');
  await ensureColumn(env, 'players', 'username', "username TEXT NOT NULL DEFAULT ''");
  await ensureColumn(env, 'players', 'password_hash', "password_hash TEXT NOT NULL DEFAULT ''");
  await ensureColumn(env, 'players', 'password_salt', "password_salt TEXT NOT NULL DEFAULT ''");

  for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
    await env.DB.prepare(
      'INSERT OR IGNORE INTO settings (key, value) VALUES (?1, ?2)'
    )
      .bind(key, String(value))
      .run();
  }

  const sponsorCountRow = await env.DB
    .prepare('SELECT COUNT(*) AS count FROM sponsors')
    .first();

  const sponsorCount = Number(sponsorCountRow?.count || 0);

  if (!sponsorCount) {
    for (const sponsor of DEFAULT_SPONSORS) {
      await env.DB.prepare(
        `INSERT INTO sponsors (
          name,
          subtitle,
          url,
          sort_order,
          phone,
          logo_url,
          description,
          cta_label
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
      )
        .bind(
          sponsor.name,
          sponsor.subtitle,
          sponsor.url,
          sponsor.sortOrder,
          sponsor.phone || '',
          sponsor.logoUrl || '',
          sponsor.description || '',
          sponsor.ctaLabel || 'Ver mais'
        )
        .run();
    }
  }
} // end _runInit

export async function getConfig(env) {
  const rows = await env.DB.prepare('SELECT key, value FROM settings').all();
  const config = { ...DEFAULT_CONFIG };

  for (const row of rows.results || []) {
    config[row.key] = row.value;
  }

  config.maxSlots = Number(config.maxSlots || 18);
  config.paymentAmount = Number(config.paymentAmount || 4);

  return config;
}

export async function saveConfig(env, partialConfig) {
  for (const [key, value] of Object.entries(partialConfig)) {
    await env.DB.prepare(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)'
    )
      .bind(key, String(value))
      .run();
  }
}

export async function listMembers(env, status = null) {
  let query = `
    SELECT m.id, m.name, m.status, m.created_at, m.player_id, m.payment_proof,
           COALESCE(p.photo_data, m.photo_data) AS photo_data,
           p.first_name, p.last_name, p.state, p.phone
    FROM members m
    LEFT JOIN players p ON m.player_id = p.id
  `;
  const binds = [];

  if (status) {
    query += ' WHERE m.status = ?1';
    binds.push(status);
  }

  query += ' ORDER BY m.created_at ASC, m.id ASC';

  const statement = env.DB.prepare(query);
  const result = binds.length
    ? await statement.bind(...binds).all()
    : await statement.all();

  return (result.results || []).map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status,
    createdAt: row.created_at,
    createdAtLabel: prettyCreatedAt(row.created_at),
    photoData: row.photo_data || null,
    playerId: row.player_id || null,
    paymentProof: row.payment_proof || null,
    firstName: row.first_name || null,
    lastName: row.last_name || null,
    state: row.state || null,
    phone: row.phone || null,
  }));
}

export async function memberExists(env, normalizedName) {
  const row = await env.DB
    .prepare('SELECT id FROM members WHERE lower(name) = ?1 LIMIT 1')
    .bind(normalizedName.toLowerCase())
    .first();

  return Boolean(row?.id);
}

export async function addMember(env, name, status = 'pending', photoData = null, playerId = null, paymentProof = null) {
  await env.DB.prepare('INSERT INTO members (name, status, photo_data, player_id, payment_proof) VALUES (?1, ?2, ?3, ?4, ?5)')
    .bind(name, status, photoData, playerId, paymentProof)
    .run();
}

export async function updateMemberStatus(env, id, status) {
  await env.DB.prepare('UPDATE members SET status = ?1 WHERE id = ?2')
    .bind(status, id)
    .run();
}

export async function deleteMember(env, id) {
  await env.DB.prepare('DELETE FROM members WHERE id = ?1')
    .bind(id)
    .run();
}

export async function listSponsors(env) {
  const rows = await env.DB.prepare(
    `SELECT
      id,
      name,
      subtitle,
      url,
      sort_order,
      phone,
      logo_url,
      description,
      cta_label
    FROM sponsors
    ORDER BY sort_order ASC, id ASC`
  ).all();

  return (rows.results || []).map((row) => ({
    id: row.id,
    name: row.name,
    subtitle: row.subtitle,
    url: row.url,
    sortOrder: row.sort_order,
    phone: row.phone || '',
    logoUrl: row.logo_url || '',
    description: row.description || '',
    ctaLabel: row.cta_label || 'Ver mais',
  }));
}

export async function replaceTeams(env, teams, benchTeam = null) {
  await env.DB.exec('DELETE FROM teams');
  await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('benchTeam', ?1)")
    .bind(benchTeam || '').run();

  for (const [teamKey, players] of Object.entries(teams)) {
    for (let i = 0; i < players.length; i += 1) {
      await env.DB.prepare(
        'INSERT INTO teams (team_key, player_name, sort_order) VALUES (?1, ?2, ?3)'
      )
        .bind(teamKey, players[i], i + 1)
        .run();
    }
  }
}

export async function listTeams(env) {
  const rows = await env.DB.prepare(
    'SELECT team_key, player_name, sort_order FROM teams ORDER BY team_key ASC, sort_order ASC, id ASC'
  ).all();

  const benchRow = await env.DB
    .prepare("SELECT value FROM settings WHERE key = 'benchTeam'")
    .first();
  const benchTeam = benchRow?.value || null;

  const teams = { Vermelho: [], Amarelo: [], Azul: [] };

  for (const row of rows.results || []) {
    if (!teams[row.team_key]) teams[row.team_key] = [];
    teams[row.team_key].push(row.player_name);
  }

  return { teams, benchTeam };
}

export async function getSession(env, token) {
  if (!token) return null;

  const row = await env.DB
    .prepare('SELECT token, username, expires_at FROM sessions WHERE token = ?1 LIMIT 1')
    .bind(token)
    .first();

  if (!row) return null;

  if (new Date(row.expires_at).getTime() < Date.now()) {
    await env.DB.prepare('DELETE FROM sessions WHERE token = ?1')
      .bind(token)
      .run();
    return null;
  }

  return row;
}

export async function createSession(env, token, username, expiresAt) {
  await env.DB.prepare('INSERT INTO sessions (token, username, expires_at) VALUES (?1, ?2, ?3)')
    .bind(token, username, expiresAt)
    .run();
}

export async function deleteSession(env, token) {
  if (!token) return;
  await env.DB.prepare('DELETE FROM sessions WHERE token = ?1').bind(token).run();
}

export async function createPlayerSession(env, token, playerId, expiresAt) {
  await env.DB.prepare('INSERT INTO sessions (token, username, expires_at) VALUES (?1, ?2, ?3)')
    .bind(token, `player:${playerId}`, expiresAt).run();
}

export async function getPlayerSession(env, token) {
  if (!token) return null;
  const row = await env.DB
    .prepare('SELECT token, username, expires_at FROM sessions WHERE token = ?1 LIMIT 1')
    .bind(token).first();
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await env.DB.prepare('DELETE FROM sessions WHERE token = ?1').bind(token).run();
    return null;
  }
  // username stored as "player:ID"
  if (!String(row.username).startsWith('player:')) return null;
  const playerId = Number(String(row.username).replace('player:', ''));
  return { token: row.token, playerId };
}

export async function updatePlayer(env, id, { firstName, lastName, phone, state, photoData, passwordHash, passwordSalt }) {
  const fields = [];
  const binds  = [];
  let i = 1;
  if (firstName    !== undefined) { fields.push(`first_name = ?${i++}`);    binds.push(firstName); }
  if (lastName     !== undefined) { fields.push(`last_name = ?${i++}`);     binds.push(lastName); }
  if (phone        !== undefined) { fields.push(`phone = ?${i++}`);         binds.push(phone); }
  if (state        !== undefined) { fields.push(`state = ?${i++}`);         binds.push(state); }
  if (photoData    !== undefined) { fields.push(`photo_data = ?${i++}`);    binds.push(photoData); }
  if (passwordHash !== undefined) { fields.push(`password_hash = ?${i++}`); binds.push(passwordHash); }
  if (passwordSalt !== undefined) { fields.push(`password_salt = ?${i++}`); binds.push(passwordSalt); }
  if (!fields.length) return;
  binds.push(id);
  await env.DB.prepare(`UPDATE players SET ${fields.join(', ')} WHERE id = ?${i}`).bind(...binds).run();
}

// ─── Player profiles ─────────────────────────────────────────────────────────

export async function registerPlayer(env, { firstName, lastName, username, passwordHash, passwordSalt, phone, state, photoData }) {
  const result = await env.DB.prepare(
    'INSERT INTO players (first_name, last_name, username, password_hash, password_salt, phone, state, photo_data, status) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)'
  ).bind(firstName, lastName, username, passwordHash, passwordSalt, phone || '', state, photoData, 'pending').run();
  return result.meta.last_row_id;
}

export async function usernameExists(env, username) {
  const row = await env.DB
    .prepare('SELECT id FROM players WHERE lower(username) = ?1 LIMIT 1')
    .bind(username.toLowerCase()).first();
  return Boolean(row?.id);
}

export async function getPlayerByUsername(env, username) {
  const row = await env.DB
    .prepare('SELECT id, first_name, last_name, phone, state, photo_data, status, password_hash, password_salt FROM players WHERE lower(username) = ?1 LIMIT 1')
    .bind(username.toLowerCase()).first();
  if (!row) return null;
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: `${row.first_name} ${row.last_name}`,
    phone: row.phone || '',
    state: row.state,
    photoData: row.photo_data || null,
    status: row.status,
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
  };
}

export async function listPlayers(env, status = null) {
  let query = 'SELECT id, first_name, last_name, username, phone, state, photo_data, status, created_at FROM players';
  const binds = [];
  if (status) { query += ' WHERE status = ?1'; binds.push(status); }
  query += ' ORDER BY first_name ASC, last_name ASC';
  const stmt = env.DB.prepare(query);
  const result = binds.length ? await stmt.bind(...binds).all() : await stmt.all();
  return (result.results || []).map((r) => ({
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    fullName: `${r.first_name} ${r.last_name}`,
    username: r.username || '',
    phone: r.phone || '',
    state: r.state,
    photoData: r.photo_data || null,
    status: r.status,
    createdAt: r.created_at,
    createdAtLabel: prettyCreatedAt(r.created_at),
  }));
}

export async function updatePlayerStatus(env, id, status) {
  await env.DB.prepare('UPDATE players SET status = ?1 WHERE id = ?2').bind(status, id).run();
}

export async function deletePlayer(env, id) {
  await env.DB.prepare('DELETE FROM players WHERE id = ?1').bind(id).run();
}

export async function getPlayer(env, id) {
  const row = await env.DB
    .prepare('SELECT id, first_name, last_name, phone, state, photo_data, status, password_hash, password_salt FROM players WHERE id = ?1')
    .bind(id).first();
  if (!row) return null;
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: `${row.first_name} ${row.last_name}`,
    phone: row.phone || '',
    state: row.state,
    photoData: row.photo_data || null,
    status: row.status,
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
  };
}

export async function playerExists(env, firstName, lastName) {
  const row = await env.DB
    .prepare('SELECT id FROM players WHERE lower(first_name) = ?1 AND lower(last_name) = ?2 LIMIT 1')
    .bind(firstName.toLowerCase(), lastName.toLowerCase()).first();
  return Boolean(row?.id);
}

export async function buildPublicState(env) {
  const [config, members, sponsors, teamsData, stats, approvedPlayers] = await Promise.all([
    getConfig(env),
    listMembers(env, 'confirmed'),
    listSponsors(env),
    listTeams(env),
    buildStats(env),
    listPlayers(env, 'approved'),
  ]);

  return {
    config,
    members,
    sponsors,
    teams: teamsData.teams,
    benchTeam: teamsData.benchTeam,
    stats,
    approvedPlayers,
    storage: 'Cloudflare Pages + D1 ativo',
  };
}

// ─── Game stats ─────────────────────────────────────────────────────────────

export async function saveGameDay(env, gameDate, teamResults, playerGoals, currentTeams) {
  // Insert game_day
  const dayResult = await env.DB
    .prepare('INSERT INTO game_days (game_date) VALUES (?1)')
    .bind(gameDate)
    .run();
  const gameDayId = dayResult.meta.last_row_id;

  // Save team results + calculate player minutes
  for (const [teamKey, { wins, losses }] of Object.entries(teamResults)) {
    await env.DB
      .prepare('INSERT INTO team_results (game_day_id, team_key, wins, losses) VALUES (?1,?2,?3,?4)')
      .bind(gameDayId, teamKey, wins, losses)
      .run();

    const minutes = wins * 7 + losses * 3.5;
    const players = currentTeams[teamKey] || [];
    for (const playerName of players) {
      await env.DB
        .prepare('INSERT INTO player_minutes (game_day_id, player_name, minutes) VALUES (?1,?2,?3)')
        .bind(gameDayId, playerName, minutes)
        .run();
    }
  }

  // Save player goals
  for (const { name, goals } of playerGoals) {
    if (goals > 0) {
      await env.DB
        .prepare('INSERT INTO player_goals (game_day_id, player_name, goals) VALUES (?1,?2,?3)')
        .bind(gameDayId, name, goals)
        .run();
    }
  }

  return gameDayId;
}

export async function listGameDays(env) {
  const rows = await env.DB
    .prepare('SELECT id, game_date, notes, created_at FROM game_days ORDER BY game_date DESC')
    .all();
  return rows.results || [];
}

export async function deleteGameDay(env, id) {
  await env.DB.prepare('DELETE FROM player_goals WHERE game_day_id = ?1').bind(id).run();
  await env.DB.prepare('DELETE FROM player_minutes WHERE game_day_id = ?1').bind(id).run();
  await env.DB.prepare('DELETE FROM team_results WHERE game_day_id = ?1').bind(id).run();
  await env.DB.prepare('DELETE FROM game_days WHERE id = ?1').bind(id).run();
}

export async function buildStats(env) {
  // Count game days
  const dayCountRow = await env.DB
    .prepare('SELECT COUNT(*) AS count FROM game_days')
    .first();
  const totalDays = Number(dayCountRow?.count || 0);
  const totalPossibleMinutes = totalDays * 120;

  // GOAT ranking: sum minutes per player
  const minuteRows = await env.DB
    .prepare(`SELECT player_name, SUM(minutes) AS total_minutes
              FROM player_minutes GROUP BY lower(player_name)
              ORDER BY total_minutes DESC`)
    .all();

  // Golden Boot: sum goals per player
  const goalRows = await env.DB
    .prepare(`SELECT player_name, SUM(goals) AS total_goals
              FROM player_goals GROUP BY lower(player_name)
              ORDER BY total_goals DESC`)
    .all();

  // Get member photos — prefer players profile, fallback to member photo
  const memberRows = await env.DB
    .prepare(`SELECT m.name, COALESCE(p.photo_data, m.photo_data) AS photo_data
              FROM members m LEFT JOIN players p ON m.player_id = p.id
              WHERE m.status = ?1`)
    .bind('confirmed')
    .all();
  const photoMap = {};
  for (const m of (memberRows.results || [])) {
    photoMap[m.name.toLowerCase()] = m.photo_data || null;
  }

  const goatRanking = (minuteRows.results || []).map((row) => ({
    name: row.player_name,
    totalMinutes: Number(row.total_minutes),
    totalPossible: totalPossibleMinutes,
    ratio: totalPossibleMinutes > 0
      ? Math.round((Number(row.total_minutes) / totalPossibleMinutes) * 1000) / 10
      : 0,
    photo: photoMap[row.player_name.toLowerCase()] || null,
  }));

  const goldenBoot = (goalRows.results || []).map((row) => ({
    name: row.player_name,
    totalGoals: Number(row.total_goals),
    photo: photoMap[row.player_name.toLowerCase()] || null,
  }));

  return { goatRanking, goldenBoot, totalDays };
}

// ─── Gallery ─────────────────────────────────────────────────────────────────

export async function listGallery(env) {
  const result = await env.DB
    .prepare(`
      SELECT g.id, g.player_id, g.type, g.photo_data, g.video_url, g.caption, g.created_at,
             p.first_name, p.last_name, p.photo_data AS author_photo
      FROM gallery g
      JOIN players p ON p.id = g.player_id
      ORDER BY g.created_at DESC
      LIMIT 200
    `)
    .all();
  return (result.results || []).map(r => ({
    id: r.id,
    playerId: r.player_id,
    type: r.type,
    photoData: r.photo_data || null,
    videoUrl: r.video_url || null,
    caption: r.caption || '',
    createdAt: r.created_at,
    authorName: `${r.first_name} ${r.last_name}`,
    authorPhoto: r.author_photo || null,
  }));
}

export async function addGalleryItem(env, { playerId, type, photoData, videoUrl, caption }) {
  await env.DB
    .prepare('INSERT INTO gallery (player_id, type, photo_data, video_url, caption) VALUES (?1,?2,?3,?4,?5)')
    .bind(playerId, type, photoData || null, videoUrl || null, (caption || '').slice(0, 300))
    .run();
}

export async function deleteGalleryItem(env, id, playerId) {
  // playerId null = admin delete (no ownership check)
  if (playerId) {
    await env.DB.prepare('DELETE FROM gallery WHERE id = ?1 AND player_id = ?2').bind(id, playerId).run();
  } else {
    await env.DB.prepare('DELETE FROM gallery WHERE id = ?1').bind(id).run();
  }
}
