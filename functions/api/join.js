import { addMember, buildPublicState, initializeDb, memberExists } from './lib/db.js';
import { error, json, sanitizeName } from './lib/helpers.js';

const MAX_PHOTO_BYTES = 150 * 1024; // 150 KB max after base64

export async function onRequestPost(context) {
  try {
    await initializeDb(context.env);
    const body = await context.request.json();
    const name = sanitizeName(body.name);
    if (!name || name.length < 2) return error('Digite um nome válido.');
    if (!body.photoData) return error('A foto é obrigatória.');
    if (!body.photoData.startsWith('data:image/')) return error('Formato de foto inválido.');
    if (body.photoData.length > MAX_PHOTO_BYTES * 1.37) return error('Foto muito grande. Tente uma imagem menor.');
    if (await memberExists(context.env, name)) {
      return error('Esse nome já está na lista ou aguardando aprovação.');
    }
    await addMember(context.env, name, 'pending', body.photoData);
    return json({ ok: true, state: await buildPublicState(context.env) });
  } catch (err) {
    return error(err.message || 'Não foi possível enviar seu nome.', 500);
  }
}
