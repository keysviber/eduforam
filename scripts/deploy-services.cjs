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
  console.log(`Pending migrations: ${pending.join(", ") || "none"}`);
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
  if (!process.argv.includes("--apply"))
    console.log(
      "Inspection only. Use --apply to deploy; add --auth to update email redirects.",
    );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
