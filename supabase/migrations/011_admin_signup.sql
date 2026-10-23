-- Admin selection is a request, never a privileged role assignment.
create table public.admin_access_requests (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 reason text not null default '', reviewed_by uuid references public.profiles(id),
 created_at timestamptz not null default now()
);
alter table public.admin_access_requests enable row level security;
create function public.is_owner() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from profiles where id=auth.uid() and role='owner' and not suspended)
$$;
create policy admin_requests_read on public.admin_access_requests for select to authenticated
 using(public.is_active() and (user_id=auth.uid() or public.is_owner()));
grant select on public.admin_access_requests to authenticated;
create function public.capture_admin_signup() returns trigger language plpgsql security definer set search_path=public as $$ begin
 if exists(select 1 from auth.users where id=new.id and raw_user_meta_data->>'account_type'='admin') then
  insert into admin_access_requests(user_id) values(new.id);
 end if;
 return new;
end $$;
create trigger capture_admin_signup after insert on public.profiles for each row execute function public.capture_admin_signup();
create function public.review_admin_access(target_user uuid, approve boolean, decision_reason text) returns void
 language plpgsql security definer set search_path=public as $$ begin
 if not is_owner() then raise exception 'Owner permission required'; end if;
 if target_user=auth.uid() then raise exception 'You cannot review your own request'; end if;
 if approve is null or decision_reason is null or length(trim(decision_reason)) not between 5 and 2000 then raise exception 'Explain your decision in 5-2000 characters'; end if;
 perform 1 from admin_access_requests where user_id=target_user and status='pending' for update;
 if not found then raise exception 'Pending request not found'; end if;
 perform 1 from profiles where id=target_user and not suspended and role not in ('admin','owner') for update;
 if not found then raise exception 'An active non-administrative account is required'; end if;
 if approve then update profiles set role='admin' where id=target_user; end if;
 update admin_access_requests set status=case when approve then 'approved' else 'rejected' end,
 reason=trim(decision_reason),reviewed_by=auth.uid() where user_id=target_user;
 insert into audit_log(actor_id,entity_id,action,reason) values(auth.uid(),target_user,'admin_access.'||case when approve then 'approved' else 'rejected' end,trim(decision_reason));
 insert into notifications(user_id,message) values(target_user,'Your admin access request was reviewed. Open Settings for the decision.');
end $$;
revoke all on function public.review_admin_access(uuid,boolean,text) from public;
grant execute on function public.review_admin_access(uuid,boolean,text) to authenticated;
