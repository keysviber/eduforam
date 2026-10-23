-- International identities, reviewed staff applications and private communication.
create table education_systems(code text primary key,name text not null unique);
create table education_levels(system_code text references education_systems, label text, ordinal integer not null check(ordinal between 1 and 20),primary key(system_code,label));
insert into education_systems values('ZW','Zimbabwe'),('GB','United Kingdom'),('ZA','South Africa'),('US','United States'),('NG','Nigeria'),('KE','Kenya'),('OTHER','Other / international');
insert into education_levels select 'ZW',case when n<=7 then 'Grade '||n else 'Form '||(n-7) end,n from generate_series(1,13)n;
insert into education_levels values('ZW','Lower 6',12),('ZW','Upper 6',13);
insert into education_levels select 'GB','Year '||n,n from generate_series(1,13)n;
insert into education_levels select c,'Grade '||n,n from unnest(array['ZA','US','KE'])c cross join generate_series(1,12)n;
insert into education_levels select 'NG',case when n<=6 then 'Primary '||n when n<=9 then 'JSS '||(n-6) else 'SSS '||(n-9) end,n from generate_series(1,12)n;
insert into education_levels select 'OTHER','Level '||n,n from generate_series(1,20)n;
alter table education_systems enable row level security; alter table education_levels enable row level security;
create policy systems_read on education_systems for select using(true);
create policy levels_read on education_levels for select using(true);
create policy systems_admin on education_systems for all to authenticated using(is_admin()) with check(is_admin());
create policy levels_admin on education_levels for all to authenticated using(is_admin()) with check(is_admin());
grant select on education_systems,education_levels to anon,authenticated;
grant insert,update,delete on education_systems,education_levels to authenticated;
alter table profiles add column username text, add column avatar_path text, add column education_system text references education_systems, add column education_level text, add column education_ordinal integer, add column safe_responder boolean not null default false;
update profiles set username='learner_'||replace(id::text,'-',''),education_ordinal=case when grade like 'Grade %' then substring(grade from 7)::int when grade like 'Form %' then 7+substring(grade from 6)::int end;
alter table profiles alter column username set not null;
alter table profiles add constraint username_format check(username ~ '^[a-z0-9_]{3,40}$');
create unique index profiles_username_unique on profiles(lower(username));
create function canonical_grade(n integer) returns text language sql immutable as $$ select case when n between 1 and 7 then 'Grade '||n when n between 8 and 13 then 'Form '||(n-7) end $$;
create function profile_identity_defaults() returns trigger language plpgsql set search_path=public as $$ begin
 if new.username is null then new.username:='learner_'||replace(new.id::text,'-',''); end if;
 return new;
end $$;
create trigger profile_identity_defaults before insert on profiles for each row execute function profile_identity_defaults();
create or replace function create_profile() returns trigger language plpgsql security definer set search_path=public as $$ declare chosen text; ordinal integer; sys text; level_label text; begin
 chosen:=lower(trim(new.raw_user_meta_data->>'username'));
 if chosen is null or chosen='' then chosen:='learner_'||replace(new.id::text,'-',''); end if;
 sys:=new.raw_user_meta_data->>'education_system';level_label:=new.raw_user_meta_data->>'education_level';
 select l.ordinal into ordinal from education_levels l where l.system_code=sys and l.label=level_label;
 if ordinal is null then select case when new.raw_user_meta_data->>'grade' like 'Grade _' then substring(new.raw_user_meta_data->>'grade' from 7)::int when new.raw_user_meta_data->>'grade' like 'Form _' then 7+substring(new.raw_user_meta_data->>'grade' from 6)::int end into ordinal; sys:=null;level_label:=null; end if;
 insert into profiles(id,username,grade,education_system,education_level,education_ordinal,first_name,surname,date_of_birth,country,account_type,display_name)
 values(new.id,chosen,canonical_grade(ordinal),sys,level_label,ordinal,coalesce(new.raw_user_meta_data->>'first_name',''),coalesce(new.raw_user_meta_data->>'surname',''),nullif(new.raw_user_meta_data->>'date_of_birth','')::date,coalesce(new.raw_user_meta_data->>'country',''),case when new.raw_user_meta_data->>'account_type'='teacher' then 'teacher' else 'student' end,coalesce(new.raw_user_meta_data->>'first_name','Learner'));
 return new;
end $$;
create function set_my_education(system text,level_label text) returns void language plpgsql security definer set search_path=public as $$ declare n integer; country_name text; begin
 if not is_active() then raise exception 'Active account required'; end if;
 select l.ordinal,s.name into n,country_name from education_levels l join education_systems s on s.code=l.system_code where l.system_code=system and l.label=level_label;
 if n is null then raise exception 'Choose a supported country and education level'; end if;
 update profiles set country=country_name,education_system=system,education_level=level_label,education_ordinal=n,grade=canonical_grade(n) where id=auth.uid();
end $$;
create or replace function set_my_grade(new_grade text) returns void language plpgsql security definer set search_path=public as $$ declare n integer; begin
 if not is_active() then raise exception 'Active account required'; end if;
 select ordinal into n from education_levels where system_code='ZW' and label=new_grade;
 if n is null then raise exception 'Choose your education level'; end if;
 update profiles set grade=new_grade,education_ordinal=n where id=auth.uid();
end $$;
create function set_my_identity(handle text,photo text) returns void language plpgsql security definer set search_path=public as $$ begin
 if not is_active() then raise exception 'Active account required'; end if;
 if handle is null or lower(trim(handle)) !~ '^[a-z0-9_]{3,40}$' then raise exception 'Use 3-40 letters, numbers or underscores for your username'; end if;
 if photo is not null and photo not like auth.uid()::text||'/%' then raise exception 'Use your own profile picture'; end if;
 update profiles set username=lower(trim(handle)),avatar_path=photo where id=auth.uid();
end $$;
create function find_people(term text default '') returns table(id uuid,username text,display_name text,avatar_path text,bio text,role user_role) language sql stable security definer set search_path=public as $$
 select p.id,p.username,p.display_name,p.avatar_path,p.bio,p.role from profiles p where is_active() and not p.suspended and (term='' or p.username ilike '%'||left(term,40)||'%' or p.display_name ilike '%'||left(term,40)||'%') order by p.username limit 50
$$;
create function public_people(ids uuid[]) returns table(id uuid,username text,display_name text,avatar_path text) language sql stable security definer set search_path=public as $$ select p.id,p.username,p.display_name,p.avatar_path from profiles p where is_active() and not p.suspended and p.id=any(ids[1:100]) $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('avatars','avatars',false,5242880,array['image/jpeg','image/png','image/webp']),('verification','verification',false,52428800,array['image/jpeg','image/png','application/pdf','video/mp4','video/quicktime']);
create policy avatar_upload on storage.objects for insert to authenticated with check(bucket_id='avatars' and is_active() and (storage.foldername(name))[1]=auth.uid()::text);
create policy avatar_read on storage.objects for select to authenticated using(bucket_id='avatars' and is_active() and ((storage.foldername(name))[1]=auth.uid()::text or exists(select 1 from profiles where avatar_path=name and not suspended)));
-- SECURITY DEFINER avoids exposing full profile rows to avatar readers.
create function visible_avatar(path text) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from profiles where avatar_path=path and not suspended) $$;
drop policy avatar_read on storage.objects;
create policy avatar_read on storage.objects for select to authenticated using(bucket_id='avatars' and is_active() and ((storage.foldername(name))[1]=auth.uid()::text or visible_avatar(name)));
create policy proof_upload on storage.objects for insert to authenticated with check(bucket_id='verification' and is_active() and (storage.foldername(name))[1]=auth.uid()::text);
create policy proof_read on storage.objects for select to authenticated using(bucket_id='verification' and is_active() and ((storage.foldername(name))[1]=auth.uid()::text or is_admin()));
create table staff_applications(id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles on delete cascade,kind text not null check(kind in ('teacher','safe_responder')),subject text not null,statement text not null check(length(trim(statement)) between 20 and 4000),id_path text,video_path text not null,status text not null default 'pending' check(status in ('pending','approved','rejected')),reason text not null default '',reviewed_by uuid references profiles,created_at timestamptz not null default now(),check(kind<>'teacher' or id_path is not null));
create unique index staff_pending on staff_applications(user_id,kind) where status='pending';
alter table staff_applications enable row level security;
create policy staff_read on staff_applications for select to authenticated using(is_active() and (user_id=auth.uid() or is_admin()));
create policy staff_apply on staff_applications for insert to authenticated with check(is_active() and user_id=auth.uid() and status='pending' and reason='' and reviewed_by is null and video_path like auth.uid()::text||'/%' and (id_path is null or id_path like auth.uid()::text||'/%'));
grant select,insert on staff_applications to authenticated;
create function review_staff(application uuid,approve boolean,reason text) returns void language plpgsql security definer set search_path=public as $$ declare a staff_applications; begin
 if not is_admin() then raise exception 'Administrator permission required'; end if;
 if approve is null or reason is null or length(trim(reason))<5 then raise exception 'Explain the verification decision'; end if;
 select * into a from staff_applications where id=application and status='pending' for update;
 if not found then raise exception 'Pending application not found'; end if;
 if a.user_id=auth.uid() then raise exception 'Another administrator must review your application'; end if;
 update staff_applications set status=case when approve then 'approved' else 'rejected' end,reason=trim(review_staff.reason),reviewed_by=auth.uid() where id=a.id;
 if approve and a.kind='teacher' then update profiles set role='teacher',account_type='teacher' where id=a.user_id and role not in ('admin','owner'); end if;
 if approve and a.kind='safe_responder' then update profiles set safe_responder=true where id=a.user_id; end if;
 insert into notifications(user_id,message) values(a.user_id,'Your verification application has been reviewed. Open Settings.');
 insert into audit_log(actor_id,entity_id,action,reason) values(auth.uid(),a.id,'verification.'||case when approve then 'approved' else 'rejected' end,trim(review_staff.reason));
end $$;
create function can_teach() returns boolean language sql stable security definer set search_path=public as $$ select is_admin() or exists(select 1 from profiles where id=auth.uid() and role='teacher' and not suspended) $$;
drop policy rooms_create on classrooms;
create policy rooms_create on classrooms for insert to authenticated with check(owner_id=auth.uid() and can_teach());
create function classroom_roster(room uuid) returns table(user_id uuid,username text,display_name text) language plpgsql stable security definer set search_path=public as $$ begin
 if not is_active() or not(is_admin() or exists(select 1 from classrooms where id=room and owner_id=auth.uid())) then raise exception 'Classroom owner permission required'; end if;
 return query select p.id,p.username,p.display_name from classroom_members m join profiles p on p.id=m.user_id where m.classroom_id=room order by p.username;
end $$;
create function can_reply_support() returns boolean language sql stable security definer set search_path=public as $$ select is_admin() or exists(select 1 from profiles where id=auth.uid() and safe_responder and not suspended) $$;
drop policy support_read on support_requests;
create policy support_read on support_requests for select to authenticated using(is_active() and (user_id=auth.uid() or can_reply_support()));
create or replace function respond_to_support(request_id uuid,reply text,new_status text) returns void language plpgsql security definer set search_path=public as $$ begin
 if not can_reply_support() then raise exception 'Approved Safe Room responder permission required'; end if;
 if reply is null or length(trim(reply)) not between 1 and 4000 or new_status not in ('answered','closed') then raise exception 'Add a response and valid status'; end if;
 update support_requests set response=trim(reply),status=new_status where id=request_id;
 if not found then raise exception 'Request not found'; end if;
 insert into audit_log(actor_id,entity_id,action,reason) values(auth.uid(),request_id,'support.'||new_status,'Private support response recorded');
end $$;
create or replace function publish_talent() returns trigger language plpgsql security definer set search_path=public as $$ begin
 if auth.uid() is not null then select coalesce(nullif(display_name,''),username) into new.author from profiles where id=auth.uid(); end if;
 if (new.kind='reel' and new.video_format='talent') or can_teach() then new.status:='approved'; end if;
 return new;
end $$;
drop policy entries_submit on entries;
create policy entries_submit on entries for insert to authenticated with check(owner_id=auth.uid() and is_active() and (status='pending' or (status='approved' and (can_teach() or (kind='reel' and video_format='talent')))) and target=0 and raised=0 and (file_path is null or file_path like auth.uid()::text||'/%'));
create table user_blocks(user_id uuid references profiles on delete cascade,blocked_id uuid references profiles on delete cascade,primary key(user_id,blocked_id),check(user_id<>blocked_id));
alter table user_blocks enable row level security;
create policy blocks_own on user_blocks for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid() and is_active());
grant select,insert,delete on user_blocks to authenticated;
create function can_message(other uuid) returns boolean language sql stable security definer set search_path=public as $$ select is_active() and other<>auth.uid() and exists(select 1 from profiles where id=other and not suspended) and not exists(select 1 from user_blocks where (user_id=auth.uid() and blocked_id=other) or (user_id=other and blocked_id=auth.uid())) $$;
create table direct_messages(id uuid primary key default gen_random_uuid(),sender_id uuid not null references profiles on delete cascade,recipient_id uuid not null references profiles on delete cascade,body text not null check(length(trim(body)) between 1 and 2000),created_at timestamptz not null default now(),read_at timestamptz);
create index dm_inbox on direct_messages(recipient_id,created_at desc); create index dm_sent on direct_messages(sender_id,created_at desc);
alter table direct_messages enable row level security;
create policy dm_read on direct_messages for select to authenticated using(is_active() and auth.uid() in (sender_id,recipient_id));
create policy dm_send on direct_messages for insert to authenticated with check(sender_id=auth.uid() and can_message(recipient_id) and read_at is null);
create policy dm_mark on direct_messages for update to authenticated using(is_active() and recipient_id=auth.uid()) with check(recipient_id=auth.uid());
grant select,insert on direct_messages to authenticated; grant update(read_at) on direct_messages to authenticated;
create table language_messages(id uuid primary key default gen_random_uuid(),language_id uuid not null references languages on delete cascade,user_id uuid not null references profiles on delete cascade,body text not null check(length(trim(body)) between 1 and 2000),created_at timestamptz not null default now());
create index language_board_time on language_messages(language_id,created_at desc);
alter table language_messages enable row level security;
create policy language_chat_read on language_messages for select to authenticated using(is_active());
create policy language_chat_add on language_messages for insert to authenticated with check(is_active() and user_id=auth.uid());
create policy language_chat_remove on language_messages for delete to authenticated using(user_id=auth.uid() or can_moderate());
grant select,insert,delete on language_messages to authenticated;
create function message_limits() returns trigger language plpgsql security definer set search_path=public as $$ declare count_recent integer; begin
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,8));
 if tg_table_name='direct_messages' then select count(*) into count_recent from direct_messages where sender_id=auth.uid() and created_at>now()-interval '1 minute';
 else select count(*) into count_recent from language_messages where user_id=auth.uid() and created_at>now()-interval '1 minute'; end if;
 if count_recent>=20 then raise exception 'Please wait before sending more messages'; end if;
 new.created_at:=clock_timestamp(); return new;
end $$;
create trigger dm_limits before insert on direct_messages for each row execute function message_limits();
create trigger board_limits before insert on language_messages for each row execute function message_limits();
create table chat_reports(id uuid primary key default gen_random_uuid(),reporter_id uuid not null references profiles on delete cascade,direct_message uuid references direct_messages on delete cascade,language_message uuid references language_messages on delete cascade,reason text not null check(length(trim(reason)) between 5 and 1000),resolved boolean not null default false,created_at timestamptz default now(),check(num_nonnulls(direct_message,language_message)=1));
alter table chat_reports enable row level security;
create policy chat_report_add on chat_reports for insert to authenticated with check(is_active() and reporter_id=auth.uid() and not resolved and ((direct_message is not null and exists(select 1 from direct_messages where id=direct_message)) or (language_message is not null and exists(select 1 from language_messages where id=language_message))));
create policy chat_report_read on chat_reports for select to authenticated using(reporter_id=auth.uid() or can_moderate());
create policy chat_report_resolve on chat_reports for update to authenticated using(can_moderate()) with check(can_moderate());
grant select,insert on chat_reports to authenticated; grant update(resolved) on chat_reports to authenticated;
create function reported_messages() returns table(report_id uuid,reason text,body text,sender_id uuid,resolved boolean) language sql stable security definer set search_path=public as $$ select r.id,r.reason,coalesce(d.body,l.body),coalesce(d.sender_id,l.user_id),r.resolved from chat_reports r left join direct_messages d on d.id=r.direct_message left join language_messages l on l.id=r.language_message where can_moderate() order by r.created_at desc limit 100 $$;
revoke all on function canonical_grade(integer),set_my_education(text,text),set_my_identity(text,text),find_people(text),public_people(uuid[]),visible_avatar(text),review_staff(uuid,boolean,text),can_teach(),classroom_roster(uuid),can_reply_support(),can_message(uuid),reported_messages() from public,anon;
grant execute on function set_my_education(text,text),set_my_identity(text,text),find_people(text),public_people(uuid[]),visible_avatar(text),review_staff(uuid,boolean,text),can_teach(),classroom_roster(uuid),can_reply_support(),can_message(uuid),reported_messages() to authenticated;
grant execute on function canonical_grade(integer) to authenticated;
-- Override hosted default grants: recipients can only mark a message read.
revoke all on direct_messages,chat_reports from anon,authenticated;
grant select,insert on direct_messages,chat_reports to authenticated;
grant update(read_at) on direct_messages to authenticated;
grant update(resolved) on chat_reports to authenticated;
create or replace function set_educator_role(target_user uuid,new_role user_role,reason text) returns void language plpgsql security definer set search_path=public as $$ begin
 if not is_admin() then raise exception 'Administrator permission required'; end if;
 if new_role is null or new_role not in ('student','teacher','tutor','creator') or reason is null or length(trim(reason))<3 then raise exception 'Choose an educator role and add a reason'; end if;
 if new_role='teacher' and not exists(select 1 from staff_applications where user_id=target_user and kind='teacher' and status='approved') then raise exception 'Review and approve the teacher ID and teaching video first'; end if;
 update profiles set role=new_role where id=target_user and role not in ('owner','admin');
 if not found then raise exception 'This account cannot be changed here'; end if;
 insert into audit_log(actor_id,entity_id,action,reason) values(auth.uid(),target_user,'educator.role',trim(reason));
end $$;
create function notify_direct_message() returns trigger language plpgsql security definer set search_path=public as $$ begin
 insert into notifications(user_id,message) values(new.recipient_id,'You have a new direct message. Open Direct messages.');return new;
end $$;
create trigger dm_notify after insert on direct_messages for each row execute function notify_direct_message();
