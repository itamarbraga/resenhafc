import { getPlayer, getPlayerByUsername, getPlayerSession, initializeDb, updatePlayer, usernameExists } from '../lib/db.js';
import { error, getCookie, hashPassword, json, sanitizeName, verifyPassword } from '../lib/helpers.js';

const BR_STATES = new Set([
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO','INTL',
]);
const MAX_PHOTO = 200 * 1024;

async function getAuthPlayer(context) {
  const token = getCookie(context.request, 'bfc_player');
  const session = await getPlayerSession(context.env, token);
  if (!session) return null;
  return getPlayer(context.env, session.playerId);
}

// GET /api/player/me — return current player profile
export async function onRequestGet(context) {
  try {
    await initializeDb(context.env);
    const player = await getAuthPlayer(context);
    if (!player) return error('Não autenticado.', 401);
    return json({ ok: true, player: safePlayer(player) });
  } catch (err) {
    return error(err.message || 'Erro.', 500);
  }
}

// PATCH /api/player/me — update profile fields
export async function onRequestPatch(context) {
  try {
    await initializeDb(context.env);
    const player = await getAuthPlayer(context);
    if (!player) return error('Não autenticado.', 401);

    const body = await context.request.json();
    const updates = {};

    if (body.firstName !== undefined) {
      const v = sanitizeName(body.firstName);
      if (!v || v.length < 2) return error('Nome inválido.');
      updates.firstName = v;
    }
    if (body.lastName !== undefined) {
      const v = sanitizeName(body.lastName);
      if (!v || v.length < 2) return error('Sobrenome inválido.');
      updates.lastName = v;
    }
    if (body.phone !== undefined) {
      updates.phone = String(body.phone).trim().slice(0, 30);
    }
    if (body.state !== undefined) {
      const s = String(body.state).toUpperCase().trim();
      if (!BR_STATES.has(s)) return error('Estado inválido.');
      updates.state = s;
    }
    if (body.photoData !== undefined) {
      if (!body.photoData.startsWith('data:image/')) return error('Formato de foto inválido.');
      if (body.photoData.length > MAX_PHOTO * 1.37) return error('Foto muito grande. Máximo 200 KB.');
      updates.photoData = body.photoData;
    }

    // Password change: requires currentPassword + newPassword
    if (body.newPassword !== undefined) {
      if (!body.currentPassword) return error('Informe a senha atual para alterá-la.');
      const ok = await verifyPassword(body.currentPassword, player.passwordHash, player.passwordSalt);
      if (!ok) return error('Senha atual incorreta.');
      if (!body.newPassword || body.newPassword.length < 6) return error('Nova senha deve ter pelo menos 6 caracteres.');
      const { hash, salt } = await hashPassword(body.newPassword);
      updates.passwordHash = hash;
      updates.passwordSalt = salt;
    }

    if (!Object.keys(updates).length) return error('Nenhuma alteração enviada.');

    await updatePlayer(context.env, player.id, updates);
    const updated = await getPlayer(context.env, player.id);
    return json({ ok: true, player: safePlayer(updated) });
  } catch (err) {
    return error(err.message || 'Erro ao atualizar perfil.', 500);
  }
}

function safePlayer(p) {
  return {
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    fullName: p.fullName,
    phone: p.phone,
    state: p.state,
    photoData: p.photoData,
    status: p.status,
  };
}
