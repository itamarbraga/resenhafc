import { initializeDb } from '../lib/db.js';
import { requireAdmin } from '../lib/auth.js';
import { error, json } from '../lib/helpers.js';

export async function onRequestGet(context) {
  try {
    await initializeDb(context.env);
    const session = await requireAdmin(context.request, context.env);
    if (!session) return error('Não autorizado.', 401);

    // Show last 10 members with their player_id and photo presence
    const members = await context.env.DB
      .prepare(`SELECT m.id, m.name, m.status, m.player_id,
                       CASE WHEN m.photo_data IS NOT NULL THEN 'sim' ELSE 'não' END AS tem_foto_member,
                       CASE WHEN p.photo_data IS NOT NULL THEN 'sim' ELSE 'não' END AS tem_foto_player,
                       COALESCE(p.photo_data, m.photo_data) IS NOT NULL AS foto_final
                FROM members m
                LEFT JOIN players p ON m.player_id = p.id
                ORDER BY m.id DESC LIMIT 10`)
      .all();

    return json({ ok: true, members: members.results });
  } catch (err) {
    return error(err.message, 500);
  }
}
