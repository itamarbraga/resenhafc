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

export async function initializeDb(env) {
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
  ];

  for (const sql of statements) {
    await env.DB.prepare(sql).run();
  }

  await ensureColumn(env, 'sponsors', 'phone', 'phone TEXT');
  await ensureColumn(env, 'sponsors', 'logo_url', 'logo_url TEXT');
  await ensureColumn(env, 'sponsors', 'description', 'description TEXT');
  await ensureColumn(env, 'sponsors', 'cta_label', 'cta_label TEXT');
  await ensureColumn(env, 'members', 'photo_data', 'photo_data TEXT');

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
}

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
  let query = 'SELECT id, name, status, created_at, photo_data FROM members';
  const binds = [];

  if (status) {
    query += ' WHERE status = ?1';
    binds.push(status);
  }

  query += ' ORDER BY created_at ASC, id ASC';

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
  }));
}

export async function memberExists(env, normalizedName) {
  const row = await env.DB
    .prepare('SELECT id FROM members WHERE lower(name) = ?1 LIMIT 1')
    .bind(normalizedName.toLowerCase())
    .first();

  return Boolean(row?.id);
}

export async function addMember(env, name, status = 'pending', photoData = null) {
  await env.DB.prepare('INSERT INTO members (name, status, photo_data) VALUES (?1, ?2, ?3)')
    .bind(name, status, photoData)
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

export async function replaceTeams(env, teams) {
  await env.DB.exec('DELETE FROM teams');

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

  const teams = { A: [], B: [], C: [] };

  for (const row of rows.results || []) {
    teams[row.team_key] = teams[row.team_key] || [];
    teams[row.team_key].push(row.player_name);
  }

  return teams;
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

  await env.DB.prepare('DELETE FROM sessions WHERE token = ?1')
    .bind(token)
    .run();
}

export async function buildPublicState(env) {
  const [config, members, sponsors, teams] = await Promise.all([
    getConfig(env),
    listMembers(env, 'confirmed'),
    listSponsors(env),
    listTeams(env),
  ]);

  return {
    config,
    members,
    sponsors,
    teams,
    storage: 'Cloudflare Pages + D1 ativo',
  };
}
