import { test } from 'node:test';
import assert from 'node:assert/strict';
const base = process.env.INTEGRATION_BASE_URL;
const live = { skip: !base, timeout: 60000 };

test('signed-out sign-in page is minimal and contains no app content', live, async () => {
  const response = await fetch(`${base}/sign-in`, { signal: AbortSignal.timeout(45000) });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.ok(html.includes('Mock Humor Study'));
  assert.ok(html.includes('Sign in with Google'));
  assert.ok(!html.includes('<nav') && !html.includes('<header') && !html.includes('<footer'));
  assert.ok(!html.includes('Daily prompt') && !html.includes('caption-card'));
});
test('every app page redirects signed-out visitors before rendering', live, async () => {
  for (const path of ['/', '/create', '/members', '/profile', '/movies', '/?sort=top', '/create?daily=1']) {
    const response = await fetch(`${base}${path}`, { redirect: 'manual', signal: AbortSignal.timeout(45000) });
    assert.equal(response.status, 307, `${path} must redirect before rendering`);
    assert.equal(new URL(response.headers.get('location'), base).pathname, '/sign-in');
    assert.ok(!(await response.text()).includes('<nav'));
  }
});
test('signed-out mutation APIs all return 401', live, async () => {
  for (const path of ['/api/captions', '/api/votes', '/api/profile']) {
    const response = await fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(45000) });
    assert.equal(response.status, 401, `${path} must authenticate before parsing or writing`);
  }
});
test('signed-out monthly snapshot, details and thumbnails return 401', live, async () => {
  for (const path of ['/api/decks', '/api/decks/items?ids=invalid', '/api/decks/thumbnail?id=invalid']) {
    const response = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(45000) });
    assert.equal(response.status, 401);
  }
});
test('after incremental migration hosted feed, directory and caption bucket reject anonymous reads', { ...live, skip: !base || process.env.CHECK_PRIVATE_MIGRATION !== '1' }, async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  assert.ok(url && key, 'Supabase configuration is required');
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  for (const name of ['caption_feed', 'member_directory']) {
    const response = await fetch(`${url}/rest/v1/rpc/${name}`, { method: 'POST', headers, body: '{}', signal: AbortSignal.timeout(20000) });
    assert.ok([401, 403].includes(response.status), `Anonymous ${name} must be denied`);
  }
  const bucket = await fetch(`${url}/storage/v1/object/list/caption-images`, { method: 'POST', headers, body: JSON.stringify({ prefix: '', limit: 1 }), signal: AbortSignal.timeout(20000) });
  // Storage may return an empty list rather than 403 when RLS hides all objects.
  if (bucket.ok) assert.deepEqual(await bucket.json(), []);
  else assert.ok([400, 401, 403, 404].includes(bucket.status));
  if (process.env.TEST_CAPTION_IMAGE_PATH) {
    const response = await fetch(`${url}/storage/v1/object/public/caption-images/${process.env.TEST_CAPTION_IMAGE_PATH}`, { signal: AbortSignal.timeout(20000) });
    assert.ok(!response.ok, 'Existing public caption-image URL must no longer work');
  }
});
