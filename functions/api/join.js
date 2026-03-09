import { addMember, buildPublicState, initializeDb, memberExists } from './lib/db.js';
import { error, json, sanitizeName } from './lib/helpers.js';

export async function onRequestPost(context) {
  try {
    await initializeDb(context.env);
    const body = await context.request.json();
    const name = sanitizeName(body.name);
    if (!name || name.length < 2) return error('Digite um nome válido.');
    if (await memberExists(context.env, name)) {
      return error('Esse nome já está na lista ou aguardando aprovação.');
    }
    await addMember(context.env, name, 'pending');
    return json({ ok: true, state: await buildPublicState(context.env) });
  } catch (err) {
    return error(err.message || 'Não foi possível enviar seu nome.', 500);
  }
}
