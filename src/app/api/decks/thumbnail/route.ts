import sharp from 'sharp';
import { authenticated, apiError } from '@/lib/api';
import { InputError, validateId } from '@/lib/validation';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    const { supabase } = await authenticated(request);
    const id = new URL(request.url).searchParams.get('id') || '';
    validateId(id);
    const { data, error } = await supabase.rpc('caption_deck_items', { caption_ids: [id] });
    if (error || !data?.[0]) throw new InputError('Caption not found.', 404);
    const { data: image, error: imageError } = await supabase.storage.from('caption-images').download(data[0].image_path);
    if (imageError || !image) throw new InputError('Image unavailable.', 503);
    const thumbnail = await sharp(Buffer.from(await image.arrayBuffer()), { limitInputPixels: 40_000_000 }).rotate().resize({ width: 320, height: 200, fit: 'inside', withoutEnlargement: true }).webp({ quality: 65 }).toBuffer();
    return new Response(new Uint8Array(thumbnail), { headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'private, max-age=240', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) { return apiError(error); }
}
