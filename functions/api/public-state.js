import { buildPublicState, initializeDb } from './lib/db.js';
import { json, error } from './lib/helpers.js';

export async function onRequestGet(context) {
  try {
    await initializeDb(context.env);
    const data = await buildPublicState(context.env);
    return json(data);
  } catch (err) {
    // Surface the actual error message — helps diagnose DB/init issues
    console.error('[public-state] error:', err?.message, err?.stack);
    return error(`Erro ao carregar estado: ${err?.message || 'erro desconhecido'}`, 500);
  }
}
