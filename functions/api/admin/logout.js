import { deleteSession, initializeDb } from '../lib/db.js';
import { clearSessionCookie, getCookie, json } from '../lib/helpers.js';

export async function onRequestPost(context) {
  await initializeDb(context.env);
  const token = getCookie(context.request, 'bfc_session');
  await deleteSession(context.env, token);
  return json({ ok: true }, { headers: { 'Set-Cookie': clearSessionCookie() } });
}
