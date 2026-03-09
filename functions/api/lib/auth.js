import { getCookie } from './helpers.js';
import { getSession } from './db.js';

export async function requireAdmin(request, env) {
  const token = getCookie(request, 'bfc_session');
  return getSession(env, token);
}
