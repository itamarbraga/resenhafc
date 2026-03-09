import { buildPublicState, getConfig, initializeDb, saveConfig } from '../lib/db.js';
import { requireAdmin } from '../lib/auth.js';
import { error, json } from '../lib/helpers.js';

export async function onRequestPut(context) {
  try {
    await initializeDb(context.env);
    const session = await requireAdmin(context.request, context.env);
    if (!session) return error('Sessão expirada.', 401);

    const body = await context.request.json();
    const current = await getConfig(context.env);
    const next = {
      gameDate: body.gameDate || current.gameDate,
      arrivalTime: body.arrivalTime || current.arrivalTime,
      startTime: body.startTime || current.startTime,
      endTime: body.endTime || current.endTime,
      paymentLink: body.paymentLink || current.paymentLink,
      maxSlots: Number(body.maxSlots || current.maxSlots),
    };

    await saveConfig(context.env, next);
    return json({ ok: true, state: await buildPublicState(context.env) });
  } catch (err) {
    return error(err.message || 'Não foi possível salvar as configurações.', 500);
  }
}
