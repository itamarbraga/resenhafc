import { initializeDb, updateMemberRating } from '../lib/db.js';
import { requireAdmin } from '../lib/auth.js';
import { error, json } from '../lib/helpers.js';

export async function onRequestPatch(context) {
  try {
    await initializeDb(context.env);
    const session = await requireAdmin(context.request, context.env);
    if (!session) return error('Sessão expirada.', 401);

    const { memberId, rating } = await context.request.json();
    if (!memberId) return error('memberId obrigatório.', 400);
    // rating null = clear, 1-5 = valid
    const val = rating === null ? null : Math.max(1, Math.min(5, Number(rating)));
    await updateMemberRating(context.env, memberId, val);
    return json({ ok: true });
  } catch (err) {
    return error(err.message || 'Erro ao salvar nota.', 500);
  }
}
