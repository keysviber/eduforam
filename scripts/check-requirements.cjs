// Read-only hosted readiness checks. Prints aggregates, never user records or keys.
const fs = require("node:fs");
for (const file of [".env", ".env.local"]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z_0-9]+)=(.*)$/);
    if (match && !process.env[match[1]])
      process.env[match[1]] = match[2].trim().replace(/^"|"$/g, "");
  }
}
async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token)
    throw new Error(
      "SUPABASE_ACCESS_TOKEN is required for read-only inspection.",
    );
  const ref = new URL(process.env.EXPO_PUBLIC_SUPABASE_URL).hostname.split(
    ".",
  )[0];
  const query = `select json_build_object(
    'quiz_pools', (select json_agg(p) from (select g.name, g.levels, c.category, count(b.id)::int as active_questions from public.quiz_groups g cross join (values ('speed'),('hard')) c(category) left join public.quiz_bank b on b.group_id=g.id and b.category=c.category and b.active where g.active group by g.id,c.category order by g.name,c.category) p),
    'education_systems', (select count(*) from public.education_systems),
    'unmapped_education_levels', (select count(*) from public.education_levels e where not exists(select 1 from public.quiz_groups g where g.active and e.ordinal=any(g.levels))),
    'published_pronunciations', (select count(*) from public.pronunciation_audio where active),
    'private_buckets', (select json_agg(b) from (select id, public, file_size_limit from storage.buckets where id in ('avatars','verification','pronunciation','submissions')) b),
    'rls_enabled', (select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('profiles','direct_messages','language_messages','staff_applications','quiz_bank','quiz_sets','classrooms','classroom_members'))
  ) as readiness`;
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, read_only: true }),
      signal: AbortSignal.timeout(30000),
    },
  );
  if (!response.ok)
    throw new Error(
      `Read-only readiness query returned HTTP ${response.status}.`,
    );
  const result = (await response.json())[0].readiness;
  console.log(JSON.stringify(result, null, 2));
  if (
    !result.rls_enabled ||
    result.unmapped_education_levels ||
    result.quiz_pools.some((p) => p.active_questions < 10) ||
    result.private_buckets.length !== 4 ||
    result.private_buckets.some((b) => b.public)
  )
    process.exitCode = 1;
  if (!result.published_pronunciations)
    console.log(
      "Human pronunciation is awaiting owner-approved recordings; device voices remain available.",
    );
  console.log(
    `HTTPS sharing configured: ${!!process.env.EXPO_PUBLIC_SHARE_BASE_URL}`,
  );
  console.log(
    `Push project configured in environment: ${!!process.env.EAS_PROJECT_ID}`,
  );
  const authResponse = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000),
  });
  if (!authResponse.ok) throw new Error(`Auth configuration inspection returned HTTP ${authResponse.status}.`);
  const auth = await authResponse.json();
  console.log(JSON.stringify({
    custom_smtp_configured: !!(auth.smtp_host && auth.smtp_admin_email),
    email_confirmation_required: !auth.mailer_autoconfirm,
    native_auth_callback_allowed: String(auth.uri_allow_list || '').includes('educationforum://auth/callback'),
  }));
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
