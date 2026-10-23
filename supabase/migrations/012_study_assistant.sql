create table public.study_ai_settings (
 id boolean primary key default true check(id), enabled boolean not null default false,
 daily_user_limit integer not null default 10 check(daily_user_limit between 1 and 50),
 daily_total_limit integer not null default 100 check(daily_total_limit between 1 and 2000)
);
insert into public.study_ai_settings(id) values(true);
alter table public.study_ai_settings enable row level security;
create policy study_settings_read on public.study_ai_settings for select to authenticated using(public.is_active());
grant select on public.study_ai_settings to authenticated;
create table public.study_ai_usage (
 user_id uuid not null references public.profiles on delete cascade,
 usage_day date not null, requests integer not null check(requests>0),
 last_request_at timestamptz not null default now(), primary key(user_id,usage_day)
);
alter table public.study_ai_usage enable row level security;
create policy study_usage_read on public.study_ai_usage for select to authenticated using(public.is_active() and user_id=auth.uid());
grant select on public.study_ai_usage to authenticated;
create function public.configure_study_ai(active boolean,user_limit integer,total_limit integer) returns void
 language plpgsql security definer set search_path=public as $$ begin
 if not is_owner() then raise exception 'Owner permission required'; end if;
 if active is null or user_limit is null or total_limit is null then raise exception 'All settings required'; end if;
 update study_ai_settings set enabled=active,daily_user_limit=user_limit,daily_total_limit=total_limit where id;
 insert into audit_log(actor_id,action,reason,details) values(auth.uid(),'study_ai.configure','Owner updated study assistant settings',jsonb_build_object('enabled',active,'user_limit',user_limit,'total_limit',total_limit));
end $$;
revoke all on function public.configure_study_ai(boolean,integer,integer) from public;
grant execute on function public.configure_study_ai(boolean,integer,integer) to authenticated;
-- The edge function supplies its verified user ID. Never callable by app clients.
create function public.reserve_study_ai(target_user uuid) returns integer
 language plpgsql security definer set search_path=public as $$
declare settings study_ai_settings; used integer; total integer; last_request timestamptz; today date := (now() at time zone 'UTC')::date;
begin
 perform pg_advisory_xact_lock(19472027);
 if not exists(select 1 from profiles where id=target_user and not suspended) then raise exception 'AI_ACCOUNT_INACTIVE'; end if;
 select * into settings from study_ai_settings where id;
 if not settings.enabled then raise exception 'AI_DISABLED'; end if;
 select requests,last_request_at into used,last_request from study_ai_usage where user_id=target_user and usage_day=today;
 if last_request > now()-interval '10 seconds' then raise exception 'AI_TOO_FAST'; end if;
 select coalesce(sum(requests),0) into total from study_ai_usage where usage_day=today;
 if coalesce(used,0)>=settings.daily_user_limit or total>=settings.daily_total_limit then raise exception 'AI_DAILY_LIMIT'; end if;
 insert into study_ai_usage(user_id,usage_day,requests) values(target_user,today,1)
 on conflict(user_id,usage_day) do update set requests=study_ai_usage.requests+1,last_request_at=now();
 return settings.daily_user_limit-coalesce(used,0)-1;
end $$;
revoke all on function public.reserve_study_ai(uuid) from public,anon,authenticated;
grant execute on function public.reserve_study_ai(uuid) to service_role;
