-- Run AFTER database-fixture.sql + migration, only in the disposable local DB.
\set ON_ERROR_STOP on
create function public.test_assert(ok boolean,message text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'FAIL: %',message; end if; end $$;
select public.test_assert((select count(*)=0 from pg_tables where schemaname='public' and not rowsecurity),'all app tables enable RLS');
select public.test_assert(not exists(select 1 from pg_policies where policyname in ('legacy_profile_everything','legacy_movie_everything')),'old permissive app policies removed');
set role authenticated;
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
insert into storage.objects(bucket_id,name,owner_id) values ('caption-images','11111111-1111-4111-8111-111111111111/test.png','11111111-1111-4111-8111-111111111111');
insert into public.captions(creator_id,image_path,user_prompt,generation_prompt,caption,model) values ('11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111/test.png','user context','full generation prompt','Saved caption','image-model');
select public.test_assert((select count(*)=1 from public.captions where user_prompt='user context' and generation_prompt='full generation prompt' and model='image-model' and created_at is not null),'generation metadata persists');
select public.test_assert((select count(*)=2 from public.member_directory()),'directory exposes all members');
select public.test_assert((select count(*)=1 from public.profiles),'raw profiles owner-only');
select public.test_assert((select bool_and(not (to_jsonb(m) ? 'email') and not (to_jsonb(m) ? 'is_admin')) from public.member_directory() m),'directory omits private fields');
do $$ begin
  begin perform email from public.profiles; raise exception 'FAIL: private email readable'; exception when insufficient_privilege then null; end;
  begin update public.profiles set is_admin=true; raise exception 'FAIL: admin editable'; exception when insufficient_privilege then null; end;
  begin insert into storage.objects(bucket_id,name,owner_id) values('avatars','22222222-2222-4222-8222-222222222222/spoof.png','11111111-1111-4111-8111-111111111111'); raise exception 'FAIL: foreign storage upload allowed'; exception when insufficient_privilege then null; end;
  begin insert into public.captions(creator_id,image_path,user_prompt,generation_prompt,caption,model) values('22222222-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222/spoof.png','x','x','x','x'); raise exception 'FAIL: foreign generation allowed'; exception when insufficient_privilege then null; end;
end $$;
select public.cast_caption_vote((select id from public.captions limit 1),true);
select public.test_assert((select count(*)=1 from public.caption_votes),'first vote inserts');
select public.test_assert((select funny_count=1 and not_funny_count=0 and my_vote=true from public.caption_feed() limit 1),'accurate first totals and selection');
do $$ begin
  begin insert into public.caption_votes(user_id,caption_id,value) select auth.uid(),id,false from public.captions limit 1; raise exception 'FAIL: duplicate vote allowed'; exception when unique_violation then null; end;
  begin insert into public.caption_votes(user_id,caption_id,value) select '22222222-2222-4222-8222-222222222222',id,false from public.captions limit 1; raise exception 'FAIL: foreign vote allowed'; exception when insufficient_privilege then null; end;
end $$;
select public.cast_caption_vote((select id from public.captions limit 1),false);
select public.test_assert((select count(*)=1 from public.caption_votes),'vote changes do not add rows');
select public.test_assert((select funny_count=0 and not_funny_count=1 and my_vote=false from public.caption_feed() limit 1),'changed totals and selection');
set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
select public.test_assert((select count(*)=0 from public.caption_votes),'other vote identities hidden');
select public.cast_caption_vote((select id from public.caption_feed() limit 1),true);
select public.test_assert((select funny_count=1 and not_funny_count=1 and my_vote=true from public.caption_feed() limit 1),'community totals include both users');
update public.profiles set first_name='Own name' where id=auth.uid();
update public.profiles set first_name='Spoof' where id='11111111-1111-4111-8111-111111111111';
select public.test_assert((select first_name='Sam' from public.member_directory() where id='11111111-1111-4111-8111-111111111111'),'cannot edit another profile');
update public.caption_votes set value=false where user_id='11111111-1111-4111-8111-111111111111';
select public.test_assert((select funny_count=1 and not_funny_count=1 from public.caption_feed() limit 1),'cannot change another vote');
set role anon;
set request.jwt.claim.sub='';
select public.test_assert((select count(*)=1 from public.caption_feed()),'signed-out feed readable');
select public.test_assert((select my_vote is null from public.caption_feed() limit 1),'signed-out selection empty');
do $$ begin
  begin perform * from public.member_directory(); raise exception 'FAIL: anonymous directory'; exception when insufficient_privilege then null; end;
  begin perform public.cast_caption_vote((select id from public.caption_feed() limit 1),true); raise exception 'FAIL: anonymous vote'; exception when insufficient_privilege then null; end;
  begin insert into public.captions(creator_id,image_path,user_prompt,generation_prompt,caption,model) values('11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111/anon.png','x','x','x','x'); raise exception 'FAIL: anonymous generation'; exception when insufficient_privilege then null; end;
  begin insert into storage.objects(bucket_id,name,owner_id) values('avatars','11111111-1111-4111-8111-111111111111/anon.png','11111111-1111-4111-8111-111111111111'); raise exception 'FAIL: anonymous upload'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS: persistence, first INSERT, unique votes, vote changes, totals, directory privacy, ownership, signed-out restrictions, legacy policy fences' as result;
