// Run: node --env-file=.env.local scripts/verify-gemini.mjs
// Lists models and makes one small image-input request before updating GEMINI_MODEL.
// Credentials are sent only in headers, never logged or embedded in request URLs.
import { readFile, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
const key = process.env.GEMINI_API_KEY;
if (!key) { console.error('GEMINI_API_KEY is not configured.'); process.exit(1); }
const headers = { 'x-goog-api-key': key, 'Content-Type': 'application/json' };
function chunk(type, data) {
  const name = Buffer.from(type);
  const payload = Buffer.concat([name, data]);
  let crc = 0xffffffff;
  for (const byte of payload) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, payload, checksum]);
}
function testImage() {
  const size = 256;
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  const rows = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const offset = y * (size * 3 + 1) + 1 + x * 3;
    Buffer.from([75, 145, 210]).copy(rows, offset);
  }
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
}
try {
  let pageToken;
  const models = [];
  do {
    const url = new URL('https://generativelanguage.googleapis.com/v1beta/models');
    url.searchParams.set('pageSize', '100');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`Model listing HTTP ${response.status}`);
    const page = await response.json(); models.push(...(page.models || [])); pageToken = page.nextPageToken;
  } while (pageToken);
  const textModels = models.filter(model => model.supportedGenerationMethods?.includes('generateContent')).map(model => model.name.replace(/^models\//, ''));
  console.log('Models advertising generateContent:', textModels.join(', '));
  // Only choose a known text-output multimodal family if the API actually lists it.
  const candidates = ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-2.5-flash'].filter(name => textModels.includes(name));
  if (!candidates.length) throw new Error('No supported caption-model candidate was listed. GEMINI_MODEL was not changed.');
  let model;
  for (const candidateModel of candidates) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${candidateModel}:generateContent`, {
    method: 'POST', headers, signal: AbortSignal.timeout(45000),
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Inspect the attached image. Write one humorous Columbia student caption of at most 280 characters referring to its visible color. Return only the caption.' }, { inlineData: { mimeType: 'image/png', data: testImage().toString('base64') } }] }], generationConfig: { maxOutputTokens: 2048, temperature: 0.7 } }),
  });
  if (!response.ok) { console.log(`${candidateModel}: image-input generation HTTP ${response.status}`); continue; }
  const data = await response.json();
  const candidate = data.candidates?.[0];
  const caption = candidate?.content?.parts?.filter(part => !part.thought).map(part => part.text || '').join('').trim();
  if (candidate?.finishReason !== 'STOP' || !caption || caption.length > 280) { console.log(`${candidateModel}: no complete short caption returned`); continue; }
  model = candidateModel; break;
  }
  if (!model) throw new Error('No complete short image caption returned from any listed candidate. GEMINI_MODEL was not changed.');
  const path = new URL('../.env.local', import.meta.url);
  const env = await readFile(path, 'utf8');
  const line = `GEMINI_MODEL=${model}`;
  const matches = /^\s*(?:export\s+)?GEMINI_MODEL\s*=.*$/gm;
  const next = matches.test(env) ? env.replace(matches, line) : `${env}${env.endsWith('\n') ? '' : '\n'}${line}\n`;
  await writeFile(path, next);
  console.log(`Verified real PNG image input and short caption output. Set GEMINI_MODEL=${model} in .env.local.`);
} catch (error) {
  // Never print request/response objects or arbitrary provider error payloads.
  const safe = error instanceof Error && /^(Model listing HTTP|Image-input generation HTTP|No supported caption|No complete short)/.test(error.message);
  console.error(safe ? error.message : 'Verification failed due to network, timeout, or local-file error. Credentials were not logged.');
  process.exitCode = 1;
}
