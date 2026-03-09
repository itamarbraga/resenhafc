import { createSession, initializeDb } from '../lib/db.js';
import { error, json, randomToken, sessionCookie } from '../lib/helpers.js';

export async function onRequestPost(context) {
  try {
    await initializeDb(context.env);
    const body = await context.request.json();
    const adminUser = context.env.ADMIN_USER || 'itamar';
    const adminPassword = context.env.ADMIN_PASSWORD || 'futsal2026';

    if (body.username !== adminUser || body.password !== adminPassword) {
      return error('Usuário ou senha inválidos.', 401);
    }

    const token = randomToken();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
    await createSession(context.env, token, adminUser, expiresAt);

    return json(
      { ok: true },
      { headers: { 'Set-Cookie': sessionCookie(token) } },
    );
  } catch (err) {
    return error(err.message || 'Não foi possível fazer login.', 500);
  }
}
