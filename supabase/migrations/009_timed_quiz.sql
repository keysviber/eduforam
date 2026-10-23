-- Ten-question quizzes. Question contents, timing, deductions and rewards are server-owned.
create table quiz_groups(id uuid primary key default gen_random_uuid(),name text not null,levels integer[] not null check(cardinality(levels)=3),active boolean not null default true);
create function quiz_group_overlap() returns trigger language plpgsql security definer set search_path=public as $$ begin
 perform pg_advisory_xact_lock(984113);
 if (select count(distinct x) from unnest(new.levels)x)<>3 or exists(select 1 from unnest(new.levels)x where x not between 1 and 24) then raise exception 'Choose three distinct education levels'; end if;
 if new.active and exists(select 1 from quiz_groups where id<>new.id and active and levels && new.levels) then raise exception 'An education level already belongs to another active group'; end if;
 return new;
end $$;
create trigger quiz_groups_validate before insert or update on quiz_groups for each row execute function quiz_group_overlap();
insert into quiz_groups(name,levels) select 'Levels '||n||'-'||(n+2),array[n,n+1,n+2] from generate_series(1,19,3)n;
create table quiz_bank(id uuid primary key default gen_random_uuid(),group_id uuid not null references quiz_groups,category text not null check(category in ('speed','hard')),subject text not null,prompt text not null check(length(trim(prompt)) between 3 and 2000),choices jsonb not null check(jsonb_typeof(choices)='array' and jsonb_array_length(choices) between 2 and 6),correct integer not null,points integer not null default 10 check(points between 1 and 100),explanation text not null default '',active boolean not null default true,check(correct>=0 and correct<jsonb_array_length(choices)));
alter table quiz_groups enable row level security;alter table quiz_bank enable row level security;
create policy quiz_groups_read on quiz_groups for select using(true);
create policy quiz_groups_admin on quiz_groups for all to authenticated using(is_admin()) with check(is_admin());
create policy quiz_bank_admin on quiz_bank for all to authenticated using(is_admin()) with check(is_admin());
grant select on quiz_groups to anon,authenticated;
grant insert,update,delete on quiz_groups to authenticated;
grant select,insert,update,delete on quiz_bank to authenticated;
-- Original arithmetic starter pools, varied by group. Staff can replace and expand them.
insert into quiz_bank(group_id,category,subject,prompt,choices,correct,explanation)
select g.id,c,'Maths',case when c='speed' then 'What is '||n||' + '||g.levels[1]||'?' else 'What is '||n||' × '||(g.levels[1]+2)||' - 3?' end,
 case n%4 when 0 then jsonb_build_array(answer,answer+1,answer-1,answer+3) when 1 then jsonb_build_array(answer+1,answer,answer-1,answer+3) when 2 then jsonb_build_array(answer+1,answer-1,answer,answer+3) else jsonb_build_array(answer+1,answer-1,answer+3,answer) end,n%4,'The answer is '||answer||'.'
from quiz_groups g cross join unnest(array['speed','hard'])c cross join generate_series(1,40)n
cross join lateral (select case when c='speed' then n+g.levels[1] else n*(g.levels[1]+2)-3 end answer)r;
create table quiz_sets(id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles on delete cascade,group_id uuid not null references quiz_groups,category text not null check(category in ('speed','hard')),month date not null default (date_trunc('month',now() at time zone 'UTC'))::date,snapshot jsonb not null,answers jsonb not null default '[]',cursor integer not null default 0,score integer not null default 0,correct_count integer not null default 0,status text not null default 'playing' check(status in ('playing','completed','expired')),started_at timestamptz not null default clock_timestamp(),issued_at timestamptz,finished_at timestamptz,elapsed_ms bigint);
create unique index quiz_one_active on quiz_sets(user_id,category) where status='playing';
alter table quiz_sets enable row level security;
create policy quiz_sets_read on quiz_sets for select to authenticated using(user_id=auth.uid() and is_active());
revoke all on quiz_sets from anon,authenticated;
grant select(id,user_id,group_id,category,month,cursor,score,correct_count,status,started_at,finished_at,elapsed_ms) on quiz_sets to authenticated;
create function start_quiz(kind text) returns uuid language plpgsql security definer set search_path=public as $$ declare result uuid; group_key uuid; pool jsonb; begin
 if not is_active() then raise exception 'Sign in to play'; end if;
 if kind is null or kind not in ('speed','hard') then raise exception 'Choose a quiz category'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,9));
 update quiz_sets set status='expired' where user_id=auth.uid() and status='playing' and month<>(date_trunc('month',now() at time zone 'UTC'))::date;
 select id into result from quiz_sets where user_id=auth.uid() and category=kind and status='playing';
 if result is not null then return result; end if;
 select g.id into group_key from quiz_groups g join profiles p on p.education_ordinal=any(g.levels) where p.id=auth.uid() and g.active;
 if group_key is null then raise exception 'Choose your country and education level in Settings. A quiz group must be configured for that level.'; end if;
 select jsonb_agg(to_jsonb(q)) into pool from (select b.* from quiz_bank b where b.active and b.group_id=group_key and b.category=kind and (kind='speed' or not exists(select 1 from quiz_sets s cross join lateral jsonb_array_elements(s.snapshot)x where s.user_id=auth.uid() and s.category='hard' and s.month=(date_trunc('month',now() at time zone 'UTC'))::date and x->>'id'=b.id::text)) order by random() limit 10)q;
 if pool is null or jsonb_array_length(pool)<10 then raise exception 'At least 10 unseen questions are needed for this group. Ask an administrator to add more questions.'; end if;
 insert into quiz_sets(user_id,group_id,category,snapshot) values(auth.uid(),group_key,kind,pool) returning id into result;
 return result;
end $$;
create function quiz_next(set_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$ declare s quiz_sets; q jsonb; begin
 if not is_active() then raise exception 'Active account required'; end if;
 select * into s from quiz_sets where id=set_id and user_id=auth.uid() for update;
 if not found then raise exception 'Quiz set not found'; end if;
 if s.status<>'playing' then return jsonb_build_object('status',s.status,'score',s.score,'correct_count',s.correct_count,'elapsed_ms',s.elapsed_ms); end if;
 if s.issued_at is null then update quiz_sets set issued_at=clock_timestamp() where id=s.id returning * into s; end if;
 q:=s.snapshot->s.cursor;
 return jsonb_build_object('status','playing','position',s.cursor,'score',s.score,'prompt',q->>'prompt','choices',q->'choices','deadline',s.issued_at+interval '30 seconds','server_time',clock_timestamp());
end $$;
create function submit_quiz_answer(set_id uuid,question_index integer,choice integer) returns jsonb language plpgsql security definer set search_path=public as $$ declare s quiz_sets; q jsonb; correct boolean; points integer; result jsonb; elapsed bigint; begin
 if not is_active() then raise exception 'Active account required'; end if;
 select * into s from quiz_sets where id=set_id and user_id=auth.uid() for update;
 if not found or question_index is null or question_index<0 or question_index>9 then raise exception 'Invalid quiz request'; end if;
 if question_index<s.cursor then return s.answers->question_index; end if;
 if s.status<>'playing' or question_index<>s.cursor or s.issued_at is null then raise exception 'Load the current question first'; end if;
 if s.month<>(date_trunc('month',now() at time zone 'UTC'))::date then raise exception 'The quiz month has ended. Start a new set.'; end if;
 q:=s.snapshot->question_index;
 if choice is not null and (choice<0 or choice>=jsonb_array_length(q->'choices')) then raise exception 'Invalid answer option'; end if;
 correct:=choice is not null and choice=(q->>'correct')::int and clock_timestamp()<s.issued_at+interval '30 seconds';
 points:=case when correct then (q->>'points')::int else -3 end;
 elapsed:=greatest(0,floor(extract(epoch from clock_timestamp()-s.started_at)*1000)::bigint);
 result:=jsonb_build_object('correct',correct,'correct_choice',(q->>'correct')::int,'selected',choice,'points',points,'explanation',q->>'explanation','score',s.score+points,'completed',question_index=9,'elapsed_ms',elapsed);
 update quiz_sets set answers=answers||jsonb_build_array(result),score=score+points,correct_count=correct_count+case when correct then 1 else 0 end,cursor=cursor+1,issued_at=null,status=case when question_index=9 then 'completed' else 'playing' end,finished_at=case when question_index=9 then clock_timestamp() end,elapsed_ms=case when question_index=9 then elapsed end where id=s.id;
 return result;
end $$;
create function timed_quiz_leaderboard(kind text,period date default null) returns table(learner text,points bigint,elapsed_ms bigint,correct_count integer) language sql stable security definer set search_path=public as $$
 with hard as (select s.user_id,sum(s.score)::bigint points,max(s.finished_at) finish from quiz_sets s join profiles p on p.id=s.user_id where is_active() and kind='hard' and s.category='hard' and s.status='completed' and not p.suspended and s.month=coalesce(period,(date_trunc('month',now() at time zone 'UTC'))::date) group by s.user_id),speed as (select distinct on(s.user_id) s.user_id,s.score,s.elapsed_ms,s.correct_count from quiz_sets s join profiles p on p.id=s.user_id where is_active() and kind='speed' and s.category='speed' and s.status='completed' and s.correct_count=10 and not p.suspended order by s.user_id,s.elapsed_ms,s.finished_at)
 select '☆'||p.username,h.points,null::bigint,null::integer from hard h join profiles p on p.id=h.user_id order by h.points desc,h.finish,p.username limit 100
$$;
-- Separate function keeps speed ordering numeric and requires all ten correct.
create function speed_quiz_leaderboard() returns table(learner text,elapsed_ms bigint) language sql stable security definer set search_path=public as $$ select '☆'||p.username,min(s.elapsed_ms) from quiz_sets s join profiles p on p.id=s.user_id where is_active() and s.category='speed' and s.status='completed' and s.correct_count=10 and not p.suspended group by p.id order by min(s.elapsed_ms),p.username limit 100 $$;
create table quiz_monthly_rewards(id uuid primary key default gen_random_uuid(),month date not null,user_id uuid not null references profiles,rank integer not null check(rank between 1 and 3),amount_minor integer not null check(amount_minor in (1500,1000,500)),status text not null default 'pending_review' check(status in ('pending_review','credited','rejected')),reason text not null default '',unique(month,rank),unique(month,user_id));
alter table quiz_monthly_rewards enable row level security;
create policy quiz_rewards_read on quiz_monthly_rewards for select to authenticated using(user_id=auth.uid() or is_admin());
grant select on quiz_monthly_rewards to authenticated;
alter table creator_ledger add column quiz_reward_id uuid unique references quiz_monthly_rewards;
create function close_quiz_month(period date) returns void language plpgsql security definer set search_path=public as $$ begin
 if not is_admin() then raise exception 'Administrator permission required'; end if;
 if period is null or period<>date_trunc('month',period)::date or period>=(date_trunc('month',now() at time zone 'UTC'))::date then raise exception 'Choose a completed calendar month'; end if;
 perform pg_advisory_xact_lock(hashtextextended(period::text,9));
 if exists(select 1 from quiz_monthly_rewards where month=period) then return; end if;
 insert into quiz_monthly_rewards(month,user_id,rank,amount_minor)
 select period,user_id,r::int,case r when 1 then 1500 when 2 then 1000 else 500 end from (select s.user_id,row_number() over(order by sum(s.score) desc,max(s.finished_at),s.user_id)r from quiz_sets s join profiles p on p.id=s.user_id where s.month=period and s.category='hard' and s.status='completed' and not p.suspended group by s.user_id having sum(s.score)>0)w where r<=3;
end $$;
create function review_quiz_reward(reward uuid,approve boolean,reason text) returns void language plpgsql security definer set search_path=public as $$ declare r quiz_monthly_rewards; begin
 if not is_admin() then raise exception 'Administrator permission required'; end if;
 if approve is null or reason is null or length(trim(reason))<5 then raise exception 'Explain reward review'; end if;
 select * into r from quiz_monthly_rewards where id=reward and status='pending_review' for update;
 if not found then raise exception 'Pending reward not found'; end if;
 if approve then insert into creator_ledger(user_id,quiz_reward_id,amount,currency) values(r.user_id,r.id,r.amount_minor/100.0,'USD'); end if;
 update quiz_monthly_rewards set status=case when approve then 'credited' else 'rejected' end,reason=trim(review_quiz_reward.reason) where id=r.id;
 insert into audit_log(actor_id,entity_id,action,reason) values(auth.uid(),r.id,'quiz.reward',trim(review_quiz_reward.reason));
end $$;
revoke all on function start_quiz(text),quiz_next(uuid),submit_quiz_answer(uuid,integer,integer),timed_quiz_leaderboard(text,date),speed_quiz_leaderboard(),close_quiz_month(date),review_quiz_reward(uuid,boolean,text) from public,anon;
grant execute on function start_quiz(text),quiz_next(uuid),submit_quiz_answer(uuid,integer,integer),timed_quiz_leaderboard(text,date),speed_quiz_leaderboard(),close_quiz_month(date),review_quiz_reward(uuid,boolean,text) to authenticated;
create or replace function quiz_leaderboard() returns table(learner text,points bigint) language sql stable security definer set search_path=public as $$ select '☆'||p.username,sum(a.points) from quiz_answers a join profiles p on p.id=a.user_id where not p.suspended group by p.id order by sum(a.points) desc,p.username $$;
