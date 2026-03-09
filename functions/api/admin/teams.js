import { buildPublicState, initializeDb, listMembers, replaceTeams } from '../lib/db.js';
import { requireAdmin } from '../lib/auth.js';
import { error, json, shuffle } from '../lib/helpers.js';

function buildTeamsFromMembers(members, captainIds) {
  if (members.length < 6) {
    throw new Error('É preciso ter pelo menos 6 confirmados para gerar times.');
  }

  const idsSet = new Set(captainIds.map(Number));
  const selectedCaptains = members.filter((member) => idsSet.has(member.id)).slice(0, 3);
  const fallbackCaptains = members.filter((member) => !idsSet.has(member.id)).slice(0, Math.max(0, 3 - selectedCaptains.length));
  const captains = [...selectedCaptains, ...fallbackCaptains].slice(0, 3);

  if (captains.length < 3) {
    throw new Error('Selecione ou mantenha pelo menos 3 jogadores disponíveis para capitães.');
  }

  const remaining = shuffle(members.filter((member) => !captains.some((captain) => captain.id === member.id)));
  const teams = {
    A: [captains[0].name],
    B: [captains[1].name],
    C: [captains[2].name],
  };

  const order = ['A', 'B', 'C'];
  remaining.forEach((member, index) => {
    teams[order[index % order.length]].push(member.name);
  });
  return teams;
}

export async function onRequestPost(context) {
  try {
    await initializeDb(context.env);
    const session = await requireAdmin(context.request, context.env);
    if (!session) return error('Sessão expirada.', 401);

    const body = await context.request.json();
    const members = await listMembers(context.env, 'confirmed');
    const teams = buildTeamsFromMembers(members, body.captainIds || []);
    await replaceTeams(context.env, teams);
    return json({ ok: true, state: await buildPublicState(context.env) });
  } catch (err) {
    return error(err.message || 'Não foi possível gerar os times.', err.message === 'Sessão expirada.' ? 401 : 500);
  }
}
