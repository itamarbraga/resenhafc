import { initializeDb } from '../lib/db.js';
import { requireAdmin } from '../lib/auth.js';
import { error, json } from '../lib/helpers.js';

export async function onRequestGet(context) {
  try {
    await initializeDb(context.env);
    const session = await requireAdmin(context.request, context.env);
    if (!session) return error('Não autorizado.', 401);

    const members = await context.env.DB
      .prepare(`
        SELECT m.id, m.name, m.status, m.player_id,
               CASE WHEN m.photo_data IS NOT NULL THEN 'sim' ELSE 'não' END AS foto_membro,
               CASE WHEN p.photo_data IS NOT NULL THEN 'sim' ELSE 'não' END AS foto_perfil,
               CASE WHEN COALESCE(p.photo_data, m.photo_data) IS NOT NULL THEN 'sim' ELSE 'não' END AS foto_final,
               p.first_name, p.last_name, p.id AS p_id
        FROM members m
        LEFT JOIN players p ON m.player_id = p.id
        ORDER BY m.id DESC
        LIMIT 20
      `)
      .all();

    const players = await context.env.DB
      .prepare(`SELECT id, first_name, last_name, status, CASE WHEN photo_data IS NOT NULL AND photo_data != '' THEN 'sim' ELSE 'não' END AS tem_foto FROM players ORDER BY id DESC LIMIT 10`)
      .all();

    return json({ ok: true, members: members.results, players: players.results });
  } catch (err) {
    return error(err.message, 500);
  }
}
