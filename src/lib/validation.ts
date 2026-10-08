export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const MAX_PROMPT_LENGTH = 1000;
export class InputError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function validatePrompt(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_PROMPT_LENGTH) {
    throw new InputError('Enter context between 1 and 1,000 characters.');
  }
  return value.trim();
}
export function validateName(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 60) throw new InputError('Names must contain 1–60 characters.');
  return value.trim();
}
export function validateVote(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new InputError('Choose Funny or Not Funny.');
  return value;
}
export function validateId(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new InputError('Invalid caption ID.');
  return value;
}
export async function validateImage(file: FormDataEntryValue | null) {
  if (!(file instanceof File) || !file.size) throw new InputError('Choose an image first.');
  if (file.size > MAX_IMAGE_BYTES) throw new InputError('Images must be 3 MB or smaller.', 413);
  const bytes = Buffer.from(await file.arrayBuffer());
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  const mime = png ? 'image/png' : jpeg ? 'image/jpeg' : webp ? 'image/webp' : null;
  if (!mime || file.type !== mime) throw new InputError('Upload a valid JPEG, PNG, or WebP image. File contents must match its type.');
  return { bytes, mime, extension: png ? 'png' : jpeg ? 'jpg' : 'webp' };
}
// Bound the stream itself; Content-Length is optional and cannot be trusted.
export async function boundedBody(request: Request, maxBytes: number): Promise<Uint8Array> {
  if (Number(request.headers.get('content-length')) > maxBytes) throw new InputError('Upload is too large.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new InputError('Missing request body.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) { await reader.cancel(); throw new InputError('Upload is too large.', 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
export async function imageForm(request: Request): Promise<FormData> {
  if (!request.headers.get('content-type')?.startsWith('multipart/form-data')) throw new InputError('Use an image upload form.');
  const bytes = await boundedBody(request, MAX_IMAGE_BYTES + 64 * 1024);
  try { return await new Response(bytes as BodyInit, { headers: { 'content-type': request.headers.get('content-type')! } }).formData(); }
  catch { throw new InputError('The upload form could not be read.'); }
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) throw new InputError('Cross-origin requests are not allowed.', 403);
}
