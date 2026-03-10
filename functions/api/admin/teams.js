import { buildPublicState, initializeDb, listMembers, replaceTeams } from '../lib/db.js';
import { requireAdmin } from '../lib/auth.js';
import { error, json, shuffle } from '../lib/helpers.js';

const TEAM_KEYS  = ['Vermelho', 'Amarelo', 'Azul'];
const FULL_SIZE  = 5; // players per team for a full match
const MIN_TOTAL  = 6; // minimum to generate teams

function buildTeamsFromMembers(members, captainIds) {
  if (members.length < MIN_TOTAL) {
    throw new Error('É preciso ter pelo menos 6 confirmados para gerar os times.');
  }

  // Pick captains (one per team)
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

  // Start each team with its captain
  const teams = {
    Vermelho: [captains[0].name],
    Amarelo:  [captains[1].name],
    Azul:     [captains[2].name],
  };

  // Distribute 1-by-1: Vermelho → Amarelo → Azul → repeat
  remaining.forEach((member, index) => {
    teams[TEAM_KEYS[index % 3]].push(member.name);
  });

  // Determine which team starts on the bench (fewest players when total < 15)
  const total = members.length;
  let benchTeam = null;
  if (total < 15) {
    // The team with fewest players sits out first
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
