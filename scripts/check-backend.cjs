// Read-only connectivity checks. Never prints keys or user/content records.
const fs = require("node:fs");
for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
}
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key)
  throw new Error("Set the public Supabase URL and key in .env.");
async function check(path, label, auth = false) {
  try {
    const response = await fetch(`${url}${path}`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(20000),
    });
    const body = await response.json();
    const result = { check: label, status: response.status };
    if (!response.ok) {
      result.code = body.code;
      result.message = body.message || body.msg;
      process.exitCode = 1;
    } else if (auth) {
      result.signupDisabled = body.disable_signup;
      result.emailEnabled = body.external?.email;
      result.emailConfirmationRequired = !body.mailer_autoconfirm;
    }
    console.log(JSON.stringify(result));
  } catch (error) {
    console.log(
      JSON.stringify({
        check: label,
        error: error.cause?.code || error.message,
      }),
    );
    process.exitCode = 1;
  }
}
Promise.all([
  check("/auth/v1/settings", "Authentication", true),
  ...[
    "profiles",
    "entries",
    "classrooms",
    "classroom_members",
    "classroom_lessons",
    "support_settings",
    "support_requests",
    "bookmarks",
  ].map((table) => check(`/rest/v1/${table}?select=*&limit=0`, table)),
]);
