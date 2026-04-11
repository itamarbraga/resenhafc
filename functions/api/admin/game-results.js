import { buildPublicState, deleteGameDay, getGameDay, updateGameDay, initializeDb, listGameDays, listTeams, saveGameDay } from '../lib/db.js';
import { requireAdmin } from '../lib/auth.js';
import { error, json } from '../lib/helpers.js';

async function ensureAdmin(context) {
  await initializeDb(context.env);
  const session = await requireAdmin(context.request, context.env);
  if (!session) throw new Error('401');
}

// GET — list past game days, or GET ?id=N for a single game day with details
export async function onRequestGet(context) {
  try {
    await ensureAdmin(context);
    const url = new URL(context.request.url);
    const id = url.searchParams.get('id');
    if (id) {
      const day = await getGameDay(context.env, Number(id));
      if (!day) return error('Jogo não encontrado.', 404);
      return json({ ok: true, day });
    }
    const days = await listGameDays(context.env);
    return json({ ok: true, gameDays: days });
  } catch (err) {
    if (err.message === '401') return error('Sessão expirada.', 401);
    return error(err.message || 'Erro ao carregar histórico.', 500);
  }
}

// PATCH — update goals (and optionally wins) for an existing game day
export async function onRequestPatch(context) {
  try {
    await ensureAdmin(context);
    const body = await context.request.json();
    const { id, teamResults, playerGoals } = body;
    if (!id) return error('ID obrigatório.');
    await updateGameDay(context.env, Number(id), teamResults || {}, playerGoals || []);
    return json({ ok: true, state: await buildPublicState(context.env) });
  } catch (err) {
    if (err.message === '401') return error('Sessão expirada.', 401);
    return error(err.message || 'Erro ao atualizar resultado.', 500);
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

    // Get current team rosters — determines which teams are active
    const teamsData = await listTeams(context.env);
    const currentTeams = teamsData.teams;
    const activeKeys = Object.keys(currentTeams).filter(k => (currentTeams[k] || []).length > 0);

    // Validate only active teams; ignore Azul when only 2 teams
    for (const key of activeKeys) {
      const t = teamResults[key];
      if (!t || typeof t.wins !== 'number') {
        return error(`Vitórias do Time ${key} são obrigatórias.`);
      }
      t.losses = 0;
    }
    // Remove Azul from results if not an active team
    if (!activeKeys.includes('Azul')) delete teamResults['Azul'];

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
