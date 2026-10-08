import { authenticated, apiError } from '@/lib/api';
import { InputError, validateId } from '@/lib/validation';
export async function GET(request: Request) {
  try {
    const { supabase } = await authenticated(request);
    const params = new URL(request.url).searchParams;
    const month = params.get('month');
    const seen = params.get('seen');
    const id = params.get('id');
    if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new InputError('Invalid month.');
    if (seen && (!Number.isFinite(Date.parse(seen)) || seen.length > 40)) throw new InputError('Invalid timestamp.');
    if (id) validateId(id);
    const { data, error } = await supabase.rpc('caption_deck_snapshot', { ...(month ? { selected_month: month } : {}), ...(seen ? { seen_created_at: seen } : {}), ...(id ? { seen_id: id } : {}) });
    if (error) throw new InputError('Monthly decks could not be loaded. Check that migration 202610080003 has been applied.', 503);
    return Response.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error); }
}
