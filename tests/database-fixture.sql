-- ONLY for a fresh, disposable local database. Never run this in Supabase.
create role anon;
create role authenticated;
create schema auth;
create schema storage;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth,storage to anon,authenticated;
grant execute on function auth.uid() to anon,authenticated;
create table public.profiles(id uuid primary key references auth.users(id),first_name text,last_name text,avatar_url text,email text,is_admin boolean default false);
create table public.movies(id bigint generated always as identity primary key,title text,year integer);
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,owner_id text);
create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name,'/') $$;
grant all on storage.objects to anon,authenticated;
grant all on public.profiles,public.movies to anon,authenticated;
grant update (email,is_admin) on public.profiles to authenticated;
create policy legacy_profile_everything on public.profiles for all to anon,authenticated using(true) with check(true);
create policy legacy_movie_everything on public.movies for all to anon,authenticated using(true) with check(true);
-- Generic old storage grants must not bypass the new managed-bucket fences.
create policy legacy_storage_everything on storage.objects for all to anon,authenticated using(true) with check(true);
insert into auth.users values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
insert into public.profiles(id,first_name,last_name,email) values ('11111111-1111-4111-8111-111111111111','Sam','Student','private-one@example.invalid'),('22222222-2222-4222-8222-222222222222','City','Explorer','private-two@example.invalid');
insert into public.movies(title,year) values ('Existing movie',2020);
