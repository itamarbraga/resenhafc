import { addMember, buildPublicState, deleteMember, getPlayer, initializeDb, memberExists, updateMemberStatus } from '../lib/db.js';
import { requireAdmin } from '../lib/auth.js';
import { error, json, sanitizeName } from '../lib/helpers.js';

async function ensureAdmin(context) {
  await initializeDb(context.env);
  const session = await requireAdmin(context.request, context.env);
  if (!session) throw new Error('401');
}

export async function onRequestPost(context) {
  try {
    await ensureAdmin(context);
    const body = await context.request.json();
    const name = sanitizeName(body.name);
    const status = body.status === 'confirmed' ? 'confirmed' : 'pending';
    if (!name || name.length < 2) return error('Digite um nome válido.');
    if (await memberExists(context.env, name)) return error('Esse nome já existe.');

    // If a player profile id was supplied, pull photo + player_id from it
    let photoData = body.photoData || null;
    let playerId  = body.playerId  || null;
    if (playerId) {
      const player = await getPlayer(context.env, Number(playerId));
      if (player) {
        photoData = player.photoData || photoData;
        playerId  = player.id;
      }
    }

    await addMember(context.env, name, status, photoData, playerId);
    return json({ ok: true, state: await buildPublicState(context.env) });
  } catch (err) {
    if (err.message === '401') return error('Sessão expirada.', 401);
    return error(err.message || 'Não foi possível adicionar o jogador.', 500);
  }
}

export async function onRequestPatch(context) {
  try {
    await ensureAdmin(context);
    const body = await context.request.json();
    if (body.action !== 'approve') return error('Ação inválida.');
    await updateMemberStatus(context.env, Number(body.id), 'confirmed');
    return json({ ok: true, state: await buildPublicState(context.env) });
  } catch (err) {
    if (err.message === '401') return error('Sessão expirada.', 401);
    return error(err.message || 'Não foi possível atualizar o jogador.', 500);
  }
}

export async function onRequestDelete(context) {
  try {
    await ensureAdmin(context);
    const body = await context.request.json();
    await deleteMember(context.env, Number(body.id));
    return json({ ok: true, state: await buildPublicState(context.env) });
  } catch (err) {
    if (err.message === '401') return error('Sessão expirada.', 401);
    return error(err.message || 'Não foi possível remover o jogador.', 500);
  }
}
