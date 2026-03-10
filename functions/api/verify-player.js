import { getPlayerByUsername, initializeDb } from './lib/db.js';
import { error, json, verifyPassword } from './lib/helpers.js';

export async function onRequestPost(context) {
  try {
    await initializeDb(context.env);
    const body = await context.request.json();

    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '').trim();

    if (!username || !password) return error('Preencha o usuário e a senha.');

    const player = await getPlayerByUsername(context.env, username);
    if (!player) return error('Usuário não encontrado.');
    if (player.status !== 'approved') return error('Seu cadastro ainda não foi aprovado pelo admin.');

    const ok = await verifyPassword(password, player.passwordHash, player.passwordSalt);
    if (!ok) return error('Senha incorreta.');

    // Return safe player info (no password fields)
    return json({
      ok: true,
      player: {
        id: player.id,
        fullName: player.fullName,
        firstName: player.firstName,
        lastName: player.lastName,
        state: player.state,
        photoData: player.photoData,
      },
    });
  } catch (err) {
    return error(err.message || 'Erro ao verificar credenciais.', 500);
  }
}
