import { authenticated, apiError } from '@/lib/api';
import { boundedBody, InputError, validateId, validateVote } from '@/lib/validation';
export async function POST(request: Request) {
  try {
    const { supabase } = await authenticated(request);
    let body;
    try { body = JSON.parse(new TextDecoder().decode(await boundedBody(request, 2048))); }
    catch (error) { if (error instanceof InputError) throw error; throw new InputError('Send a valid vote.'); }
    const id = validateId(body?.captionId);
    const value = validateVote(body?.value);
    // Atomic INSERT on first vote; ON CONFLICT updates only the caller's existing row.
    const { data: caption, error } = await supabase.rpc('caption_deck_vote', { target_caption: id, vote_value: value });
    if (error) throw new InputError(error.code === '23503' ? 'This caption no longer exists.' : 'Your vote could not be saved. Please try again.', error.code === '23503' ? 404 : 503);
    return Response.json({ value, caption });
  } catch (error) { return apiError(error); }
}
