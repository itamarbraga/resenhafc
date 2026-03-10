import { addMember, buildPublicState, getPlayer, initializeDb, memberExists } from './lib/db.js';
import { error, json } from './lib/helpers.js';

const MAX_PROOF_BYTES = 300 * 1024;

export async function onRequestPost(context) {
  try {
    await initializeDb(context.env);
    const body = await context.request.json();

    const playerId = Number(body.playerId);
    if (!playerId) return error('Identificação inválida. Faça login novamente.');

    const player = await getPlayer(context.env, playerId);
    if (!player) return error('Perfil não encontrado.');
    if (player.status !== 'approved') return error('Seu cadastro ainda não foi aprovado pelo admin.');

    if (!body.paymentProof) return error('O comprovante de pagamento é obrigatório.');
    if (!body.paymentProof.startsWith('data:image/')) return error('Formato de comprovante inválido.');
    if (body.paymentProof.length > MAX_PROOF_BYTES * 1.37) return error('Comprovante muito grande. Máximo 300 KB.');

    if (await memberExists(context.env, player.fullName)) {
      return error('Você já está na lista ou aguardando aprovação.');
    }

    await addMember(context.env, player.fullName, 'pending', null, playerId, body.paymentProof);
    return json({ ok: true, state: await buildPublicState(context.env) });
  } catch (err) {
    return error(err.message || 'Não foi possível entrar na lista.', 500);
  }
}
