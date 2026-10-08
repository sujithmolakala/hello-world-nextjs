-- Read-only inventory. Run before migration and keep results for your assignment.
select table_name,column_name,data_type,is_nullable,column_default
from information_schema.columns where table_schema='public' order by table_name,ordinal_position;
select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies where schemaname in ('public','storage') order by schemaname,tablename,policyname;
select id,public,file_size_limit,allowed_mime_types from storage.buckets;
select schemaname,tablename,rowsecurity from pg_tables where schemaname='public';
-- Review existing exposed views/functions too: table RLS alone does not protect
-- a legacy SECURITY DEFINER function/view owned by a privileged database role.
select routine_name,security_type from information_schema.routines where routine_schema='public';
select table_name,view_definition from information_schema.views where table_schema='public';
