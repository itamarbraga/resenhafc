import { buildPublicState, deleteMember, initializeDb, memberExists, updateMemberStatus } from '../lib/db.js';
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
    if (await memberExists(context.env, name)) return error('Esse nome já existe na lista.');

    // playerId comes directly from the dropdown — no need to re-fetch from DB
    const playerId = body.playerId ? Number(body.playerId) : null;

    // Insert member. When playerId is set, listMembers joins players table
    // automatically (COALESCE(p.photo_data, m.photo_data)) — no need to copy photo.
    await context.env.DB
      .prepare('INSERT INTO members (name, status, photo_data, player_id, payment_proof) VALUES (?1, ?2, NULL, ?3, NULL)')
      .bind(name, status, playerId)
      .run();

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
    return error(err.message || 'Não foi possível atualizar.', 500);
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
    return error(err.message || 'Não foi possível remover.', 500);
  }
}
