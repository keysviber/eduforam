-- Verified staff roles determine earnings; store products have one access target.
create or replace function begin_content_usage(content_id uuid) returns uuid language plpgsql security definer set search_path=public as $$ declare item entries; policy earnings_policies; usage_id uuid; begin
 if not is_active() then return null; end if;
 select * into item from entries where id=content_id and status='approved' and kind in ('book','course','reel');
 if not found or item.owner_id=auth.uid() then return null; end if;
 if (select count(*) from content_usage where viewer_id=auth.uid() and day=current_date)>=100 then return null; end if;
 select ep.* into policy from earnings_policies ep join profiles p on p.id=item.owner_id where ep.active and ep.role=p.role order by ep.id limit 1;
 insert into content_usage(entry_id,viewer_id,policy_id,rate,currency) values(content_id,auth.uid(),policy.id,coalesce(policy.view_rate,0),coalesce(policy.currency,'USD')) on conflict(entry_id,viewer_id,day) do nothing returning id into usage_id;
 if usage_id is null then update content_usage set last_seen=now() where entry_id=content_id and viewer_id=auth.uid() and day=current_date returning id into usage_id; end if;
 return usage_id;
end $$;
create or replace function request_creator_payout(payout_currency text) returns uuid language plpgsql security definer set search_path=public as $$ declare available bigint; threshold bigint; result uuid; begin
 if not is_active() then raise exception 'Sign in with an active account'; end if;
 if payout_currency not in ('USD','EUR','GBP','ZAR') then raise exception 'Payout currency is not supported'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,2));
 select floor(coalesce(sum(amount),0)*100)::bigint into available from creator_ledger where user_id=auth.uid() and currency=payout_currency;
 available:=available-coalesce((select sum(amount_minor) from payout_requests where user_id=auth.uid() and currency=payout_currency and status in ('requested','processing','transferred')),0);
 select ep.minimum_payout_minor into threshold from earnings_policies ep join profiles p on p.id=auth.uid() where ep.active and ep.currency=payout_currency and ep.role=p.role order by ep.id limit 1;
 if available<greatest(coalesce(threshold,1000),1) then raise exception 'Available balance is below the payout minimum'; end if;
 if not exists(select 1 from payout_accounts where user_id=auth.uid()) then raise exception 'Complete payout account setup first'; end if;
 insert into payout_requests(user_id,amount_minor,currency) values(auth.uid(),available,payout_currency) returning id into result;
 return result;
end $$;
create or replace function save_store_product(product text,entitlement text,room uuid,reason text) returns void language plpgsql security definer set search_path=public as $$ begin
 if not is_admin() then raise exception 'Administrator permission required'; end if;
 if length(trim(reason))<5 or length(trim(product))<3 or length(trim(entitlement))<3 then raise exception 'Product, entitlement and review reason required'; end if;
 if room is null and entitlement<>'remove_ads' then raise exception 'Non-classroom products must use remove_ads entitlement'; end if;
 insert into store_products(product_id,entitlement_id,classroom_id) values(product,entitlement,room) on conflict(product_id) do update set entitlement_id=excluded.entitlement_id,classroom_id=excluded.classroom_id,plan_id=null;
 insert into audit_log(actor_id,action,reason,details) values(auth.uid(),'store.product',reason,jsonb_build_object('product',product,'classroom',room));
end $$;
alter table store_products add constraint store_product_single_target check (classroom_id is null or plan_id is null);
create policy remove_orphan_upload on storage.objects for delete to authenticated using(bucket_id='submissions' and (storage.foldername(name))[1]=auth.uid()::text and not exists(select 1 from public.entries e where e.file_path=name));
