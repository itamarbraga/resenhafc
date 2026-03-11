import { buildPublicState, deletePlayer, initializeDb, listPlayers, updatePlayerStatus } from '../lib/db.js';
import { requireAdmin } from '../lib/auth.js';
import { error, json, hashPassword } from '../lib/helpers.js';

async function ensureAdmin(context) {
  await initializeDb(context.env);
  const session = await requireAdmin(context.request, context.env);
  if (!session) throw new Error('401');
}

// GET — list all players (pending + approved)
export async function onRequestGet(context) {
  try {
    await ensureAdmin(context);
    const [pending, approved] = await Promise.all([
      listPlayers(context.env, 'pending'),
      listPlayers(context.env, 'approved'),
    ]);
    return json({ ok: true, pendingPlayers: pending, approvedPlayers: approved });
  } catch (err) {
    if (err.message === '401') return error('Sessão expirada.', 401);
    return error(err.message || 'Erro ao carregar jogadores.', 500);
  }
}

// PATCH — approve/reject player OR reset password
export async function onRequestPatch(context) {
  try {
    await ensureAdmin(context);
    const body = await context.request.json();

    if (body.action === 'reset-password') {
      const { id, newPassword } = body;
      if (!newPassword || newPassword.length < 6) throw new Error('Senha deve ter pelo menos 6 caracteres.');
      const { hash, salt } = await hashPassword(newPassword);
      await context.env.DB
        .prepare('UPDATE players SET password_hash = ?1, password_salt = ?2 WHERE id = ?3')
        .bind(hash, salt, Number(id))
        .run();
      return json({ ok: true });
    }

    const status = body.action === 'approve' ? 'approved' : 'rejected';
    await updatePlayerStatus(context.env, Number(body.id), status);
    return json({ ok: true, state: await buildPublicState(context.env) });
  } catch (err) {
    if (err.message === '401') return error('Sessão expirada.', 401);
    return error(err.message || 'Erro ao atualizar jogador.', 500);
  }
}

// DELETE — remove player profile
export async function onRequestDelete(context) {
  try {
    await ensureAdmin(context);
    const body = await context.request.json();
    await deletePlayer(context.env, Number(body.id));
    return json({ ok: true });
  } catch (err) {
    if (err.message === '401') return error('Sessão expirada.', 401);
    return error(err.message || 'Erro ao remover jogador.', 500);
  }
}
