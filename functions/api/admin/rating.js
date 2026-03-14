import { initializeDb, updatePlayerRating } from '../lib/db.js';
import { requireAdmin } from '../lib/auth.js';
import { error, json } from '../lib/helpers.js';

export async function onRequestPatch(context) {
  try {
    await initializeDb(context.env);
    const session = await requireAdmin(context.request, context.env);
    if (!session) return error('Sessão expirada.', 401);

    const { playerId, rating } = await context.request.json();
    if (!playerId) return error('playerId obrigatório.', 400);
    const val = rating === null ? null : Math.max(1, Math.min(5, Number(rating)));
    await updatePlayerRating(context.env, playerId, val);
    return json({ ok: true });
  } catch (err) {
    return error(err.message || 'Erro ao salvar nota.', 500);
  }
}
