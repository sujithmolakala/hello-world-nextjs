import { authenticated, apiError } from '@/lib/api';
import { imageForm, InputError, validateImage, validatePrompt } from '@/lib/validation';
import { generateCaption, generationPrompt } from '@/lib/gemini';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const { supabase, user } = await authenticated(request);
    const form = await imageForm(request);
    const context = validatePrompt(form.get('prompt'));
    const image = await validateImage(form.get('image'));
    // Read a small authenticated community sample; never let an optional history
    // lookup failure block generation. Only caption text goes into the prompt.
    let recentCaptions: string[] = [];
    try {
      const { data: recent, error: historyError } = await supabase.rpc('caption_feed', {
        sort_by: 'newest', page_offset: 0, page_size: 5,
      }).abortSignal(AbortSignal.timeout(3000));
      if (!historyError) recentCaptions = (recent || []).map(item => item.caption);
    } catch {
      // History is optional; a timeout or unavailable feed must not prevent generation.
    }
    const prompt = generationPrompt(context, recentCaptions);
    const result = await generateCaption(image.bytes, image.mime, prompt);
    const imagePath = `${user.id}/${crypto.randomUUID()}.${image.extension}`;
    const { error: uploadError } = await supabase.storage.from('caption-images').upload(imagePath, image.bytes, { contentType: image.mime, upsert: false });
    if (uploadError) throw new InputError('The image could not be saved. Check that the caption storage migration has been applied.', 503);
    const { data, error } = await supabase.from('captions').insert({ creator_id: user.id, image_path: imagePath, user_prompt: context, generation_prompt: prompt, caption: result.caption, model: result.model }).select('id').single();
    if (error) {
      await supabase.storage.from('caption-images').remove([imagePath]);
      throw new InputError('The caption could not be saved. Please check the database migration and try again.', 503);
    }
    return Response.json({ id: data.id, caption: result.caption }, { status: 201 });
  } catch (error) { return apiError(error); }
}
