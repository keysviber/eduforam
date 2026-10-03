-- 1.1.0: exact school grades, invitation classrooms, and private support.
-- Existing broad-level resources remain searchable; new resources require a grade.
create function public.validate_resource_grade() returns trigger language plpgsql set search_path=public as $$
begin
 if new.kind in ('book','course','reel') and new.level not in ('Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Form 1','Form 2','Form 3','Form 4','Form 5','Form 6') then raise exception 'Choose an exact resource grade'; end if;
 return new;
end $$;
create trigger resource_grade before insert on public.entries for each row execute function public.validate_resource_grade();
alter table public.entries add constraint video_attachment_required check(kind <> 'reel' or nullif(trim(file_path),'') is not null) not valid;
alter table public.profiles add column grade text check (grade in ('Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Form 1','Form 2','Form 3','Form 4','Form 5','Form 6'));
create or replace function public.create_profile() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into profiles(id,grade) values(new.id, case when new.raw_user_meta_data->>'grade' in ('Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Form 1','Form 2','Form 3','Form 4','Form 5','Form 6') then new.raw_user_meta_data->>'grade' else null end);
 return new;
end $$;
-- Recover accounts registered before the application's tables were installed.
-- Metadata never assigns staff roles; every recovered profile starts as student.
insert into public.profiles(id,grade)
select id, case when raw_user_meta_data->>'grade' in ('Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Form 1','Form 2','Form 3','Form 4','Form 5','Form 6') then raw_user_meta_data->>'grade' else null end
from auth.users on conflict(id) do nothing;
create function public.set_my_grade(new_grade text) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_active() then raise exception 'Sign in with an active account'; end if;
 if new_grade is null then raise exception 'Choose your grade'; end if;
 update profiles set grade=new_grade where id=auth.uid();
end $$;
revoke all on function public.set_my_grade(text) from public,anon;
grant execute on function public.set_my_grade(text) to authenticated;

create table public.classrooms(id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles, title text not null check(length(trim(title)) between 4 and 120), grade text not null check(grade in ('Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Form 1','Form 2','Form 3','Form 4','Form 5','Form 6')), join_code text not null unique default replace(gen_random_uuid()::text,'-',''), created_at timestamptz not null default now());
create table public.classroom_members(classroom_id uuid references public.classrooms on delete cascade, user_id uuid references public.profiles on delete cascade, primary key(classroom_id,user_id));
create table public.classroom_lessons(classroom_id uuid references public.classrooms on delete cascade, entry_id uuid references public.entries on delete cascade, primary key(classroom_id,entry_id));
create function public.in_classroom(room_id uuid) returns boolean language sql stable security definer set search_path=public as $$ select public.is_active() and (public.is_admin() or exists(select 1 from classroom_members where classroom_id=room_id and user_id=auth.uid())) $$;
create function public.join_classroom(invite_code text) returns uuid language plpgsql security definer set search_path=public as $$
declare room_id uuid;
begin
 if not public.is_active() then raise exception 'Sign in with an active account'; end if;
 select id into room_id from classrooms where join_code=lower(trim(invite_code));
 if room_id is null then raise exception 'Invitation code not found. Ask your teacher for the full code.'; end if;
 insert into classroom_members values(room_id,auth.uid()) on conflict do nothing;
 return room_id;
end $$;
revoke all on function public.join_classroom(text), public.in_classroom(uuid) from public,anon;
grant execute on function public.join_classroom(text), public.in_classroom(uuid) to authenticated;
alter table public.classrooms enable row level security;
alter table public.classroom_members enable row level security;
alter table public.classroom_lessons enable row level security;
create policy rooms_read on public.classrooms for select to authenticated using(public.in_classroom(id));
create policy rooms_create on public.classrooms for insert to authenticated with check(public.is_admin() and owner_id=auth.uid());
create policy members_read on public.classroom_members for select to authenticated using(user_id=auth.uid() or public.is_admin());
create policy members_leave on public.classroom_members for delete to authenticated using(user_id=auth.uid());
create policy classroom_lessons_read on public.classroom_lessons for select to authenticated using(public.in_classroom(classroom_id));
create policy classroom_lessons_manage on public.classroom_lessons for all to authenticated using(public.is_admin()) with check(public.is_admin() and exists(select 1 from entries where id=entry_id and status='approved' and kind in ('book','course','reel')));

create table public.support_settings(id boolean primary key default true check(id), enabled boolean not null default false);
insert into public.support_settings default values;
create table public.support_requests(id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles on delete cascade, message text not null check(length(trim(message)) between 10 and 4000), response text not null default '' check(length(response)<=4000), status text not null default 'open' check(status in ('open','answered','closed')), created_at timestamptz not null default now());
alter table public.support_settings enable row level security;
alter table public.support_requests enable row level security;
create policy support_settings_read on public.support_settings for select using(true);
create policy support_settings_manage on public.support_settings for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy support_read on public.support_requests for select to authenticated using(public.is_active() and (user_id=auth.uid() or public.is_admin()));
create policy support_submit on public.support_requests for insert to authenticated with check(user_id=auth.uid() and public.is_active() and status='open' and response='' and exists(select 1 from support_settings where enabled));
create function public.respond_to_support(request_id uuid, reply text, new_status text) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() then raise exception 'Administrator permission required'; end if;
 if length(trim(reply))<1 or new_status not in ('answered','closed') then raise exception 'Add a response and valid status'; end if;
 update support_requests set response=trim(reply),status=new_status where id=request_id;
 if not found then raise exception 'Request not found'; end if;
 insert into audit_log(actor_id,entity_id,action,reason) values(auth.uid(),request_id,'support.'||new_status,'Private support response recorded');
end $$;
revoke all on function public.respond_to_support(uuid,text,text) from public,anon;
grant execute on function public.respond_to_support(uuid,text,text) to authenticated;
grant select on public.support_settings to anon,authenticated;
grant select,insert,delete on public.classrooms,public.classroom_members,public.classroom_lessons,public.support_requests to authenticated;
grant update on public.support_settings to authenticated;
