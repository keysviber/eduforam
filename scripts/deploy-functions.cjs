// Deploy only this repository's reviewed functions. Tokens remain in the environment.
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
for (const file of [".env", ".env.local"]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m && !process.env[m[1]])
      process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1");
  }
}
if (!process.env.SUPABASE_ACCESS_TOKEN)
  throw new Error("Management access is missing.");
const ref = new URL(process.env.EXPO_PUBLIC_SUPABASE_URL).hostname.split(
  ".",
)[0];
if (!/^[a-z0-9]{20}$/.test(ref)) throw new Error("Invalid project reference.");
const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  [
    "--yes",
    "supabase",
    "functions",
    "deploy",
    "purchase-sync",
    "revenuecat-webhook",
    "payout-account",
    "payout-transfer",
    "push-dispatch",
    "--project-ref",
    ref,
    "--use-api",
  ],
  { stdio: "inherit", env: process.env, shell: process.platform === "win32" },
);
process.exitCode = result.status ?? 1;
