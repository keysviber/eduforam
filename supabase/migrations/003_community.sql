-- Community features. Apply after 002 on existing installations.
alter table public.profiles add column first_name text not null default '', add column surname text not null default '', add column date_of_birth date, add column country text not null default '', add column account_type text not null default 'student' check(account_type in ('student','teacher')), add column moderator boolean not null default false;
create or replace function public.create_profile() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into profiles(id,grade,first_name,surname,date_of_birth,country,account_type,display_name)
 values(new.id,case when new.raw_user_meta_data->>'grade' in ('Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Form 1','Form 2','Form 3','Form 4','Form 5','Form 6') then new.raw_user_meta_data->>'grade' end,
 coalesce(new.raw_user_meta_data->>'first_name',''),coalesce(new.raw_user_meta_data->>'surname',''),nullif(new.raw_user_meta_data->>'date_of_birth','')::date,coalesce(new.raw_user_meta_data->>'country',''),case when new.raw_user_meta_data->>'account_type'='teacher' then 'teacher' else 'student' end,coalesce(new.raw_user_meta_data->>'first_name','Learner'));
 return new;
end $$;
create function public.can_moderate() returns boolean language sql stable security definer set search_path=public as $$ select public.is_admin() or exists(select 1 from profiles where id=auth.uid() and moderator and not suspended) $$;
create function public.set_moderator(target_id uuid, enabled boolean) returns void language plpgsql security definer set search_path=public as $$ begin
 if not public.is_admin() then raise exception 'Administrator permission required'; end if;
 update profiles set moderator=enabled where id=target_id;
 insert into audit_log(actor_id,entity_id,action,reason) values(auth.uid(),target_id,'moderator.changed',enabled::text);
end $$;
create policy moderator_entries on public.entries for select to authenticated using(public.can_moderate());
create policy moderator_files on storage.objects for select to authenticated using(bucket_id='submissions' and public.can_moderate());
create or replace function public.review_entry(entry_id uuid,decision public.review_status,reason text) returns void language plpgsql security definer set search_path=public as $$
declare old_status public.review_status;
begin
 if not public.can_moderate() then raise exception 'Administrator permission required'; end if;
 if length(trim(reason))<1 then raise exception 'Decision reason required'; end if;
 if decision='pending' then raise exception 'Invalid review decision'; end if;
 select status into old_status from entries where id=entry_id for update;
 if not found then raise exception 'Submission not found'; end if;
 if old_status=decision then raise exception 'Decision already applied'; end if;
 update entries set status=decision where id=entry_id;
 insert into audit_log(actor_id,entity_id,action,reason) values(auth.uid(),entry_id,'entry.'||decision,reason);
end $$;
alter table public.entries add column video_format text not null default 'lesson' check(video_format in ('lesson','talent'));
create function public.publish_talent() returns trigger language plpgsql set search_path=public as $$ begin
 if new.kind='reel' and new.video_format='talent' then new.status='approved'; end if; return new;
end $$;
create trigger publish_talent before insert on public.entries for each row execute function public.publish_talent();
drop policy entries_submit on public.entries;
create policy entries_submit on public.entries for insert to authenticated with check(owner_id=auth.uid() and public.is_active() and (status='pending' or (kind='reel' and video_format='talent' and status='approved')) and target=0 and raised=0 and (file_path is null or file_path like auth.uid()::text||'/%'));
create table public.notifications(id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles on delete cascade, message text not null, read boolean not null default false, created_at timestamptz not null default now());
alter table public.notifications enable row level security;
create policy notifications_read on public.notifications for select to authenticated using(user_id=auth.uid() and public.is_active());
create policy notifications_update on public.notifications for update to authenticated using(user_id=auth.uid() and public.is_active()) with check(user_id=auth.uid());
grant select on public.notifications to authenticated;
revoke update on public.notifications from anon,authenticated;
grant update(read) on public.notifications to authenticated;
create function public.notify_review() returns trigger language plpgsql security definer set search_path=public as $$ begin
 if old.status<>new.status then insert into notifications(user_id,message) values(new.owner_id,new.title||': '||new.status); end if; return new;
end $$;
create trigger notify_review after update of status on entries for each row execute function public.notify_review();
create function public.notify_support() returns trigger language plpgsql security definer set search_path=public as $$ begin
 if new.response<>old.response then insert into notifications(user_id,message) values(new.user_id,'You have a private Safe Room reply. Open Safe Room to read it.'); end if; return new;
end $$;
create trigger notify_support after update on support_requests for each row execute function public.notify_support();
create table public.video_likes(entry_id uuid references entries on delete cascade,user_id uuid references profiles on delete cascade,primary key(entry_id,user_id));
create table public.video_comments(id uuid primary key default gen_random_uuid(),entry_id uuid not null references entries on delete cascade,user_id uuid not null references profiles on delete cascade,body text not null check(length(trim(body)) between 1 and 1000),created_at timestamptz not null default now());
alter table public.video_likes enable row level security;
alter table public.video_comments enable row level security;
create policy likes_read on video_likes for select to authenticated using(exists(select 1 from entries where id=entry_id and status='approved'));
create policy likes_insert on video_likes for insert to authenticated with check(user_id=auth.uid() and public.is_active() and exists(select 1 from entries where id=entry_id and status='approved' and kind='reel'));
create policy likes_delete on video_likes for delete to authenticated using(user_id=auth.uid());
create policy comments_read on video_comments for select to authenticated using(exists(select 1 from entries where id=entry_id and status='approved'));
create policy comments_insert on video_comments for insert to authenticated with check(user_id=auth.uid() and public.is_active() and exists(select 1 from entries where id=entry_id and status='approved' and kind='reel'));
create policy comments_delete on video_comments for delete to authenticated using(user_id=auth.uid() or public.can_moderate());
grant select,insert,delete on video_likes,video_comments to authenticated;
create table public.quiz_questions(id integer generated by default as identity primary key,subject text not null,prompt text not null,choices jsonb not null,answer integer not null,explanation text not null);
create table public.quiz_answers(user_id uuid references profiles on delete cascade,question_id integer references quiz_questions,choice integer not null,points integer not null,primary key(user_id,question_id));
alter table quiz_questions enable row level security;
alter table quiz_answers enable row level security;
create policy questions_read on quiz_questions for select using(true);
revoke select on quiz_questions from anon,authenticated;
grant select(id,subject,prompt,choices) on quiz_questions to anon,authenticated;
create policy answers_read on quiz_answers for select to authenticated using(user_id=auth.uid());
grant select on quiz_answers to authenticated;
create function public.answer_quiz(question integer,selected integer) returns jsonb language plpgsql security definer set search_path=public as $$
declare q quiz_questions; earned integer; begin
 if not public.is_active() then raise exception 'Sign in to earn Guru Student points'; end if;
 select * into q from quiz_questions where id=question;
 if not found or selected<0 or selected>=jsonb_array_length(q.choices) then raise exception 'Invalid question or answer'; end if;
 earned:=case when q.answer=selected then 10 else 0 end;
 insert into quiz_answers values(auth.uid(),question,selected,earned);
 return jsonb_build_object('points',earned,'explanation',q.explanation);
end $$;
create function public.quiz_leaderboard() returns table(learner text,points bigint) language sql stable security definer set search_path=public as $$
 select coalesce(nullif(p.display_name,''),'Learner')||' · '||left(p.id::text,6),sum(a.points) from quiz_answers a join profiles p on p.id=a.user_id where not p.suspended group by p.id order by sum(a.points) desc,p.id
$$;
insert into quiz_questions(subject,prompt,choices,answer,explanation) values
('Maths','What is 12 × 8?','["80","96","108"]',1,'12 multiplied by 8 is 96.'),
('Maths','What is a quarter of 100?','["20","25","50"]',1,'100 divided by 4 is 25.'),
('Maths','Solve x + 7 = 15.','["7","8","22"]',1,'Subtract 7 from both sides: x = 8.'),
('Maths','Area of a rectangle 6 cm by 4 cm?','["10 cm²","20 cm²","24 cm²"]',2,'Area = length × width = 24 cm².'),
('Science','Which gas do plants absorb during photosynthesis?','["Oxygen","Carbon dioxide","Hydrogen"]',1,'Plants use carbon dioxide and water to make sugars.'),
('Science','Which organ pumps blood?','["Heart","Lung","Kidney"]',0,'The heart pumps blood through the body.'),
('Science','What is the chemical formula for water?','["CO2","H2O","O2"]',1,'Water contains two hydrogen atoms and one oxygen atom.'),
('Science','Which planet is closest to the Sun?','["Earth","Mars","Mercury"]',2,'Mercury is the closest planet to the Sun.'),
('General knowledge','How many days are in a leap year?','["364","365","366"]',2,'A leap year includes 29 February, giving 366 days.'),
('General knowledge','Which is the largest ocean?','["Atlantic","Pacific","Indian"]',1,'The Pacific is the largest ocean.'),
('General knowledge','On which continent is Zimbabwe?','["Africa","Asia","Europe"]',0,'Zimbabwe is in southern Africa.'),
('General knowledge','How many sides does a hexagon have?','["5","6","8"]',1,'A hexagon has six sides.');
create policy published_rates on earnings_policies for select using(active);
grant select on earnings_policies to anon,authenticated;
revoke all on function public.can_moderate(),public.set_moderator(uuid,boolean),public.answer_quiz(integer,integer),public.quiz_leaderboard() from public,anon;
grant execute on function public.can_moderate(),public.set_moderator(uuid,boolean),public.answer_quiz(integer,integer),public.quiz_leaderboard() to authenticated;
alter table classrooms add column price_minor integer not null default 0 check(price_minor between 0 and 10000000), add column currency text not null default 'USD' check(currency='USD');
create policy owned_rooms_read on classrooms for select to authenticated using(owner_id=auth.uid() and public.is_active());
drop policy rooms_create on classrooms;
create policy rooms_create on classrooms for insert to authenticated with check(owner_id=auth.uid() and public.is_active());
create or replace function public.in_classroom(room_id uuid) returns boolean language sql stable security definer set search_path=public as $$ select public.is_active() and (public.is_admin() or exists(select 1 from classrooms where id=room_id and owner_id=auth.uid()) or exists(select 1 from classroom_members where classroom_id=room_id and user_id=auth.uid())) $$;
create or replace function public.join_classroom(invite_code text) returns uuid language plpgsql security definer set search_path=public as $$
declare room classrooms;
begin
 if not public.is_active() then raise exception 'Sign in with an active account'; end if;
 select * into room from classrooms where join_code=lower(trim(invite_code));
 if not found then raise exception 'Invitation code not found. Ask your teacher for the full code.'; end if;
 if room.price_minor>0 and room.owner_id<>auth.uid() then raise exception 'Paid enrolment is not available until verified payments are connected.'; end if;
 insert into classroom_members values(room.id,auth.uid()) on conflict do nothing;
 return room.id;
end $$;
create policy owner_lessons_manage on classroom_lessons for all to authenticated using(public.is_active() and exists(select 1 from classrooms where id=classroom_id and owner_id=auth.uid())) with check(public.is_active() and exists(select 1 from classrooms where id=classroom_id and owner_id=auth.uid()) and exists(select 1 from entries where id=entry_id and status='approved' and kind in ('book','course','reel')));
