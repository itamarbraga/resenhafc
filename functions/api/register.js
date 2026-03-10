import { initializeDb, playerExists, registerPlayer, usernameExists } from './lib/db.js';
import { error, hashPassword, json, sanitizeName } from './lib/helpers.js';

const MAX_PHOTO_BYTES = 200 * 1024;

const BR_STATES = new Set([
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
  'INTL',
]);

export async function onRequestPost(context) {
  try {
    await initializeDb(context.env);
    const body = await context.request.json();

    const firstName = sanitizeName(body.firstName);
    const lastName  = sanitizeName(body.lastName);
    const username  = String(body.username || '').trim().toLowerCase().replace(/[^a-z0-9_\.]/g, '').slice(0, 30);
    const password  = String(body.password || '').trim();
    const phone     = String(body.phone || '').trim().slice(0, 30);
    const state     = String(body.state || '').toUpperCase().trim();

    if (!firstName || firstName.length < 2)  return error('Digite um nome válido.');
    if (!lastName  || lastName.length  < 2)  return error('Digite um sobrenome válido.');
    if (!username  || username.length  < 3)  return error('Nome de usuário deve ter pelo menos 3 caracteres.');
    if (!/^[a-z0-9_\.]+$/.test(username))    return error('Nome de usuário: use apenas letras, números, _ ou .');
    if (!password  || password.length  < 6)  return error('A senha deve ter pelo menos 6 caracteres.');
    if (!BR_STATES.has(state))               return error('Selecione um estado válido.');
    if (!body.photoData)                     return error('A foto de perfil é obrigatória.');
    if (!body.photoData.startsWith('data:image/')) return error('Formato de foto inválido.');
    if (body.photoData.length > MAX_PHOTO_BYTES * 1.37) return error('Foto muito grande. Máximo 200 KB.');

    if (await usernameExists(context.env, username)) {
      return error('Esse nome de usuário já está em uso. Escolha outro.');
    }
    if (await playerExists(context.env, firstName, lastName)) {
      return error('Já existe um cadastro com esse nome. Entre em contato com o admin.');
    }

    const { hash: passwordHash, salt: passwordSalt } = await hashPassword(password);

    const id = await registerPlayer(context.env, {
      firstName, lastName, username, passwordHash, passwordSalt, phone, state,
      photoData: body.photoData,
    });

    return json({ ok: true, playerId: id });
  } catch (err) {
    return error(err.message || 'Erro ao cadastrar perfil.', 500);
  }
}
