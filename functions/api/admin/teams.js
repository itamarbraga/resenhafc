import { buildPublicState, initializeDb, listMembers, replaceTeams } from '../lib/db.js';
import { requireAdmin } from '../lib/auth.js';
import { error, json, shuffle } from '../lib/helpers.js';

const TEAM_KEYS  = ['Vermelho', 'Amarelo', 'Azul'];
const FULL_SIZE  = 5; // players per team for a full match
const MIN_TOTAL  = 6; // minimum to generate teams

// Snake-draft balancing:
// Sort players by skill descending, then distribute in a zig-zag pattern
// so each team's total skill stays as equal as possible.
// Pattern (3 teams): 0,1,2, 2,1,0, 0,1,2, ...
const SNAKE = [0, 1, 2, 2, 1, 0];

function snakeIndex(pos) {
  return SNAKE[pos % SNAKE.length];
}

function buildTeamsFromMembers(members, captainIds) {
  if (members.length < MIN_TOTAL) {
    throw new Error('É preciso ter pelo menos 6 confirmados para gerar os times.');
  }

  const hasRatings = members.some((m) => m.skillRating != null);

  if (hasRatings) {
    // ── Balanced mode (snake draft) ────────────────────────────────────────
    // Default unrated players to 3 (middle of 1-5)
    const rated = members.map((m) => ({
      ...m,
      _r: m.skillRating ?? 3,
    }));
    // Sort by skill descending; shuffle within same rating for fairness
    rated.sort((a, b) => {
      if (b._r !== a._r) return b._r - a._r;
      return Math.random() - 0.5;
    });

    const teams = { Vermelho: [], Amarelo: [], Azul: [] };
    rated.forEach((member, i) => {
      teams[TEAM_KEYS[snakeIndex(i)]].push(member.name);
    });

    let benchTeam = null;
    if (members.length < 15) {
      // Team with lowest total skill sits out (they need the rest most)
      const totals = TEAM_KEYS.map((k) => ({
        key: k,
        total: rated.filter((m) => teams[k].includes(m.name)).reduce((s, m) => s + m._r, 0),
      }));
      totals.sort((a, b) => a.total - b.total);
      benchTeam = totals[0].key;
    }

    return { teams, benchTeam };
  }

  // ── Random mode with captains (original behaviour) ─────────────────────
  const idsSet = new Set(captainIds.map(Number));
  const selectedCaptains = members.filter((m) => idsSet.has(m.id)).slice(0, 3);
  const fallback = members.filter((m) => !idsSet.has(m.id));
  const shuffledFallback = shuffle(fallback);
  const captains = [
    ...selectedCaptains,
    ...shuffledFallback.slice(0, Math.max(0, 3 - selectedCaptains.length)),
  ].slice(0, 3);

  if (captains.length < 3) {
    throw new Error('São necessários pelo menos 3 jogadores para os capitães.');
  }

  const captainIds_ = new Set(captains.map((c) => c.id));
  const remaining = shuffle(members.filter((m) => !captainIds_.has(m.id)));

  const teams = {
    Vermelho: [captains[0].name],
    Amarelo:  [captains[1].name],
    Azul:     [captains[2].name],
  };

  remaining.forEach((member, index) => {
    teams[TEAM_KEYS[index % 3]].push(member.name);
  });

  let benchTeam = null;
  if (members.length < 15) {
    const sizes = TEAM_KEYS.map((k) => ({ key: k, size: teams[k].length }));
    sizes.sort((a, b) => a.size - b.size);
    benchTeam = sizes[0].key;
  }

  return { teams, benchTeam };
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
