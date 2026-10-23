// Authorized deployment helper. Defaults to inspection; --apply writes pending migrations.
// Secrets stay in process environment or ignored .env.local, never command arguments.
const fs = require("node:fs");
const crypto = require("node:crypto");
for (const file of [".env", ".env.local"]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m && !process.env[m[1]])
      process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1");
  }
}
async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token)
    throw new Error(
      "SUPABASE_ACCESS_TOKEN is missing. Add it to ignored .env.local or the process environment. The public app key cannot deploy.",
    );
  const ref = new URL(process.env.EXPO_PUBLIC_SUPABASE_URL).hostname.split(
    ".",
  )[0];
  if (!/^[a-z0-9]{20}$/.test(ref))
    throw new Error("Expected a hosted Supabase project URL.");
  async function api(path, method = "GET", body) {
    const r = await fetch(
      `https://api.supabase.com/v1/projects/${ref}/${path}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(120000),
      },
    );
    if (!r.ok)
      throw new Error(
        `Supabase ${path} returned HTTP ${r.status}. No credentials printed.`,
      );
    return r.json();
  }
  const query = (sql, read_only = true) =>
    api("database/query", "POST", { query: sql, read_only });
  const state = (
    await query(
      "select to_regclass('public.classrooms') is not null as baseline, exists(select 1 from information_schema.columns where table_schema='public' and table_name='entries' and column_name='video_format') as community, to_regclass('public.push_jobs') is not null as services",
    )
  )[0];
  if (!state.baseline)
    throw new Error(
      "Baseline schema is missing. Review SETUP.sql before installing this update.",
    );
  const pending = [];
  if (!state.community) pending.push("003_community.sql");
  if (!state.services) pending.push("004_services.sql");
  const quizRetry = await query(
    "select position('on conflict' in pg_get_functiondef(to_regprocedure('public.answer_quiz(integer,integer)'))) > 0 as installed",
  );
  if (!quizRetry[0].installed) pending.push("005_quiz_retry.sql");
  const workflows = await query(
    "select to_regclass('public.reader_progress') is not null as installed",
  );
  if (!workflows[0].installed) pending.push("006_feature_workflows.sql");
  const integrity = await query(
    "select exists(select 1 from pg_constraint where conname='store_product_single_target' and conrelid='public.store_products'::regclass) as installed",
  );
  if (!integrity[0].installed) pending.push("007_service_integrity.sql");
  const expanded = await query(
    "select to_regclass('public.direct_messages') is not null as identity, to_regclass('public.quiz_sets') is not null as quizzes",
  );
  if (!expanded[0].identity) pending.push("008_identity_community.sql");
  if (!expanded[0].quizzes) pending.push("009_timed_quiz.sql");
  const media = await query(
    "select to_regclass('public.pronunciation_audio') is not null as installed",
  );
  if (!media[0].installed) pending.push("010_learning_media.sql");
  const adminSignup = await query(
    "select to_regclass('public.admin_access_requests') is not null as installed",
  );
  if (!adminSignup[0].installed) pending.push("011_admin_signup.sql");
  const studyAI = await query(
    "select to_regclass('public.study_ai_settings') is not null as installed",
  );
  if (!studyAI[0].installed) pending.push("012_study_assistant.sql");
  console.log(`Pending migrations: ${pending.join(", ") || "none"}`);
  const owners = await query(
    "select count(*)::int as count from public.profiles where role='owner' and not suspended",
  );
  console.log(`Active owners available for admin approval: ${owners[0].count}`);
  if (process.argv.includes("--apply") && pending.length) {
    const sql = pending
      .map((name) => fs.readFileSync(`supabase/migrations/${name}`, "utf8"))
      .join("\n");
    await query(
      `begin; select pg_advisory_xact_lock(19472026); ${sql}\n notify pgrst, 'reload schema'; commit;`,
      false,
    );
    console.log(
      `Applied transaction; source SHA256 ${crypto.createHash("sha256").update(sql).digest("hex")}`,
    );
  }
  if (process.argv.includes("--auth")) {
    const desired = process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL;
    if (!desired)
      throw new Error(
        "Set EXPO_PUBLIC_AUTH_REDIRECT_URL to your HTTPS address, or educationforum://auth/callback for mobile only.",
      );
    const url = new URL(desired);
    if (
      desired !== "educationforum://auth/callback" &&
      (url.protocol !== "https:" ||
        ["localhost", "127.0.0.1", "example.com"].includes(url.hostname))
    )
      throw new Error("Use the real public HTTPS address.");
    const current = await api("config/auth");
    const allowed = new Set(
      String(current.uri_allow_list || "")
        .split(",")
        .filter(Boolean),
    );
    allowed.add(desired);
    allowed.add("educationforum://auth/callback");
    console.log(
      "Authentication redirect update prepared; existing allowlist entries are preserved.",
    );
    if (process.argv.includes("--apply")) {
      await api("config/auth", "PATCH", {
        site_url: desired,
        uri_allow_list: [...allowed].join(","),
      });
      const checked = await api("config/auth");
      if (checked.site_url !== desired)
        throw new Error("Hosted Site URL verification failed.");
      console.log(
        "Hosted Site URL and redirect allowlist verified. Request fresh confirmation emails.",
      );
    }
  }
  if (process.argv.includes("--smtp")) {
    const required = [
      "SMTP_HOST",
      "SMTP_PORT",
      "SMTP_USER",
      "SMTP_PASS",
      "SMTP_ADMIN_EMAIL",
      "SMTP_SENDER_NAME",
      "AUTH_EMAILS_PER_HOUR",
    ];
    const missing = required.filter((name) => !process.env[name]);
    if (missing.length)
      throw new Error(
        `Missing local email configuration: ${missing.join(", ")}. Use a verified SMTP provider.`,
      );
    const limit = Number(process.env.AUTH_EMAILS_PER_HOUR);
    const port = Number(process.env.SMTP_PORT);
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65535
    )
      throw new Error("Invalid SMTP port or hourly email limit.");
    const settings = {
      smtp_host: process.env.SMTP_HOST,
      smtp_port: String(port),
      smtp_user: process.env.SMTP_USER,
      smtp_pass: process.env.SMTP_PASS,
      smtp_admin_email: process.env.SMTP_ADMIN_EMAIL,
      smtp_sender_name: process.env.SMTP_SENDER_NAME,
      rate_limit_email_sent: limit,
    };
    console.log(
      "Custom SMTP update prepared. Email confirmation and abuse protections remain enabled.",
    );
    if (process.argv.includes("--apply")) {
      await api("config/auth", "PATCH", settings);
      const verified = await api("config/auth");
      if (
        verified.smtp_host !== settings.smtp_host ||
        Number(verified.rate_limit_email_sent) !== limit
      )
        throw new Error("SMTP configuration verification failed.");
      console.log(
        "Hosted SMTP configuration verified. Inbox delivery still requires a real confirmation and recovery test.",
      );
    }
  }
  if (!process.argv.includes("--apply"))
    console.log(
      "Inspection only. Use --apply to deploy; add --auth to update email redirects.",
    );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
