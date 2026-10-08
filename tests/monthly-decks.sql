-- LOCAL disposable database only; rolls back every fixture and vote.
begin;
insert into public.captions(id,creator_id,image_path,user_prompt,generation_prompt,caption,model,created_at)
select md5('monthly-deck-'||i)::uuid,'11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111/deck-test-'||i||'.png','test','test','caption '||i,'test','2031-10-15 12:00:00+00'::timestamptz + i*interval '1 second' from generate_series(1,1205) i;
insert into public.caption_votes(caption_id,user_id,value)
select md5('monthly-deck-'||i)::uuid,'11111111-1111-4111-8111-111111111111',false from generate_series(1,1204) i;
insert into public.captions(id,creator_id,image_path,user_prompt,generation_prompt,caption,model,created_at) values
(md5('boundary-before')::uuid,'11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111/before.png','test','test','boundary','test','2031-11-01 03:59:59+00'),
(md5('boundary-after')::uuid,'11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111/after.png','test','test','boundary','test','2031-11-01 04:00:00+00');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set local role authenticated;
select public.test_assert(jsonb_array_length(public.caption_deck_snapshot('2031-10')->'slides')=1206,'manifest exceeds 1000 rows without truncation');
select public.test_assert((public.caption_deck_snapshot('2031-10')->'months'->1->>'voted')::int=1204,'false votes counted');
select public.test_assert(jsonb_array_length(public.caption_deck_snapshot('2031-11')->'slides')=1,'NY midnight boundary');
select public.test_assert((public.caption_deck_snapshot('2031-10','2031-11-01 03:59:59+00',md5('boundary-before')::uuid)->>'new_count')::int=1,'global new caption count');
select public.test_assert((public.caption_deck_vote(md5('monthly-deck-1205')::uuid,false)->>'my_vote')::boolean=false,'saved Not Funny');
select public.test_assert((public.caption_deck_vote(md5('monthly-deck-1205')::uuid,true)->>'funny_count')::int=1,'vote changes authoritative totals');
select public.test_assert((select count(*) from public.caption_votes where caption_id=md5('monthly-deck-1205')::uuid)=1,'one vote row after change');
do $$ begin
  insert into public.caption_votes(caption_id,user_id,value) values (md5('monthly-deck-1205')::uuid,auth.uid(),false);
  raise exception 'Expected duplicate vote constraint';
exception when unique_violation then null;
end $$;
reset role;
select public.test_assert(not has_function_privilege('anon','public.caption_deck_snapshot(text,timestamptz,uuid)','execute'),'anonymous snapshot denied');
select public.test_assert(not has_function_privilege('anon','public.caption_deck_items(uuid[])','execute'),'anonymous detail denied');
select public.test_assert(not has_function_privilege('anon','public.caption_deck_vote(uuid,boolean)','execute'),'anonymous vote denied');
select set_config('request.jwt.claim.sub','',true);
set local role authenticated;
do $$ begin
  perform public.caption_deck_snapshot();
  raise exception 'Expected null identity denial';
exception when insufficient_privilege then null;
end $$;
rollback;
