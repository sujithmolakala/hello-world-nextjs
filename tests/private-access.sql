-- Disposable LOCAL PostgreSQL only, after applying the new migration locally.
-- No writes to application records. Never includes/reruns the old migration.
\set ON_ERROR_STOP on
begin;
select public.test_assert((select not public from storage.buckets where id='caption-images'),'caption bucket private');
select public.test_assert((select public from storage.buckets where id='avatars'),'avatars remain public');
select public.test_assert(not has_function_privilege('anon','public.caption_feed(text,integer,integer)','execute'),'anonymous feed execution revoked');
set role authenticated;
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
select public.test_assert((select count(*)>0 from public.caption_feed()),'existing captions preserved and member feed works');
select public.test_assert((select count(*)>0 from storage.objects where bucket_id='caption-images'),'members read existing caption objects');
set request.jwt.claim.sub='';
do $$ begin
  begin perform * from public.caption_feed(); raise exception 'FAIL: null-UID authenticated caller read feed'; exception when insufficient_privilege then null; end;
end $$;
set role anon;
select public.test_assert((select count(*)=0 from storage.objects where bucket_id='caption-images'),'legacy permissive read cannot bypass caption fence');
do $$ begin
  begin perform * from public.caption_feed(); raise exception 'FAIL: anonymous feed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS: private bucket, authenticated feed/image reads, null UID and anonymous rejection, preserved captions and avatars' as result;
rollback;
