import { createPlayerSession, getPlayerByUsername, initializeDb } from '../lib/db.js';
import { error, getCookie, json, playerSessionCookie, randomToken, verifyPassword } from '../lib/helpers.js';

export async function onRequestPost(context) {
  try {
    await initializeDb(context.env);

    // Already logged in?
    const existing = getCookie(context.request, 'bfc_player');
    if (existing) {
      // Clear stale cookie gracefully
    }

    const body = await context.request.json();
    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '').trim();

    if (!username || !password) return error('Preencha o usuário e a senha.');

    const player = await getPlayerByUsername(context.env, username);
    if (!player) return error('Usuário não encontrado.');
    if (player.status === 'pending')  return error('Seu cadastro ainda não foi aprovado pelo admin.');
    if (player.status === 'rejected') return error('Seu cadastro foi recusado. Entre em contato.');

    const ok = await verifyPassword(password, player.passwordHash, player.passwordSalt);
    if (!ok) return error('Senha incorreta.');

    const token     = randomToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await createPlayerSession(context.env, token, player.id, expiresAt);

    return json({
      ok: true,
      player: {
        id: player.id,
        fullName: player.fullName,
        firstName: player.firstName,
        lastName: player.lastName,
        state: player.state,
        phone: player.phone,
        photoData: player.photoData,
        username,
      },
    }, { headers: { 'Set-Cookie': playerSessionCookie(token) } });
  } catch (err) {
    return error(err.message || 'Erro ao fazer login.', 500);
  }
}
