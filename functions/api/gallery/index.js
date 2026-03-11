import { addGalleryItem, deleteGalleryItem, initializeDb, listGallery, getPlayerSession, getPlayer } from '../lib/db.js';
import { error, json, getCookie } from '../lib/helpers.js';
import { requireAdmin } from '../lib/auth.js';

const MAX_PHOTO_BYTES = 3 * 1024 * 1024 * 1.37; // ~3 MB base64

async function getAuthPlayer(context) {
  const token = getCookie(context.request, 'bfc_player');
  const session = await getPlayerSession(context.env, token);
  if (!session) return null;
  return getPlayer(context.env, session.playerId);
}

function extractVideoId(url) {
  // YouTube
  let m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
  if (m) return { platform: 'youtube', id: m[1] };
  // Instagram
  m = url.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  if (m) return { platform: 'instagram', id: m[1] };
  return null;
}

// GET — list gallery (requires player session)
export async function onRequestGet(context) {
  try {
    await initializeDb(context.env);
    const player = await getAuthPlayer(context);
    if (!player) return error('Faça login para ver a galeria.', 401);
    const items = await listGallery(context.env);
    return json({ ok: true, items });
  } catch (err) {
    return error(err.message || 'Erro ao carregar galeria.', 500);
  }
}

// POST — add photo or video (requires player session)
export async function onRequestPost(context) {
  try {
    await initializeDb(context.env);
    const player = await getAuthPlayer(context);
    if (!player) return error('Faça login para publicar.', 401);
    if (player.status !== 'approved') return error('Seu perfil ainda não foi aprovado.', 403);

    const body = await context.request.json();
    const { type, photoData, videoUrl, caption } = body;

    if (type === 'photo') {
      if (!photoData || !photoData.startsWith('data:image/')) return error('Foto inválida.');
      if (photoData.length > MAX_PHOTO_BYTES) return error('Foto muito grande. Máximo ~3 MB.');
      await addGalleryItem(context.env, { playerId: player.id, type: 'photo', photoData, caption });

    } else if (type === 'video') {
      if (!videoUrl) return error('Cole o link do YouTube ou Instagram.');
      const parsed = extractVideoId(videoUrl.trim());
      if (!parsed) return error('Link inválido. Use YouTube (youtube.com, youtu.be) ou Instagram (instagram.com/p/ ou /reel/).');
      const canonicalUrl = parsed.platform === 'youtube'
        ? `https://www.youtube.com/watch?v=${parsed.id}`
        : `https://www.instagram.com/p/${parsed.id}/`;
      await addGalleryItem(context.env, { playerId: player.id, type: 'video', videoUrl: canonicalUrl, caption });

    } else {
      return error('Tipo inválido. Use "photo" ou "video".');
    }

    const items = await listGallery(context.env);
    return json({ ok: true, items });
  } catch (err) {
    return error(err.message || 'Erro ao publicar.', 500);
  }
}

// DELETE — remove item (own or admin)
export async function onRequestDelete(context) {
  try {
    await initializeDb(context.env);
    const body = await context.request.json();
    const id = Number(body.id);

    // Check admin first
    const adminSession = await requireAdmin(context.request, context.env);
    if (adminSession) {
      await deleteGalleryItem(context.env, id, null);
      return json({ ok: true });
    }

    // Check player session — can only delete own items
    const player = await getAuthPlayer(context);
    if (!player) return error('Não autenticado.', 401);
    await deleteGalleryItem(context.env, id, player.id);
    return json({ ok: true });
  } catch (err) {
    return error(err.message || 'Erro ao remover item.', 500);
  }
}
