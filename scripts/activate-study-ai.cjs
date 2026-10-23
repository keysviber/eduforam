const fs = require("node:fs");
for (const file of [".env", ".env.local"])
  if (fs.existsSync(file))
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
      if (m && !process.env[m[1]])
        process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1");
    }
(async () => {
  const ref = new URL(process.env.EXPO_PUBLIC_SUPABASE_URL).hostname.split(
    ".",
  )[0];
  if (!/^[a-z0-9]{20}$/.test(ref) || !process.env.SUPABASE_ACCESS_TOKEN)
    throw new Error("Missing management configuration");
  const query = process.argv.includes("--apply")
    ? `begin;
 update public.study_ai_settings set enabled=true where id;
 insert into public.audit_log(actor_id,action,reason,details) values(null,'study_ai.activate','Operator requested live Gemini activation',jsonb_build_object('provider','gemini'));
 commit;
 select enabled,daily_user_limit,daily_total_limit from public.study_ai_settings;`
    : "select enabled,daily_user_limit,daily_total_limit from public.study_ai_settings";
  const r = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        read_only: !process.argv.includes("--apply"),
      }),
      signal: AbortSignal.timeout(30000),
    },
  );
  if (!r.ok) throw new Error(`AI activation HTTP ${r.status}`);
  console.log(JSON.stringify(await r.json()));
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
