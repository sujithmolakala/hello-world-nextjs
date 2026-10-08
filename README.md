# Mock Humor Study

A private community app for Gemini image captions, voting, member profiles, and movies. Next.js 16.3.5, React 19.2.8, and Supabase. Google sign-in is required before any application page renders.

## Local setup

Use the existing `.env.local`, or copy `.env.example` and replace its placeholders:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (publishable/legacy anon key, never service-role)
- `GEMINI_API_KEY` (server-only)
- `GEMINI_MODEL=gemini-3.1-flash-lite`

That model was verified with the configured key using a real PNG-caption request. `node --env-file=.env.local scripts/verify-gemini.mjs` repeats model discovery and a small live image request before setting `GEMINI_MODEL`. It does not log credentials. Never commit `.env.local`.

```bash
npm install
npm run dev -- --webpack
```

Open `http://localhost:3000`. The webpack flag avoids the local Turbopack worker-port restriction. Keep the working Supabase Google provider settings and allow `http://localhost:3000/auth/callback` plus your production callback URL. OAuth still exchanges the PKCE code and redirects to `/` (Feed). Session cookies are refreshed in `src/proxy.ts`.

## Required NEW incremental migration

The Week 4 migration has already been applied to your hosted project. **Do not rerun or edit it to update that project.**

In Supabase SQL Editor, run the **entire exact contents** of:

[`supabase/migrations/202610080002_sign_in_first_private_captions.sql`](supabase/migrations/202610080002_sign_in_first_private_captions.sql)

Run this new migration once as the project owner. It has **not** been applied to hosted Supabase by the agent. It was tested only in an isolated local PostgreSQL database. It preserves captions, image objects, prompts, votes, profiles, and avatars.

It replaces `caption_feed()` with an explicitly authenticated function, revokes PUBLIC/anon execution, and grants execution to authenticated users. It makes `caption-images` private and replaces the old mixed image-read policy with public avatar reads and authenticated caption-image reads. A **restrictive** SELECT policy prevents generic older permissive storage policies from restoring anonymous caption-image access. Existing ownership rules for uploads, updates, and deletes remain intact. It does not attempt to ALTER Supabase-owned `storage.objects`.

Until you apply this migration, hosted `caption_feed()` and public caption-image URLs retain their previous anonymous access. The app's sign-in gate alone cannot change that database state.

Avatars currently use stored public `avatar_url` values, including existing external/avatar URLs. Their bucket and public read behavior are intentionally unchanged. Member names are available only in the protected directory; no emails or private profile fields are exposed.

The feed creates signed caption-image URLs **on the server after verified authentication**. URLs expire after five minutes and are renewed for the active slide. Browse all requests authenticated, resized WebP thumbnails rather than full-sized image URLs. Images use `next/image` with `unoptimized` so the public Next.js optimizer does not cache private images. Signed URLs are bearer links: anyone who receives a valid link can read it until expiry. Existing permanently public caption URLs stop working after the bucket becomes private. Already-downloaded/browser-cached images cannot be recalled.

## Authentication and data access

`/sign-in` contains only the app name, a short description, and Google sign-in. There is no app navigation or content there. Authenticated visitors to `/sign-in` redirect to Feed; sign-out returns to `/sign-in`.

Feed `/`, Create `/create`, Members `/members`, My Profile `/profile`, and Movies `/movies` live in a protected route group. The proxy verifies `auth.getUser()` before rendering, the group layout gates navigation, and every page independently verifies the user before reading data. Mutation handlers also independently verify authentication. Responses are `private, no-store`. Only the sign-in page, OAuth callback/error redirect, and framework assets bypass the gate.

- Feed uses `caption_feed()` for accurate aggregate counts and caller selection, sorted Newest or Top (Funny minus Not Funny).
- Members uses the narrow authenticated `member_directory()` function.
- Profile SELECTs only `first_name,last_name,avatar_url`; updates return only `id` and are owner-scoped.
- Caption generation sends the uploaded image bytes and full prompt to Gemini on the server; failures never become fake captions. It preserves stored context, full prompt, creator, model, timestamp, and image reference.
- The original unique `(user_id,caption_id)` constraint and atomic first-INSERT/subsequent-update vote function are unchanged.
- Server validation still bounds upload streams and checks 3 MiB limits, JPEG/PNG/WebP signatures and MIME, 1,000-character context, and 60-character names.

## Checks

```bash
npm run lint
npm test
npm run build -- --webpack
INTEGRATION_BASE_URL=http://127.0.0.1:3000 node --env-file=.env.local --test tests/integration.test.mjs
```

The default test run is offline: validation, Gemini payload/prompt, timezone boundaries, whole-month navigation, completion, pagination, and gesture tests. Local HTTP tests are opt-in and verify the minimal sign-in page, pre-render redirects for all five protected pages, and 401 responses to signed-out mutations.

**After applying the new migration manually**, enable the additional hosted read-only integration test:

```bash
CHECK_PRIVATE_MIGRATION=1 INTEGRATION_BASE_URL=http://127.0.0.1:3000 \
  node --env-file=.env.local --test tests/integration.test.mjs
```

Optionally set `TEST_CAPTION_IMAGE_PATH` to an existing `creator-uuid/file.png` storage path to verify its old public URL no longer works. No hosted integration test writes application records or applies migrations.

`tests/private-access.sql` verifies the new private-access rules against the existing disposable local PostgreSQL fixture, including a generic permissive legacy storage policy. Do not run `tests/database-fixture.sql` in your hosted project. The original `tests/database-security.sql` tests the baseline Week 4 migration before this increment, so its anonymous-feed expectation no longer applies after the new migration.

## Browser acceptance checklist

1. In a signed-out/incognito window, open `/`, `/create`, `/members`, `/profile`, and `/movies`. Each must redirect to `/sign-in`; no captions, navigation, prompts, names, or avatars should appear. Sign-in itself should show only the name, description, and one button.
2. Sign in with Google. You should land on Feed. Visit `/sign-in` while signed in and confirm it redirects back to Feed.
3. After applying the new migration, confirm existing caption images still load. Create a caption from a real image/context and reload Feed to verify persistence and image access.
4. Vote Funny, switch to Not Funny, and refresh. Confirm totals and your selection persist with only one vote row. Open monthly decks and Browse all; confirm the selected slide remains stable after voting.
5. Check Members for names/avatars without emails. Edit your own names and upload an avatar in My Profile; refresh both pages. Confirm Movies still loads.
6. Sign out. Confirm you return to the minimal sign-in page and protected pages/API requests are denied. After five minutes, a copied old signed caption-image URL should expire; the old permanent public URL must already be inaccessible.
7. Check the forms, navigation, image preview, vote selection, and member list at narrow/mobile widths and using keyboard navigation.

Hosted SQL migrations must be applied manually; the implementation scripts do not apply them.

## Caption variety

The production prompt prioritizes a distinctive image detail and the supplied context. Columbia/NYC references are optional, and academic themes are only appropriate when the actual scene/context warrants them. There are no fixed positive examples or mandatory campus-reference lists.

Before generation, the authenticated server reads up to five recent community captions through `caption_feed()`. Only caption text is passed as a clearly separated avoidance list, not as context or examples to imitate. Samples are deduplicated and capped at 200 characters each so the full prompt remains within the database limit. The optional lookup times out after three seconds; failure omits history rather than preventing a real Gemini request. The original user context and complete assembled generation prompt, including its actual avoidance sample, are still saved separately.

To run the live variety probe:

```bash
node --env-file=.env.local scripts/test-caption-variety.mjs
```

It submits five distinct synthetic PNG scenes (taxi, bagel, plant, inverted umbrella, and books) with corresponding contexts to the real configured Gemini model using the production prompt. Test-only repetitive negative examples and preceding test outputs exercise the avoidance section. The books case explicitly asks for Lit Hum context to check that appropriate academic references remain allowed. It does not upload fixtures, write Supabase records, or log the API key. Results print caption text, model, length, and an unrelated-academic-theme flag. This small qualitative probe cannot guarantee diversity on every future generation.

## Monthly caption decks — required new migration

After migration `202610080002_sign_in_first_private_captions.sql` has been applied, open Supabase **SQL Editor**, paste the **entire contents** of [`supabase/migrations/202610080003_monthly_caption_decks.sql`](supabase/migrations/202610080003_monthly_caption_decks.sql), and run it once as the project owner. This is the exact new SQL to run. Do not rerun either older migration. No hosted SQL was applied by the agent, and no environment variables are added for decks.

The migration adds an index and three authenticated functions: `caption_deck_snapshot`, `caption_deck_items`, and `caption_deck_vote`. The snapshot groups existing timestamps in America/New_York, includes every caption ID and the caller’s vote state in the selected month, and reports global month counts plus a newest-caption cursor. Returning one JSON object avoids PostgREST’s usual row limit; the small manifest includes no images, prompts or other voter identities. Details are fetched in bounded ID batches. The vote function delegates to the existing RLS-backed INSERT/UPDATE function and returns saved selection and totals in the same transaction. Tables, existing captions, votes, avatars, and storage policies are preserved.

The Feed defaults to the newest populated month. Browse all loads 24 thumbnail entries per page; filtering and Next unvoted operate over the complete month manifest. Active images remain uncropped and use short-lived signed URLs. Thumbnails are resized on the authenticated server with sharp, use private cache headers, and do not enter the public Next image optimizer.

Visible tabs poll every 20 seconds. Newly inserted captions update counts but preserve the active caption ID. View latest explicitly opens the newest caption, switching months when needed. Database ordering uses `(created_at DESC, id DESC)` to break timestamp ties. Completion is announced only after a successful vote changes a missing selection into the final rated selection; Not Funny counts as rated. Keyboard navigation operates when focus is inside the deck, and touch/trackpad handlers exclude vertical scroll, multitouch, pinch wheel modifiers and typing. Trackpad momentum must stop for 350 ms before another slide is allowed.

`tests/monthly-decks.sql` is for the disposable local fixture only. It inserts a 1,206-caption month, checks false-vote counts, New York boundaries, first vote/change and anonymous denial, then rolls back every test record. **Do not run database fixture/tests in hosted Supabase.**

### Monthly deck browser checks

At `http://localhost:3000`, after applying migration 003 and signing in:

1. Select different populated months. Check newest-first slides, month totals, and your voted totals, including a month with more than 24 captions.
2. Vote Not Funny, switch to Funny, and reload. Check selection/totals persist and voting or clicking the image leaves you on the same caption.
3. Use Previous/Next, then Next unvoted near the end. Confirm it wraps and skips both Funny and Not Funny votes. Rate the last missing caption: All captions rated stays visible, Next unvoted is shaded/disabled, and changing a vote does not announce completion again.
4. Expand Browse all, check All/Unvoted counts, navigate thumbnail pages, and open a specific thumbnail. The exact slide should open and highlight.
5. Focus/click the deck image and try arrow keys. Try horizontal touch and trackpad swipes: one swipe should move at most one slide, while vertical scroll and pinch zoom still work. Check mobile widths and keyboard focus.
6. Leave one browser window on an older slide; create a caption in another. Within about 20 seconds, counts and the new-caption banner should update without changing the selected caption. View latest should open the new caption, including across a new month. A completed month receiving another caption must allow Next unvoted again.
7. Signed out, all app pages should redirect and all monthly APIs should return 401. Existing profiles, members, Google sign-in, avatar uploads and Gemini generation should still work.

The automated headless component checks use isolated fixture responses, not a real signed-in Supabase session. Real OAuth, private hosted image access, saved hosted votes, cross-tab polling and physical-device gestures still need the browser checks above after the migration is applied.
