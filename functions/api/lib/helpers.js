export const DEFAULT_WHATSAPP = 'https://chat.whatsapp.com/GmARWruqeGgApY8gQY7rcb';

export function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function error(message, status = 400) {
  return json({ error: message }, { status });
}

export function randomToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function getCookie(request, name) {
  const cookieHeader = request.headers.get('Cookie') || '';
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.split('='))
    .find(([key]) => key === name)?.[1] || null;
}

export function sessionCookie(token, maxAge = 60 * 60 * 24 * 30) {
  return `bfc_session=${token}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${maxAge}`;
}

export function clearSessionCookie() {
  return 'bfc_session=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0';
}

export function prettyCreatedAt(value) {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'Europe/Amsterdam',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function sanitizeName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').slice(0, 60);
}

export function shuffle(array) {
  const clone = [...array];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}
