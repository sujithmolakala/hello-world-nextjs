import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validation, gemini } from './helpers/gemini.mjs';

test('prompt, name and vote validation rejects blank, oversized and forged input', () => {
  for (const value of ['', '   ', null, 'a'.repeat(1001)]) assert.throws(() => validation.validatePrompt(value));
  for (const value of ['', '   ', 3, 'a'.repeat(61)]) assert.throws(() => validation.validateName(value));
  for (const value of ['true', 1, null]) assert.throws(() => validation.validateVote(value));
  assert.equal(validation.validateVote(false), false);
  assert.equal(validation.validatePrompt('  dorm lore  '), 'dorm lore');
  assert.throws(() => validation.validateId('not-a-caption'));
});
test('image validation checks signatures, MIME and size, not file extensions', async () => {
  const png = Buffer.from([137,80,78,71,13,10,26,10,1]);
  assert.equal((await validation.validateImage(new File([png], 'photo.png', { type: 'image/png' }))).mime, 'image/png');
  await assert.rejects(validation.validateImage(new File(['not an image'], 'photo.png', { type: 'image/png' })));
  await assert.rejects(validation.validateImage(new File([png], 'photo.jpg', { type: 'image/jpeg' })));
  await assert.rejects(validation.validateImage(new File([new Uint8Array(validation.MAX_IMAGE_BYTES + 1)], 'big.png', { type: 'image/png' })));
});
test('body limiter bounds chunked requests even without Content-Length', async () => {
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(20)); controller.close(); } });
  await assert.rejects(validation.boundedBody(new Request('http://localhost', { method: 'POST', body: stream, duplex: 'half' }), 10), /too large/);
});
test('cross-origin mutations are rejected', () => {
  assert.throws(() => validation.sameOrigin(new Request('http://localhost/api/votes', { headers: { origin: 'https://evil.example' } })), /Cross-origin/);
});
test('Gemini receives the exact uploaded bytes and full prompt; no failure becomes a caption', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'unit-test-key-not-a-real-credential';
  const prompt = gemini.generationPrompt('Midwest kid in Manhattan');
  try {
    globalThis.fetch = async (_url, options) => {
      const body = JSON.parse(options.body);
      assert.equal(options.headers['x-goog-api-key'], process.env.GEMINI_API_KEY);
      assert.equal(body.contents[0].parts[0].text, prompt);
      assert.equal(body.contents[0].parts[1].inlineData.data, Buffer.from('image bytes').toString('base64'));
      assert.equal(body.contents[0].parts[1].inlineData.mimeType, 'image/png');
      return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'A test caption.' }] } }] });
    };
    assert.equal((await gemini.generateCaption(Buffer.from('image bytes'), 'image/png', prompt)).caption, 'A test caption.');
    globalThis.fetch = async () => new Response('', { status: 429 });
    await assert.rejects(gemini.generateCaption(Buffer.from('x'), 'image/png', prompt), /quota/);
    globalThis.fetch = async () => Response.json({ candidates: [{ finishReason: 'SAFETY' }] });
    await assert.rejects(gemini.generateCaption(Buffer.from('x'), 'image/png', prompt), /complete caption/);
    globalThis.fetch = async () => { throw new Error('network'); };
    await assert.rejects(gemini.generateCaption(Buffer.from('x'), 'image/png', prompt), /could not be reached/);
    delete process.env.GEMINI_API_KEY;
    await assert.rejects(gemini.generateCaption(Buffer.from('x'), 'image/png', prompt), /not configured/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = originalKey;
  }
});

test('caption prompt separates context from avoidance history and keeps references optional', () => {
  const prompt = gemini.generationPrompt('A bagel with no toppings.', ['Another Lit Hum exam joke.', 'Another Lit Hum exam joke.', 'The same subway punchline.']);
  assert.ok(prompt.includes('USER CONTEXT (subject matter for this image):'));
  assert.ok(prompt.includes('<user_context>\nA bagel with no toppings.\n</user_context>'));
  assert.ok(prompt.includes('AVOIDANCE ONLY (not examples to imitate, not image context)'));
  assert.equal(prompt.match(/Another Lit Hum exam joke\./g).length, 1);
  assert.ok(prompt.includes('Columbia and NYC references are welcome when they fit naturally, but are optional'));
  assert.ok(prompt.includes('Do not default to Lit Hum, exams, sleep deprivation, or deadlines for unrelated images'));
  assert.ok(!prompt.includes('Butler Library, dining halls, the Core'));
});
test('avoidance history is bounded so the full prompt fits the stored 5,000-character limit', () => {
  const recent = Array.from({ length: 20 }, (_, index) => `${index}` + '\\'.repeat(280));
  const prompt = gemini.generationPrompt('c'.repeat(1000), recent);
  assert.ok(prompt.length <= 5000);
  const section = prompt.split('<recent_captions_to_avoid>\n')[1].split('\n</recent_captions_to_avoid>')[0];
  assert.equal(section.split('\n').length, 5);
  assert.ok(gemini.generationPrompt('A plant').includes('(No recent captions available.)'));
});
