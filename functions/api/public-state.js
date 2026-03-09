import { buildPublicState, initializeDb } from './lib/db.js';
import { json, error } from './lib/helpers.js';

export async function onRequestGet(context) {
  try {
    await initializeDb(context.env);
    const data = await buildPublicState(context.env);
    return json(data);
  } catch (err) {
    return error(err.message || 'Erro ao carregar estado público.', 500);
  }
}
