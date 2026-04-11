import { buildPublicState, initializeDb, listMembers, listTeams, replaceTeams } from '../lib/db.js';
import { requireAdmin } from '../lib/auth.js';
import { error, json, shuffle } from '../lib/helpers.js';

const TEAM_KEYS_3 = ['Vermelho', 'Amarelo', 'Azul'];
const TEAM_KEYS_2 = ['Vermelho', 'Amarelo'];
const MIN_TOTAL   = 6;

// Snake patterns
const SNAKE_3 = [0, 1, 2, 2, 1, 0];
const SNAKE_2 = [0, 1, 1, 0];

function snakeIndex(pos, keys) {
  const pat = keys.length === 2 ? SNAKE_2 : SNAKE_3;
  return pat[pos % pat.length];
}

function buildTeamsFromMembers(members, captainIds) {
  if (members.length < MIN_TOTAL) {
    throw new Error('É preciso ter pelo menos 6 confirmados para gerar os times.');
  }

  // Use 2 teams when fewer than 12 players, 3 teams otherwise
  const TEAM_KEYS = members.length < 12 ? TEAM_KEYS_2 : TEAM_KEYS_3;
  const numTeams  = TEAM_KEYS.length;

  const hasRatings = members.some((m) => m.skillRating != null);

  if (hasRatings) {
    // ── Balanced mode (snake draft) ────────────────────────────────────────
    const rated = members.map((m) => ({ ...m, _r: m.skillRating ?? 3 }));
    rated.sort((a, b) => b._r !== a._r ? b._r - a._r : Math.random() - 0.5);

    const teams = Object.fromEntries(TEAM_KEYS.map(k => [k, []]));
    rated.forEach((member, i) => {
      teams[TEAM_KEYS[snakeIndex(i, TEAM_KEYS)]].push(member.name);
    });

    let benchTeam = null;
    if (members.length < numTeams * 5) {
      const totals = TEAM_KEYS.map((k) => ({
        key: k,
        total: rated.filter((m) => teams[k].includes(m.name)).reduce((s, m) => s + m._r, 0),
      }));
      totals.sort((a, b) => a.total - b.total);
      benchTeam = totals[0].key;
    }

    return { teams, benchTeam, numTeams };
  }

  // ── Random mode with captains ──────────────────────────────────────────
  const idsSet = new Set(captainIds.map(Number));
  const selectedCaptains = members.filter((m) => idsSet.has(m.id)).slice(0, numTeams);
  const fallback = shuffle(members.filter((m) => !idsSet.has(m.id)));
  const captains = [
    ...selectedCaptains,
    ...fallback.slice(0, Math.max(0, numTeams - selectedCaptains.length)),
  ].slice(0, numTeams);

  if (captains.length < numTeams) {
    throw new Error(`São necessários pelo menos ${numTeams} jogadores para os capitães.`);
  }

  const captainSet = new Set(captains.map((c) => c.id));
  const remaining  = shuffle(members.filter((m) => !captainSet.has(m.id)));

  const teams = Object.fromEntries(TEAM_KEYS.map((k, i) => [k, [captains[i].name]]));
  remaining.forEach((member, index) => {
    teams[TEAM_KEYS[index % numTeams]].push(member.name);
  });

  let benchTeam = null;
  if (members.length < numTeams * 5) {
    const sizes = TEAM_KEYS.map((k) => ({ key: k, size: teams[k].length }));
    sizes.sort((a, b) => a.size - b.size);
    benchTeam = sizes[0].key;
  }

  return { teams, benchTeam, numTeams };
}

// PATCH — move a single player to a different team
export async function onRequestPatch(context) {
  try {
    await initializeDb(context.env);
    const session = await requireAdmin(context.request, context.env);
    if (!session) return error('Sessão expirada.', 401);

    const { playerName, toTeam } = await context.request.json();
    if (!playerName || !toTeam) return error('playerName e toTeam são obrigatórios.');

    // Load current teams from DB
    const { teams, benchTeam } = await listTeams(context.env);

    // Remove player from current team
    for (const key of Object.keys(teams)) {
      teams[key] = (teams[key] || []).filter(n => n !== playerName);
    }
    // Add to target team
    if (!teams[toTeam]) teams[toTeam] = [];
    teams[toTeam].push(playerName);

    await replaceTeams(context.env, teams, benchTeam);
    return json({ ok: true, state: await buildPublicState(context.env) });
  } catch (err) {
    if (err.message === '401') return error('Sessão expirada.', 401);
    return error(err.message || 'Erro ao mover jogador.', 500);
  }
}

export async function onRequestPost(context) {
  try {
    await initializeDb(context.env);
    const session = await requireAdmin(context.request, context.env);
    if (!session) return error('Sessão expirada.', 401);

    const body = await context.request.json();
    const members = await listMembers(context.env, 'confirmed');
    const { teams, benchTeam } = buildTeamsFromMembers(members, body.captainIds || []);
    await replaceTeams(context.env, teams, benchTeam);
    return json({ ok: true, state: await buildPublicState(context.env) });
  } catch (err) {
    return error(err.message || 'Não foi possível gerar os times.', err.message === 'Sessão expirada.' ? 401 : 500);
  }
}
