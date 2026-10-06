-- Run only after push-dispatch is deployed and PUSH_WORKER_SECRET is in Edge Function secrets.
-- Create Vault secrets named ef_push_worker_secret (same value) and ef_push_worker_url
-- (https://<project>.supabase.co/functions/v1/push-dispatch) in Supabase Dashboard > Vault.
-- No token is stored in this SQL file or in the cron job text.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule(jobid) from cron.job where jobname='education-forum-push';
select cron.schedule('education-forum-push','* * * * *',$$
 select net.http_post(
  url:=(select decrypted_secret from vault.decrypted_secrets where name='ef_push_worker_url'),
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='ef_push_worker_secret')),
  body:='{}'::jsonb,timeout_milliseconds:=50000
 );
$$);
