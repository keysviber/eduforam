const fs = require('node:fs');
for (const file of ['.env','.env.local']) {
 if (!fs.existsSync(file)) continue;
 for (const line of fs.readFileSync(file,'utf8').split(/\r?\n/)) {
  const m=line.match(/^([A-Z_0-9]+)=(.*)$/);
  if(m && !process.env[m[1]]) process.env[m[1]]=m[2].trim().replace(/^"(.*)"$/,'$1');
 }
}
(async()=>{
 const ref=new URL(process.env.EXPO_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
 if(!/^[a-z0-9]{20}$/.test(ref)||!process.env.SUPABASE_ACCESS_TOKEN) throw new Error('Missing project configuration');
 const apply=process.argv.includes('--apply');
 const query=apply ? `begin;
 select pg_advisory_xact_lock(19472026);
 do $$ declare target uuid; current_role public.user_role; begin
 if (select count(*) from auth.users where lower(email)='educationforum36@gmail.com') <> 1 then raise exception 'Expected exactly one matching account'; end if;
 select p.id,p.role into target,current_role from public.profiles p join auth.users u on u.id=p.id where lower(u.email)='educationforum36@gmail.com' and not p.suspended for update of p;
 if target is null then raise exception 'Active profile not found'; end if;
 if current_role <> 'owner' then
 if exists(select 1 from public.profiles where role='owner' and not suspended) then raise exception 'Another active owner already exists; inspect before bootstrap'; end if;
 update public.profiles set role='owner' where id=target;
 insert into public.audit_log(actor_id,entity_id,action,reason,details) values(null,target,'owner.bootstrap','Account explicitly designated by operator in this session',jsonb_build_object('previous_role',current_role));
 end if;
 end $$;
 commit;
 select u.email,p.role,p.suspended,u.email_confirmed_at is not null as email_confirmed from auth.users u join public.profiles p on p.id=u.id where lower(u.email)='educationforum36@gmail.com';` : `select u.email,p.role,p.suspended,u.email_confirmed_at is not null as email_confirmed from auth.users u left join public.profiles p on p.id=u.id where lower(u.email)='educationforum36@gmail.com'`;
 const r=await fetch('https://api.supabase.com/v1/projects/'+ref+'/database/query',{method:'POST',headers:{Authorization:'Bearer '+process.env.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query,read_only:!apply}),signal:AbortSignal.timeout(30000)});
 if(!r.ok) throw new Error('Owner setup query failed: HTTP '+r.status);
 console.log(JSON.stringify(await r.json()));
})().catch(e=>{console.error(e.message);process.exitCode=1;});

