import { buildPublicState, initializeDb, listGameDays, listMembers, listPlayers } from '../lib/db.js';
import { requireAdmin } from '../lib/auth.js';
import { error, json } from '../lib/helpers.js';

export async function onRequestGet(context) {
  try {
    await initializeDb(context.env);
    const session = await requireAdmin(context.request, context.env);
    if (!session) return error('Sessão expirada.', 401);

    const [publicState, pendingMembers, gameDays, pendingPlayers, approvedPlayers] = await Promise.all([
      buildPublicState(context.env),
      listMembers(context.env, 'pending'),
      listGameDays(context.env),
      listPlayers(context.env, 'pending'),
      listPlayers(context.env, 'approved'),
    ]);

    return json({
      ...publicState,
      pendingMembers,
      gameDays,
      pendingPlayers,
      approvedPlayers,
    });
  } catch (err) {
    return error(err.message || 'Erro ao carregar painel admin.', 500);
  }
}
