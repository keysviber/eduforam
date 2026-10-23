-- Account, learning and submission workflows. Monetary records remain server-only.
alter table profiles add column bio text not null default '' check(length(bio)<=1000),
 add column discoverable boolean not null default false;
create function update_my_profile(public_name text,given_name text,family_name text,home_country text,biography text,listed boolean)
returns void language plpgsql security definer set search_path=public as $$ begin
 if not is_active() then raise exception 'Sign in with an active account'; end if;
 if public_name is null or length(trim(public_name)) not between 2 and 100 or given_name is null or length(trim(given_name)) not between 1 and 100 or family_name is null or length(trim(family_name)) not between 1 and 100 or home_country is null or length(trim(home_country)) not between 1 and 100 or biography is null or length(biography)>1000 or listed is null then raise exception 'Check your profile fields'; end if;
 update profiles set display_name=trim(public_name),first_name=trim(given_name),surname=trim(family_name),country=trim(home_country),bio=trim(biography),discoverable=listed where id=auth.uid();
end $$;
create table educator_follows(follower_id uuid references profiles on delete cascade,educator_id uuid references profiles on delete cascade,primary key(follower_id,educator_id),check(follower_id<>educator_id));
alter table educator_follows enable row level security;
create policy follows_own on educator_follows for select to authenticated using(follower_id=auth.uid());
create policy follows_add on educator_follows for insert to authenticated with check(follower_id=auth.uid() and is_active() and exists(select 1 from profiles where id=educator_id and discoverable and role in ('teacher','tutor','creator') and not suspended));
-- Directory access is a restricted projection; never expose birthday/country/private fields.
create function educator_directory() returns table(id uuid,display_name text,bio text,role user_role,followers bigint)
language sql stable security definer set search_path=public as $$ select p.id,p.display_name,p.bio,p.role,(select count(*) from educator_follows f where f.educator_id=p.id) from profiles p where p.discoverable and p.role in ('teacher','tutor','creator') and not p.suspended order by p.display_name limit 200 $$;
create function follow_educator(educator uuid,following boolean) returns void language plpgsql security definer set search_path=public as $$ begin
 if not is_active() or educator=auth.uid() or following is null then raise exception 'Sign in and choose another educator'; end if;
 if following then
  if not exists(select 1 from profiles where id=educator and discoverable and role in ('teacher','tutor','creator') and not suspended) then raise exception 'Educator is unavailable'; end if;
  insert into educator_follows values(auth.uid(),educator) on conflict do nothing;
 else delete from educator_follows where follower_id=auth.uid() and educator_id=educator; end if;
end $$;
create function set_educator_role(target_user uuid,new_role user_role,reason text) returns void language plpgsql security definer set search_path=public as $$ begin
 if not is_admin() then raise exception 'Administrator permission required'; end if;
 if new_role is null or new_role not in ('student','teacher','tutor','creator') or reason is null or length(trim(reason))<3 then raise exception 'Choose an educator role and add a reason'; end if;
 update profiles set role=new_role where id=target_user and role not in ('owner','admin');
 if not found then raise exception 'This account cannot be changed here'; end if;
 insert into audit_log(actor_id,entity_id,action,reason) values(auth.uid(),target_user,'profile.role',trim(reason));
end $$;

create table reader_progress(user_id uuid references profiles on delete cascade,entry_id uuid references entries on delete cascade,page integer not null check(page between 1 and 100000),updated_at timestamptz not null default now(),primary key(user_id,entry_id));
alter table reader_progress enable row level security;
create policy reading_own on reader_progress for all to authenticated using(user_id=auth.uid() and is_active()) with check(user_id=auth.uid() and is_active() and exists(select 1 from entries where id=entry_id and (status='approved' or owner_id=auth.uid())));
create table language_reviews(user_id uuid references profiles on delete cascade,unit_key text check(length(unit_key) between 1 and 100),completed_at timestamptz not null default now(),primary key(user_id,unit_key));
alter table language_reviews enable row level security;
create policy reviews_own on language_reviews for all to authenticated using(user_id=auth.uid() and is_active()) with check(user_id=auth.uid() and is_active());
grant select,insert,update,delete on reader_progress,language_reviews to authenticated;
grant select on educator_follows to authenticated;

create table account_requests(id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles on delete cascade,kind text not null check(kind in ('deletion','support')),message text not null check(length(trim(message)) between 3 and 2000),status text not null default 'open' check(status in ('open','processing','answered','cancelled')),response text not null default '',created_at timestamptz not null default now());
create unique index one_open_deletion on account_requests(user_id) where kind='deletion' and status in ('open','processing');
alter table account_requests enable row level security;
create policy account_requests_read on account_requests for select to authenticated using(user_id=auth.uid() or is_admin());
create policy account_requests_add on account_requests for insert to authenticated with check(user_id=auth.uid() and status='open' and response='');
grant select,insert on account_requests to authenticated;
create function respond_account_request(request_id uuid,reply text,next_status text) returns void language plpgsql security definer set search_path=public as $$ begin
 if not is_admin() then raise exception 'Administrator permission required'; end if;
 if reply is null or length(trim(reply)) not between 3 and 2000 or next_status is null or next_status not in ('processing','answered') then raise exception 'Add a response and valid status'; end if;
 update account_requests set response=trim(reply),status=next_status where id=request_id;
 if not found then raise exception 'Request not found'; end if;
 insert into notifications(user_id,message) select user_id,'Your account request has an update. Open Profile and support.' from account_requests where id=request_id;
 insert into audit_log(actor_id,entity_id,action,reason) values(auth.uid(),request_id,'account.request',trim(reply));
end $$;

create function revise_submission(entry uuid,new_title text,new_description text) returns void language plpgsql security definer set search_path=public as $$ begin
 if not is_active() then raise exception 'Sign in with an active account'; end if;
 if new_title is null or length(trim(new_title)) not between 4 and 200 or new_description is null or length(trim(new_description)) not between 20 and 12000 then raise exception 'Add a title and meaningful description'; end if;
 update entries set title=trim(new_title),description=trim(new_description),status='pending' where id=entry and owner_id=auth.uid() and status in ('pending','changes_requested','rejected');
 if not found then raise exception 'Only your pending, rejected or returned submissions can be revised'; end if;
 insert into audit_log(actor_id,entity_id,action,reason) values(auth.uid(),entry,'entry.resubmitted','Author revised submission');
end $$;

-- Structured learning content is editable by staff and remains unpublished until activated.
create policy languages_manage on languages for all to authenticated using(is_admin()) with check(is_admin());
create policy lessons_manage on lessons for all to authenticated using(is_admin()) with check(is_admin());
grant select,insert,update,delete on languages,lessons to authenticated;
grant select,insert,update,delete on learning_progress to authenticated;

alter table store_products add column plan_id uuid references plans on delete cascade;
create function save_plan_product(plan uuid,product text,entitlement text,reason text) returns void language plpgsql security definer set search_path=public as $$ begin
 if not is_admin() then raise exception 'Administrator permission required'; end if;
 if plan is null or not exists(select 1 from plans where id=plan) or product is null or length(trim(product))<1 or entitlement is null or length(trim(entitlement))<1 or reason is null or length(trim(reason))<3 then raise exception 'Provide a plan, product, entitlement and reason'; end if;
 insert into store_products(product_id,entitlement_id,plan_id) values(trim(product),trim(entitlement),plan)
 on conflict(product_id) do update set entitlement_id=excluded.entitlement_id,plan_id=excluded.plan_id,classroom_id=null,active=true;
 insert into audit_log(actor_id,entity_id,action,reason) values(auth.uid(),plan,'plan.product',trim(reason));
end $$;
create function my_plan_access() returns table(plan_id uuid,expires_at timestamptz) language sql stable security definer set search_path=public as $$ select p.plan_id,a.expires_at from purchase_access a join store_products p using(product_id) join plans pl on pl.id=p.plan_id where a.user_id=auth.uid() and is_active() and p.active and pl.active and (a.expires_at is null or a.expires_at>now()) $$;
create function has_feature_access(feature text) returns boolean language sql stable security definer set search_path=public as $$
 select is_admin() or not exists(select 1 from feature_rules where feature_key=feature) or exists(select 1 from feature_rules r where r.feature_key=feature and (r.access_mode='free' or r.free_until>now() or (is_active() and exists(select 1 from my_plan_access() a where a.plan_id=r.plan_id))))
$$;
create function save_feature_access(feature text,mode text,plan uuid,free_through timestamptz,reason text) returns void language plpgsql security definer set search_path=public as $$ begin
 if not is_admin() then raise exception 'Administrator permission required'; end if;
 if feature is null or feature not in ('library_downloads','video_lessons','language_courses') or mode is null or mode not in ('free','individual','premier','subscription') or reason is null or length(trim(reason))<3 then raise exception 'Choose a supported feature, access mode and reason'; end if;
 if mode<>'free' and (plan is null or not exists(select 1 from plans where id=plan and active)) then raise exception 'Choose an active plan for paid access'; end if;
 insert into feature_rules(feature_key,access_mode,plan_id,free_until) values(feature,mode,plan,free_through) on conflict(feature_key) do update set access_mode=excluded.access_mode,plan_id=excluded.plan_id,free_until=excluded.free_until;
 insert into audit_log(actor_id,action,reason) values(auth.uid(),'feature.access',trim(reason));
end $$;
drop policy lessons_read on lessons;
create policy lessons_read on lessons for select using(is_admin() or (active and has_feature_access('language_courses')));
drop policy read_submitted on storage.objects;
create policy read_submitted on storage.objects for select to authenticated using(bucket_id='submissions' and is_active() and ((storage.foldername(name))[1]=auth.uid()::text or is_admin() or exists(select 1 from entries e where e.file_path=name and e.status='approved' and e.kind in ('book','course','reel') and has_feature_access(case when e.kind='reel' then 'video_lessons' else 'library_downloads' end))));
revoke all on function save_feature_access(text,text,uuid,timestamptz,text) from public,anon;
grant execute on function save_feature_access(text,text,uuid,timestamptz,text) to authenticated;
revoke all on function has_feature_access(text) from public;
grant execute on function has_feature_access(text) to anon,authenticated;

create table funding_messages(id uuid primary key default gen_random_uuid(),agreement_id uuid not null references funding_agreements on delete cascade,author_id uuid not null references profiles,body text not null check(length(trim(body)) between 3 and 4000),created_at timestamptz not null default now());
alter table funding_messages enable row level security;
create policy funding_message_read on funding_messages for select to authenticated using(is_active() and exists(select 1 from funding_agreements where id=agreement_id and (student_id=auth.uid() or is_admin())));
create policy funding_message_add on funding_messages for insert to authenticated with check(author_id=auth.uid() and is_active() and exists(select 1 from funding_agreements where id=agreement_id and stage not in ('completed','suspended') and (student_id=auth.uid() or is_admin())));
grant select,insert on funding_messages to authenticated;
grant select on funding_agreements,transactions,earnings to authenticated;
create function manage_funding(entry uuid,new_stage text,amount bigint,unit_currency text,terms text,reason text) returns uuid language plpgsql security definer set search_path=public as $$ declare agreement uuid; student uuid; begin
 if not is_admin() then raise exception 'Administrator permission required'; end if;
 if new_stage is null or new_stage not in ('review','negotiation','agreement','progress','completed','suspended') or amount is null or amount<=0 or unit_currency is null or unit_currency !~ '^[A-Z]{3}$' or terms is null or length(trim(terms))<3 or reason is null or length(trim(reason))<3 then raise exception 'Add valid terms, amount, currency and reason'; end if;
 select owner_id into student from entries where id=entry and kind in ('assistance','idea') and status='approved';
 if student is null then raise exception 'Approve the assistance or idea submission first'; end if;
 perform pg_advisory_xact_lock(hashtextextended(entry::text,6));
 select id into agreement from funding_agreements where entry_id=entry order by created_at limit 1;
 if agreement is null then insert into funding_agreements(entry_id,student_id,stage,amount_minor,currency,conditions,approved_by) values(entry,student,new_stage,amount,unit_currency,terms,auth.uid()) returning id into agreement;
 else update funding_agreements set stage=new_stage,amount_minor=amount,currency=unit_currency,conditions=terms,approved_by=auth.uid() where id=agreement; end if;
 insert into audit_log(actor_id,entity_id,action,reason) values(auth.uid(),agreement,'funding.'||new_stage,trim(reason));
 insert into notifications(user_id,message) values(student,'Your funding case was updated. Open Support to review the terms.');
 return agreement;
end $$;

revoke all on function update_my_profile(text,text,text,text,text,boolean),follow_educator(uuid,boolean),set_educator_role(uuid,user_role,text),respond_account_request(uuid,text,text),revise_submission(uuid,text,text),save_plan_product(uuid,text,text,text),my_plan_access(),manage_funding(uuid,text,bigint,text,text,text) from public,anon;
grant execute on function update_my_profile(text,text,text,text,text,boolean),follow_educator(uuid,boolean),set_educator_role(uuid,user_role,text),respond_account_request(uuid,text,text),revise_submission(uuid,text,text),save_plan_product(uuid,text,text,text),my_plan_access(),manage_funding(uuid,text,bigint,text,text,text) to authenticated;
revoke all on function educator_directory() from public;
grant execute on function educator_directory() to anon,authenticated;
