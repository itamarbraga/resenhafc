import { initializeDb } from '../lib/db.js';
import { requireAdmin } from '../lib/auth.js';
import { error, json } from '../lib/helpers.js';

export async function onRequestGet(context) {
  try {
    await initializeDb(context.env);
    const session = await requireAdmin(context.request, context.env);
    if (!session) return error('Não autorizado.', 401);

    // Raw confirmed members with player_id and photo presence
    const members = await context.env.DB
      .prepare(`
        SELECT m.id, m.name, m.status, m.player_id,
               CASE WHEN m.photo_data IS NOT NULL AND m.photo_data != '' THEN 'sim' ELSE 'não' END AS tem_foto_propria,
               CASE WHEN p.photo_data IS NOT NULL AND p.photo_data != '' THEN 'sim' ELSE 'não' END AS tem_foto_perfil,
               p.first_name, p.last_name
        FROM members m
        LEFT JOIN players p ON m.player_id = p.id
        WHERE m.status = 'confirmed'
        ORDER BY m.id DESC
        LIMIT 20
      `)
      .all();

    return json({ ok: true, members: members.results });
  } catch (err) {
    return error(err.message, 500);
  }
}
