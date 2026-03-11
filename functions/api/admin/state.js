import { buildPublicState, initializeDb, listGameDays, listMembersAdmin, listMembers, listPlayers } from '../lib/db.js';
import { requireAdmin } from '../lib/auth.js';
import { error, json } from '../lib/helpers.js';

export async function onRequestGet(context) {
  try {
    await initializeDb(context.env);
    const session = await requireAdmin(context.request, context.env);
    if (!session) return error('Sessão expirada.', 401);

    const [publicState, pendingMembers, gameDays, pendingPlayers, approvedPlayers] = await Promise.all([
      buildPublicState(context.env),
      listMembersAdmin(context.env, 'pending'),  // with payment_proof — admin only
      listGameDays(context.env),
      listPlayers(context.env, 'pending'),        // with photo_data — admin only
      listPlayers(context.env, 'approved'),       // with photo_data — admin only
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
