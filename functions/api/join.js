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
    const validProof = body.paymentProof.startsWith('data:image/') || body.paymentProof.startsWith('data:application/pdf');
    if (!validProof) return error('Formato inválido. Use imagem ou PDF.');
    const maxBytes = body.paymentProof.startsWith('data:application/pdf') ? 5 * 1024 * 1024 * 1.37 : MAX_PROOF_BYTES * 1.37;
    if (body.paymentProof.length > maxBytes) return error('Arquivo muito grande. Máximo 5 MB para PDF, 300 KB para imagem.');

    if (await memberExists(context.env, player.fullName)) {
      return error('Você já está na lista ou aguardando aprovação.');
    }

    await addMember(context.env, player.fullName, 'pending', null, playerId, body.paymentProof);
    return json({ ok: true, state: await buildPublicState(context.env) });
  } catch (err) {
    return error(err.message || 'Não foi possível entrar na lista.', 500);
  }
}
