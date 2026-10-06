-- Push, verified purchases, classroom access and creator accounting.
create table public.push_devices(token text primary key check(token ~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$'), user_id uuid not null references profiles on delete cascade, updated_at timestamptz not null default now());
create table public.push_jobs(id uuid primary key default gen_random_uuid(), notification_id uuid not null references notifications on delete cascade, token text not null references push_devices on delete cascade, user_id uuid not null references profiles on delete cascade, status text not null default 'pending' check(status in ('pending','sending','receipt','delivered','failed')), attempts integer not null default 0, ticket_id text, next_attempt timestamptz not null default now(), last_error text, unique(notification_id,token));
alter table push_devices enable row level security;
alter table push_jobs enable row level security;
revoke all on push_devices,push_jobs from anon,authenticated;
grant all on push_devices,push_jobs to service_role;
create function register_push(device_token text) returns void language plpgsql security definer set search_path=public as $$ begin
 if not is_active() then raise exception 'Sign in with an active account'; end if;
 insert into push_devices(token,user_id) values(device_token,auth.uid()) on conflict(token) do update set user_id=excluded.user_id,updated_at=now();
 update push_jobs set status='failed',last_error='Device reassigned' where token=device_token and user_id<>auth.uid() and status in ('pending','sending','receipt');
end $$;
create function unregister_push(device_token text) returns void language sql security definer set search_path=public as $$ delete from push_devices where token=device_token and user_id=auth.uid() $$;
create function enqueue_push() returns trigger language plpgsql security definer set search_path=public as $$ begin
 insert into push_jobs(notification_id,token,user_id) select new.id,token,new.user_id from push_devices where user_id=new.user_id;
 return new;
end $$;
create trigger enqueue_push after insert on notifications for each row execute function enqueue_push();
create function claim_push_jobs() returns setof push_jobs language sql security definer set search_path=public as $$
 update push_jobs set status=case when ticket_id is null then 'sending' else 'receipt' end,attempts=attempts+1,next_attempt=now()+interval '5 minutes'
 where id in (select j.id from push_jobs j join push_devices d on d.token=j.token and d.user_id=j.user_id join profiles p on p.id=j.user_id and not p.suspended where j.status in ('pending','sending','receipt') and j.attempts<8 and j.next_attempt<=now() order by j.next_attempt for update of j skip locked limit 50) returning *
$$;

create table public.store_products(product_id text primary key, entitlement_id text not null unique, classroom_id uuid unique references classrooms on delete cascade, active boolean not null default true);
insert into store_products(product_id,entitlement_id) values('remove_ads','remove_ads');
create table public.purchase_access(user_id uuid references profiles on delete cascade,product_id text references store_products,expires_at timestamptz,verified_at timestamptz not null default now(),primary key(user_id,product_id));
create table public.purchase_sync(user_id uuid primary key references profiles on delete cascade,checked_at timestamptz not null);
alter table store_products enable row level security;
alter table purchase_access enable row level security;
alter table purchase_sync enable row level security;
create policy products_read on store_products for select using(active or is_admin());
create policy products_manage on store_products for all to authenticated using(is_admin()) with check(is_admin());
create policy access_read on purchase_access for select to authenticated using(user_id=auth.uid() and is_active());
grant select on store_products to anon,authenticated;
grant insert,update,delete on store_products to authenticated;
grant select on purchase_access to authenticated;
revoke all on purchase_sync from anon,authenticated;
grant all on store_products,purchase_access,purchase_sync to service_role;
create function sync_purchase_access(target_user uuid, snapshot jsonb, checked timestamptz) returns void language plpgsql security definer set search_path=public as $$ begin
 perform pg_advisory_xact_lock(hashtextextended(target_user::text,1));
 if exists(select 1 from purchase_sync where user_id=target_user and checked_at>checked) then return; end if;
 delete from purchase_access where user_id=target_user;
 insert into purchase_access(user_id,product_id,expires_at,verified_at) select target_user,p.product_id,nullif(v->>'expires_at','')::timestamptz,checked from jsonb_array_elements(snapshot) v join store_products p on p.product_id=v->>'product_id' and p.active where nullif(v->>'expires_at','') is null or (v->>'expires_at')::timestamptz>now();
 insert into purchase_sync values(target_user,checked) on conflict(user_id) do update set checked_at=excluded.checked_at;
end $$;
create function has_classroom_access(room_id uuid) returns boolean language sql stable security definer set search_path=public as $$
 select is_active() and (is_admin() or exists(select 1 from classrooms where id=room_id and owner_id=auth.uid()) or exists(select 1 from purchase_access a join store_products p using(product_id) where a.user_id=auth.uid() and p.classroom_id=room_id and p.active and (a.expires_at is null or a.expires_at>now())))
$$;
create or replace function in_classroom(room_id uuid) returns boolean language sql stable security definer set search_path=public as $$
 select is_active() and (is_admin() or exists(select 1 from classrooms where id=room_id and owner_id=auth.uid()) or exists(select 1 from classroom_members m join classrooms c on c.id=m.classroom_id where c.id=room_id and m.user_id=auth.uid() and (c.price_minor=0 or has_classroom_access(room_id))))
$$;
create function classroom_offer(invite_code text) returns table(id uuid,title text,price_minor integer,currency text,product_id text) language sql stable security definer set search_path=public as $$
 select c.id,c.title,c.price_minor,c.currency,p.product_id from classrooms c left join store_products p on p.classroom_id=c.id and p.active where is_active() and c.join_code=lower(trim(invite_code))
$$;
create or replace function join_classroom(invite_code text) returns uuid language plpgsql security definer set search_path=public as $$ declare room classrooms; begin
 if not is_active() then raise exception 'Sign in with an active account'; end if;
 select * into room from classrooms where join_code=lower(trim(invite_code));
 if not found then raise exception 'Invitation code not found. Ask your teacher for the full code.'; end if;
 if room.price_minor>0 and room.owner_id<>auth.uid() and not has_classroom_access(room.id) then raise exception 'Complete a verified purchase before joining this classroom'; end if;
 insert into classroom_members values(room.id,auth.uid()) on conflict do nothing; return room.id;
end $$;

-- Timed usage is evidence pending review, never a client-authorized cash credit.
create table public.content_usage(id uuid primary key default gen_random_uuid(),entry_id uuid not null references entries on delete cascade,viewer_id uuid not null references profiles on delete cascade,day date not null default current_date,started_at timestamptz not null default now(),last_seen timestamptz not null default now(),seconds integer not null default 0,policy_id uuid references earnings_policies,rate numeric(16,8) not null default 0,currency text not null default 'USD',status text not null default 'tracking' check(status in ('tracking','qualified','approved','rejected')),unique(entry_id,viewer_id,day));
create table public.creator_ledger(id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles,usage_id uuid unique references content_usage,amount numeric(20,8) not null check(amount>0),currency text not null,created_at timestamptz not null default now());
create table public.payout_accounts(user_id uuid primary key references profiles on delete cascade,stripe_account text unique not null,created_at timestamptz not null default now());
create table public.payout_requests(id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles,amount_minor bigint not null check(amount_minor>0),currency text not null,status text not null default 'requested' check(status in ('requested','processing','transferred','failed','cancelled')),provider_reference text unique,last_error text,created_at timestamptz not null default now());
alter table content_usage enable row level security;
alter table creator_ledger enable row level security;
alter table payout_accounts enable row level security;
alter table payout_requests enable row level security;
create policy usage_admin on content_usage for select to authenticated using(is_admin());
create policy ledger_read on creator_ledger for select to authenticated using(user_id=auth.uid() or is_admin());
create policy payouts_read on payout_requests for select to authenticated using(user_id=auth.uid() or is_admin());
create policy account_read on payout_accounts for select to authenticated using(user_id=auth.uid());
grant select on content_usage,creator_ledger,payout_accounts,payout_requests to authenticated;
grant all on content_usage,creator_ledger,payout_accounts,payout_requests to service_role;
create function begin_content_usage(content_id uuid) returns uuid language plpgsql security definer set search_path=public as $$ declare item entries; policy earnings_policies; usage_id uuid; begin
 if not is_active() then return null; end if;
 select * into item from entries where id=content_id and status='approved' and kind in ('book','course','reel');
 if not found or item.owner_id=auth.uid() then return null; end if;
 if (select count(*) from content_usage where viewer_id=auth.uid() and day=current_date)>=100 then return null; end if;
 select ep.* into policy from earnings_policies ep join profiles p on p.id=item.owner_id where ep.active and ep.role=(case when p.account_type='teacher' then 'teacher' else p.role::text end)::user_role order by ep.id limit 1;
 insert into content_usage(entry_id,viewer_id,policy_id,rate,currency) values(content_id,auth.uid(),policy.id,coalesce(policy.view_rate,0),coalesce(policy.currency,'USD')) on conflict(entry_id,viewer_id,day) do nothing returning id into usage_id;
 if usage_id is null then update content_usage set last_seen=now() where entry_id=content_id and viewer_id=auth.uid() and day=current_date returning id into usage_id; end if;
 return usage_id;
end $$;
create function heartbeat_content_usage(usage_id uuid) returns void language plpgsql security definer set search_path=public as $$ declare elapsed integer; item content_usage; begin
 if not is_active() then return; end if;
 select * into item from content_usage where id=usage_id and viewer_id=auth.uid() and status='tracking' for update;
 if not found then return; end if;
 elapsed:=floor(extract(epoch from now()-item.last_seen));
 -- Long gaps do not count as active reading/playback; calls cannot accelerate time.
 update content_usage set seconds=seconds+case when elapsed between 8 and 25 then elapsed else 0 end,last_seen=now(),status=case when seconds+case when elapsed between 8 and 25 then elapsed else 0 end>=30 then 'qualified' else 'tracking' end where id=usage_id;
end $$;
create function review_usage(usage_id uuid,approve boolean,reason text) returns void language plpgsql security definer set search_path=public as $$ declare item content_usage; owner uuid; begin
 if not is_admin() then raise exception 'Administrator permission required'; end if;
 if length(trim(reason))<5 then raise exception 'Explain the activity review'; end if;
 select * into item from content_usage where id=usage_id and status='qualified' for update;
 if not found then raise exception 'Qualified activity not found'; end if;
 select owner_id into owner from entries where id=item.entry_id and status='approved';
 if approve and (owner is null or item.rate<=0) then raise exception 'Published content and a positive rate are required'; end if;
 if approve then insert into creator_ledger(user_id,usage_id,amount,currency) values(owner,item.id,item.rate,item.currency); end if;
 update content_usage set status=case when approve then 'approved' else 'rejected' end where id=item.id;
 insert into audit_log(actor_id,entity_id,action,reason) values(auth.uid(),item.id,case when approve then 'usage.approved' else 'usage.rejected' end,reason);
end $$;
create function request_creator_payout(payout_currency text) returns uuid language plpgsql security definer set search_path=public as $$ declare available bigint; threshold bigint; result uuid; begin
 if not is_active() then raise exception 'Sign in with an active account'; end if;
 if payout_currency not in ('USD','EUR','GBP','ZAR') then raise exception 'Payout currency is not supported'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,2));
 select floor(coalesce(sum(amount),0)*100)::bigint into available from creator_ledger where user_id=auth.uid() and currency=payout_currency;
 available:=available-coalesce((select sum(amount_minor) from payout_requests where user_id=auth.uid() and currency=payout_currency and status in ('requested','processing','transferred')),0);
 select ep.minimum_payout_minor into threshold from earnings_policies ep join profiles p on p.id=auth.uid() where ep.active and ep.currency=payout_currency and ep.role=(case when p.account_type='teacher' then 'teacher' else p.role::text end)::user_role order by ep.id limit 1;
 if available<greatest(coalesce(threshold,1000),1) then raise exception 'Available balance is below the payout minimum'; end if;
 if not exists(select 1 from payout_accounts where user_id=auth.uid()) then raise exception 'Complete payout account setup first'; end if;
 insert into payout_requests(user_id,amount_minor,currency) values(auth.uid(),available,payout_currency) returning id into result;
 return result;
end $$;
alter table payout_requests add column attempted_at timestamptz;
create function claim_payout(request_id uuid) returns setof payout_requests language sql security definer set search_path=public as $$ update payout_requests set status='processing',last_error=null,attempted_at=coalesce(attempted_at,now()) where id=request_id and status in ('requested','processing') and (attempted_at is null or attempted_at>now()-interval '23 hours') returning * $$;

revoke all on function register_push(text),unregister_push(text),claim_push_jobs(),sync_purchase_access(uuid,jsonb,timestamptz),has_classroom_access(uuid),classroom_offer(text),begin_content_usage(uuid),heartbeat_content_usage(uuid),review_usage(uuid,boolean,text),request_creator_payout(text),claim_payout(uuid) from public,anon,authenticated;
grant execute on function register_push(text),unregister_push(text),has_classroom_access(uuid),classroom_offer(text),begin_content_usage(uuid),heartbeat_content_usage(uuid),review_usage(uuid,boolean,text),request_creator_payout(text) to authenticated;
grant execute on function claim_push_jobs(),sync_purchase_access(uuid,jsonb,timestamptz),claim_payout(uuid) to service_role;
create function creator_summary() returns table(currency text,earned numeric,pending numeric,available numeric) language sql stable security definer set search_path=public as $$
 with currencies as (select l.currency from creator_ledger l where l.user_id=auth.uid() union select u.currency from content_usage u join entries e on e.id=u.entry_id where e.owner_id=auth.uid())
 select c.currency,coalesce((select sum(l.amount) from creator_ledger l where l.user_id=auth.uid() and l.currency=c.currency),0),coalesce((select sum(u.rate) from content_usage u join entries e on e.id=u.entry_id where e.owner_id=auth.uid() and u.currency=c.currency and u.status='qualified'),0),greatest(0,floor(coalesce((select sum(l.amount) from creator_ledger l where l.user_id=auth.uid() and l.currency=c.currency),0)*100)/100-coalesce((select sum(p.amount_minor)/100.0 from payout_requests p where p.user_id=auth.uid() and p.currency=c.currency and p.status in ('requested','processing','transferred')),0)) from currencies c where is_active()
$$;
create function save_store_product(product text,entitlement text,room uuid,reason text) returns void language plpgsql security definer set search_path=public as $$ begin
 if not is_admin() then raise exception 'Administrator permission required'; end if;
 if length(trim(reason))<5 or length(trim(product))<3 or length(trim(entitlement))<3 then raise exception 'Product, entitlement and review reason required'; end if;
 if room is null and entitlement<>'remove_ads' then raise exception 'Non-classroom products must use remove_ads entitlement'; end if;
 insert into store_products(product_id,entitlement_id,classroom_id) values(product,entitlement,room) on conflict(product_id) do update set entitlement_id=excluded.entitlement_id,classroom_id=excluded.classroom_id;
 insert into audit_log(actor_id,action,reason,details) values(auth.uid(),'store.product',reason,jsonb_build_object('product',product,'classroom',room));
end $$;
revoke all on function creator_summary(),save_store_product(text,text,uuid,text) from public,anon;
grant execute on function creator_summary(),save_store_product(text,text,uuid,text) to authenticated;
