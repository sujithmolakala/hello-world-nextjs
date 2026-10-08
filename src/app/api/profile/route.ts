import { authenticated, apiError } from '@/lib/api';
import { imageForm, InputError, validateImage, validateName } from '@/lib/validation';
export async function POST(request: Request) {
  try {
    const { supabase, user } = await authenticated(request);
    const form = await imageForm(request);
    const first_name = validateName(form.get('firstName'));
    const last_name = validateName(form.get('lastName'));
    const photo = form.get('image');
    let avatar_url: string | undefined;
    let path: string | undefined;
    if (photo instanceof File && photo.size) {
      const image = await validateImage(photo);
      path = `${user.id}/${crypto.randomUUID()}.${image.extension}`;
      const { error } = await supabase.storage.from('avatars').upload(path, image.bytes, { contentType: image.mime, upsert: false });
      if (error) throw new InputError('Avatar upload failed. Please try again.', 503);
      avatar_url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
    }
    const { data, error } = await supabase.from('profiles').update({ first_name, last_name, ...(avatar_url ? { avatar_url } : {}) }).eq('id', user.id).select('id').maybeSingle();
    if (error || !data) {
      if (path) await supabase.storage.from('avatars').remove([path]);
      throw new InputError('Profile could not be saved. Check that your account has a profile row and the database migration is applied.', 503);
    }
    return Response.json({ avatarUrl: avatar_url });
  } catch (error) { return apiError(error); }
}
