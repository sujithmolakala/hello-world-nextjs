import { authenticated, apiError } from '@/lib/api';
import { InputError, validateId } from '@/lib/validation';
export async function GET(request: Request) {
  try {
    const { supabase } = await authenticated(request);
    const params = new URL(request.url).searchParams;
    const ids = (params.get('ids') || '').split(',');
    if (!ids.length || ids.length > 48) throw new InputError('Request at most 48 captions.');
    ids.forEach(validateId);
    const { data, error } = await supabase.rpc('caption_deck_items', { caption_ids: ids });
    if (error) throw new InputError('Captions could not be loaded.', 503);
    if (params.get('image') === '1') {
      if (ids.length !== 1 || !data?.[0]) throw new InputError('Caption not found.', 404);
      const { data: image, error: imageError } = await supabase.storage.from('caption-images').createSignedUrl(data[0].image_path, 300);
      if (imageError) throw new InputError('The image could not be loaded.', 503);
      return Response.json({ item: data[0], imageUrl: image.signedUrl }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    return Response.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error); }
}
