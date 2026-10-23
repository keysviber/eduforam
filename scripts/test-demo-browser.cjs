const { spawn } = require("node:child_process");
const path = require("node:path");
function run(script, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      env,
      stdio: "inherit",
      windowsHide: true,
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Browser validation exited ${code}`)),
    );
  });
}
(async () => {
  await run(
    path.resolve("node_modules/expo/bin/cli"),
    ["export", "--platform", "web", "--output-dir", "dist-demo", "--clear"],
    {
      ...process.env,
      EXPO_NO_DOTENV: "1",
      EXPO_PUBLIC_APP_ENV: "development",
      EXPO_PUBLIC_SUPABASE_URL: "",
      EXPO_PUBLIC_SUPABASE_ANON_KEY: "",
      EXPO_PUBLIC_ADS_ENABLED: "false",
    },
  );
  const server = spawn(process.execPath, ["scripts/serve-preview.cjs"], {
    env: { ...process.env, PORT: "8095", PREVIEW_ROOT: "dist-demo" },
    windowsHide: true,
    stdio: "ignore",
  });
  try {
    for (let i = 0; i < 80; i++) {
      try {
        if ((await fetch("http://127.0.0.1:8095")).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
    await run("tests/browser.integration.cjs", [], {
      ...process.env,
      TEST_BASE_URL: "http://127.0.0.1:8095",
    });
  } finally {
    server.kill();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
