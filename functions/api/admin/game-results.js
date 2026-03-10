import { buildPublicState, deleteGameDay, initializeDb, listGameDays, listTeams, saveGameDay } from '../lib/db.js';
import { requireAdmin } from '../lib/auth.js';
import { error, json } from '../lib/helpers.js';

async function ensureAdmin(context) {
  await initializeDb(context.env);
  const session = await requireAdmin(context.request, context.env);
  if (!session) throw new Error('401');
}

// GET — list past game days
export async function onRequestGet(context) {
  try {
    await ensureAdmin(context);
    const days = await listGameDays(context.env);
    return json({ ok: true, gameDays: days });
  } catch (err) {
    if (err.message === '401') return error('Sessão expirada.', 401);
    return error(err.message || 'Erro ao carregar histórico.', 500);
  }
}

// POST — save a new game day result
export async function onRequestPost(context) {
  try {
    await ensureAdmin(context);
    const body = await context.request.json();

    const { gameDate, teamResults, playerGoals } = body;
    if (!gameDate) return error('Data do jogo é obrigatória.');
    if (!teamResults || typeof teamResults !== 'object') return error('Resultados dos times são obrigatórios.');

    // Validate team results
    for (const key of ['A', 'B', 'C']) {
      const t = teamResults[key];
      if (!t || typeof t.wins !== 'number' || typeof t.losses !== 'number') {
        return error(`Vitórias e derrotas do Time ${key} são obrigatórias.`);
      }
    }

    // Get current team rosters to distribute minutes
    const teamsData = await listTeams(context.env);
    const currentTeams = teamsData.teams;

    const gameDayId = await saveGameDay(
      context.env,
      gameDate,
      teamResults,
      playerGoals || [],
      currentTeams
    );

    return json({ ok: true, gameDayId, state: await buildPublicState(context.env) });
  } catch (err) {
    if (err.message === '401') return error('Sessão expirada.', 401);
    return error(err.message || 'Erro ao salvar resultado.', 500);
  }
}

// DELETE — remove a game day
export async function onRequestDelete(context) {
  try {
    await ensureAdmin(context);
    const body = await context.request.json();
    if (!body.id) return error('ID obrigatório.');
    await deleteGameDay(context.env, Number(body.id));
    return json({ ok: true, state: await buildPublicState(context.env) });
  } catch (err) {
    if (err.message === '401') return error('Sessão expirada.', 401);
    return error(err.message || 'Erro ao remover resultado.', 500);
  }
}
