alter table entries add column media_type text not null default 'document' check(media_type in ('document','video'));
update entries set media_type='video' where kind='reel';
alter table classrooms drop constraint classrooms_grade_check;
alter table classrooms add constraint classrooms_grade_check check(grade in ('Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Form 1','Form 2','Form 3','Form 4','Form 5','Form 6','Level 14','Level 15','Level 16','Level 17','Level 18','Level 19','Level 20'));
create or replace function validate_resource_grade() returns trigger language plpgsql set search_path=public as $$ begin
 if new.kind in ('book','course','reel') and not exists(select 1 from education_levels where label=new.level or canonical_grade(ordinal)=new.level) then raise exception 'Choose an exact resource grade'; end if;
 return new;
end $$;
create table pronunciation_audio(id uuid primary key default gen_random_uuid(),language_code text not null,phrase text not null,path text not null,speaker text not null,permission_record text not null check(length(trim(permission_record))>=10),consent_confirmed boolean not null check(consent_confirmed),active boolean not null default true,unique(language_code,phrase));
alter table pronunciation_audio enable row level security;
create policy pronunciation_read on pronunciation_audio for select using(active or is_admin());
create policy pronunciation_admin on pronunciation_audio for all to authenticated using(is_admin()) with check(is_admin());
revoke all on pronunciation_audio from anon,authenticated;
grant select(id,language_code,phrase,path,speaker,active) on pronunciation_audio to authenticated;
grant insert,update,delete on pronunciation_audio to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('pronunciation','pronunciation',false,10485760,array['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/mp4']);
create policy pronunciation_upload on storage.objects for insert to authenticated with check(bucket_id='pronunciation' and is_admin());
create policy pronunciation_files on storage.objects for select to authenticated using(bucket_id='pronunciation' and is_active() and exists(select 1 from pronunciation_audio where path=name and active));
