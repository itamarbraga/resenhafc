import { addMember, buildPublicState, getPlayer, initializeDb, memberExists } from './lib/db.js';
import { error, json } from './lib/helpers.js';

const MAX_PROOF_BYTES = 300 * 1024; // 300 KB for payment proof

export async function onRequestPost(context) {
  try {
    await initializeDb(context.env);
    const body = await context.request.json();

    // Must provide a registered player ID
    const playerId = Number(body.playerId);
    if (!playerId) return error('Selecione seu perfil cadastrado.');

    const player = await getPlayer(context.env, playerId);
    if (!player) return error('Perfil não encontrado.');
    if (player.status !== 'approved') return error('Seu cadastro ainda não foi aprovado pelo admin.');

    // Payment proof required
    if (!body.paymentProof) return error('O comprovante de pagamento é obrigatório.');
    if (!body.paymentProof.startsWith('data:image/')) return error('Formato de comprovante inválido.');
    if (body.paymentProof.length > MAX_PROOF_BYTES * 1.37) return error('Comprovante muito grande. Máximo 300 KB.');

    const fullName = player.fullName;

    if (await memberExists(context.env, fullName)) {
      return error('Você já está na lista ou aguardando aprovação.');
    }

    await addMember(context.env, fullName, 'pending', null, playerId, body.paymentProof);
    return json({ ok: true, state: await buildPublicState(context.env) });
  } catch (err) {
    return error(err.message || 'Não foi possível entrar na lista.', 500);
  }
}
