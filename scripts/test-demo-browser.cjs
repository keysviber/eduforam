// Isolated preview build: never uses the connected project's credentials.
const { spawn } = require("node:child_process");
const env = { ...process.env, EXPO_NO_DOTENV: "1", EXPO_PUBLIC_APP_ENV: "preview", PREVIEW_ROOT: "dist-demo", PORT: "8081", TEST_BASE_URL: "http://127.0.0.1:8081" };
for (const name of Object.keys(env)) if (name.includes("SUPABASE") || name.startsWith("EXPO_PUBLIC_REVENUECAT")) delete env[name];
function run(command, args) { return new Promise((resolve, reject) => {
  const p = spawn(command, args, { env, stdio: "inherit", windowsHide: true });
  p.on("error", reject); p.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`Command failed (${code})`)));
}); }
(async () => {
  await run(process.execPath, ["node_modules/expo/bin/cli", "export", "--platform", "web", "--output-dir", "dist-demo", "--clear"]);
  const server = spawn(process.execPath, ["scripts/serve-preview.cjs"], { env, stdio: "inherit", windowsHide: true });
  try {
    for(let i=0;i<30;i++) { try { if ((await fetch(env.TEST_BASE_URL)).ok) break; } catch {} await new Promise(r=>setTimeout(r,200)); }
    await run(process.execPath, ["tests/browser.integration.cjs"]);
  } finally { server.kill(); }
})().catch(e => { console.error(e.message); process.exitCode=1; });
