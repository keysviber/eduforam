-- Education Forum: apply to a fresh Supabase project.
create type public.review_status as enum ('pending','approved','rejected','changes_requested','removed');
create type public.user_role as enum ('student','teacher','tutor','creator','admin','owner');
create table public.profiles(id uuid primary key references auth.users on delete cascade, display_name text not null default '', role public.user_role not null default 'student', suspended boolean not null default false, monetization_enabled boolean not null default false, created_at timestamptz not null default now());
create function public.create_profile() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into profiles(id) values(new.id); return new; end $$;
create trigger auth_profile after insert on auth.users for each row execute function public.create_profile();
create function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from profiles where id=auth.uid() and role in ('admin','owner') and not suspended) $$;
create function public.is_active() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from profiles where id=auth.uid() and not suspended) $$;
create table public.entries(id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles,kind text not null check(kind in ('book','assistance','idea','reel','course')),title text not null check(length(trim(title))>=4),description text not null check(length(trim(description))>=20),category text not null,author text not null,level text not null default 'All levels',status public.review_status not null default 'pending',file_path text,color text not null default '#244d41',target bigint not null default 0 check(target>=0),raised bigint not null default 0 check(raised>=0),created_at timestamptz not null default now());
create index entries_discovery on public.entries(kind,status,category);
create index entries_owner on public.entries(owner_id);
-- Sensitive details are never part of the public entry projection.
create table public.application_details(entry_id uuid primary key references public.entries on delete cascade,owner_id uuid not null references public.profiles,private_details jsonb not null default '{}',supporting_paths text[] not null default '{}');
create table public.audit_log(id bigint generated always as identity primary key,actor_id uuid references public.profiles,entity_id uuid,action text not null,reason text not null,details jsonb not null default '{}',created_at timestamptz not null default now());
create table public.plans(id uuid primary key default gen_random_uuid(),name text not null,price_minor bigint not null check(price_minor>=0),currency text not null check(currency ~ '^[A-Z]{3}$'),benefits jsonb not null default '[]',active boolean not null default false,apple_product_id text,google_product_id text);
create table public.feature_rules(feature_key text primary key,access_mode text not null check(access_mode in ('free','individual','premier','subscription')),plan_id uuid references public.plans,price_minor bigint check(price_minor>=0),free_until timestamptz);
create table public.earnings_policies(id uuid primary key default gen_random_uuid(),role public.user_role not null,view_rate numeric(16,8) not null default 0 check(view_rate>=0),subscriber_rate numeric(16,8) not null default 0 check(subscriber_rate>=0),minimum_payout_minor bigint not null default 1000 check(minimum_payout_minor>=0),maximum_earning_minor bigint check(maximum_earning_minor>=0),currency text not null default 'USD',active boolean not null default false);
create table public.transactions(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles,purpose text not null check(purpose in ('subscription','premier','content','donation','funding','payout','refund')),amount_minor bigint not null check(amount_minor>0),currency text not null check(currency ~ '^[A-Z]{3}$'),status text not null default 'pending' check(status in ('pending','successful','failed','refunded')),provider text not null,provider_reference text unique,idempotency_key text not null unique,entry_id uuid references public.entries,created_at timestamptz not null default now());
create table public.earnings(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles,policy_id uuid not null references public.earnings_policies,amount_minor bigint not null check(amount_minor>=0),currency text not null,status text not null default 'pending' check(status in ('pending','approved','withdrawable','paid','rejected')),verified_views bigint not null default 0,verified_subscribers bigint not null default 0,period_start date not null,period_end date not null,unique(user_id,policy_id,period_start,period_end));
create table public.funding_agreements(id uuid primary key default gen_random_uuid(),entry_id uuid not null references public.entries,student_id uuid not null references public.profiles,stage text not null default 'review' check(stage in ('review','negotiation','agreement','funding','progress','completed','suspended')),amount_minor bigint check(amount_minor>0),currency text not null default 'USD',conditions text not null default '',progress_notes text not null default '',approved_by uuid references public.profiles,created_at timestamptz not null default now());
create table public.reports(id uuid primary key default gen_random_uuid(),entry_id uuid not null references public.entries,reporter_id uuid not null references public.profiles,reason text not null check(length(reason)>5),status text not null default 'open' check(status in ('open','reviewed','dismissed')),created_at timestamptz not null default now());
create table public.languages(id uuid primary key default gen_random_uuid(),name text not null unique,code text not null unique,active boolean not null default true);
insert into public.languages(name,code) values ('French','fr'),('Dutch','nl'),('Spanish','es');
create table public.lessons(id uuid primary key default gen_random_uuid(),language_id uuid references public.languages,title text not null,level text not null check(level in ('beginner','intermediate','advanced')),content jsonb not null,active boolean not null default false);
create table public.learning_progress(user_id uuid references public.profiles,lesson_id uuid references public.lessons,progress integer not null default 0 check(progress between 0 and 100),updated_at timestamptz not null default now(),primary key(user_id,lesson_id));
create table public.bookmarks(user_id uuid references public.profiles,entry_id uuid references public.entries,primary key(user_id,entry_id));
create table public.provider_configuration(provider text primary key,markets text[] not null default '{}',purposes text[] not null default '{}',enabled boolean not null default false);
insert into public.provider_configuration(provider) values ('apple_iap'),('google_play'),('paypal'),('ecocash'),('opay'),('swift');

-- RLS is enabled on every public table, including those with no client-write policy.
do $$ declare t text; begin foreach t in array array['profiles','entries','application_details','audit_log','plans','feature_rules','earnings_policies','transactions','earnings','funding_agreements','reports','languages','lessons','learning_progress','bookmarks','provider_configuration'] loop execute format('alter table public.%I enable row level security',t); end loop; end $$;
create policy profile_read on public.profiles for select using(id=auth.uid() or public.is_admin());
-- No client role, suspension, balance, or eligibility mutations.
create policy entries_read on public.entries for select using(status='approved' or owner_id=auth.uid() or public.is_admin());
create policy entries_submit on public.entries for insert to authenticated with check(owner_id=auth.uid() and public.is_active() and status='pending' and target=0 and raised=0 and (file_path is null or file_path like auth.uid()::text||'/%'));
create policy private_read on public.application_details for select to authenticated using(owner_id=auth.uid() or public.is_admin());
create policy private_submit on public.application_details for insert to authenticated with check(owner_id=auth.uid() and public.is_active() and exists(select 1 from entries where id=entry_id and owner_id=auth.uid() and status='pending'));
create policy audit_read on public.audit_log for select to authenticated using(public.is_admin());
create policy plans_read on public.plans for select using(active or public.is_admin());
create policy features_read on public.feature_rules for select using(true);
create policy policies_read on public.earnings_policies for select to authenticated using(public.is_admin());
create policy transactions_read on public.transactions for select to authenticated using(user_id=auth.uid() or public.is_admin());
create policy earnings_read on public.earnings for select to authenticated using(user_id=auth.uid() or public.is_admin());
create policy funding_read on public.funding_agreements for select to authenticated using(student_id=auth.uid() or public.is_admin());
create policy reports_read on public.reports for select to authenticated using(reporter_id=auth.uid() or public.is_admin());
create policy reports_submit on public.reports for insert to authenticated with check(reporter_id=auth.uid() and public.is_active() and status='open');
create policy languages_read on public.languages for select using(active or public.is_admin());
create policy lessons_read on public.lessons for select using(active or public.is_admin());
create policy progress_own on public.learning_progress for all to authenticated using(user_id=auth.uid() and public.is_active()) with check(user_id=auth.uid() and public.is_active());
create policy bookmarks_own on public.bookmarks for all to authenticated using(user_id=auth.uid() and public.is_active()) with check(user_id=auth.uid() and public.is_active());
create policy providers_read on public.provider_configuration for select to authenticated using(public.is_admin());

create function public.review_entry(entry_id uuid,decision public.review_status,reason text) returns void language plpgsql security definer set search_path=public as $$
declare old_status public.review_status;
begin
 if not public.is_admin() then raise exception 'Administrator permission required'; end if;
 if length(trim(reason))<1 then raise exception 'Decision reason required'; end if;
 if decision='pending' then raise exception 'Invalid review decision'; end if;
 select status into old_status from public.entries where id=entry_id for update;
 if not found then raise exception 'Submission not found'; end if;
 if old_status=decision then raise exception 'Decision already applied'; end if;
 update public.entries set status=decision where id=entry_id;
 insert into public.audit_log(actor_id,entity_id,action,reason,details) values(auth.uid(),entry_id,'entry.'||decision,reason,jsonb_build_object('previous_status',old_status));
end $$;
revoke all on function public.review_entry(uuid,public.review_status,text) from public,anon;
grant execute on function public.review_entry(uuid,public.review_status,text) to authenticated;

-- Audited configuration editing. Finance remains server-only: no generic balance writes.
create function public.configure_plan(plan_id uuid,plan_name text,amount bigint,plan_currency text,plan_benefits jsonb,enabled boolean,reason text) returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
 if not public.is_admin() then raise exception 'Administrator permission required'; end if;
 if length(trim(reason))<1 then raise exception 'Reason required'; end if;
 insert into plans(id,name,price_minor,currency,benefits,active) values(coalesce(plan_id,gen_random_uuid()),plan_name,amount,plan_currency,plan_benefits,enabled)
 on conflict(id) do update set name=excluded.name,price_minor=excluded.price_minor,currency=excluded.currency,benefits=excluded.benefits,active=excluded.active returning id into result;
 insert into audit_log(actor_id,entity_id,action,reason) values(auth.uid(),result,'plan.configured',reason);return result;
end $$;
revoke all on function public.configure_plan(uuid,text,bigint,text,jsonb,boolean,text) from public,anon;
grant execute on function public.configure_plan(uuid,text,bigint,text,jsonb,boolean,text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('submissions','submissions',false,20971520,array['application/pdf','video/mp4','video/quicktime']);
create policy upload_private on storage.objects for insert to authenticated with check(bucket_id='submissions' and (storage.foldername(name))[1]=auth.uid()::text and public.is_active());
create policy read_submitted on storage.objects for select to authenticated using(bucket_id='submissions' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin() or exists(select 1 from public.entries e where e.file_path=name and e.status='approved' and e.kind in ('book','course','reel'))));
-- No public storage URLs. Sensitive assistance/idea files stay private even after approval.

create function public.configure_platform(setting_kind text,setting jsonb,reason text) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() then raise exception 'Administrator permission required'; end if;
 if length(trim(reason))<1 then raise exception 'Reason required'; end if;
 case setting_kind
 when 'feature' then
  insert into feature_rules(feature_key,access_mode) values(setting->>'feature_key',setting->>'access_mode') on conflict(feature_key) do update set access_mode=excluded.access_mode;
 when 'earnings' then
  if (setting->>'role') not in ('student','teacher','tutor','creator') then raise exception 'Invalid role'; end if;
  update earnings_policies set active=false where role=(setting->>'role')::user_role;
  insert into earnings_policies(role,view_rate,subscriber_rate,minimum_payout_minor,currency,active) values((setting->>'role')::user_role,(setting->>'view_rate')::numeric,(setting->>'subscriber_rate')::numeric,(setting->>'minimum_payout_minor')::bigint,setting->>'currency',true);
 when 'user' then
  if exists(select 1 from profiles where id=(setting->>'id')::uuid and role in ('admin','owner')) then raise exception 'Administrative accounts require owner review'; end if;
  update profiles set suspended=(setting->>'suspended')::boolean where id=(setting->>'id')::uuid;
 when 'report' then
  update reports set status=setting->>'status' where id=(setting->>'id')::uuid;
 else raise exception 'Unsupported configuration';
 end case;
 insert into audit_log(actor_id,action,reason,details) values(auth.uid(),'configuration.'||setting_kind,reason,setting);
end $$;
revoke all on function public.configure_platform(text,jsonb,text) from public,anon;
grant execute on function public.configure_platform(text,jsonb,text) to authenticated;
