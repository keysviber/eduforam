// Inspect provider secret names only; never print secret values.
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
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/secrets`, {
    headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}` },
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`Secret inspection HTTP ${r.status}`);
  const names = (await r.json()).map((x) => x.name);
  console.log(
    `Hosted OPENAI_API_KEY configured: ${names.includes("OPENAI_API_KEY")}`,
  );
  console.log(
    `Hosted GEMINI_API_KEY configured: ${names.includes("GEMINI_API_KEY")}`,
  );
  if (process.argv.includes("--deploy")) {
    const form = new FormData();
    form.append(
      "metadata",
      JSON.stringify({
        name: "study-assistant",
        entrypoint_path: "study-assistant/index.ts",
        verify_jwt: false,
      }),
    );
    for (const path of [
      "study-assistant/index.ts",
      "_shared/http.ts",
      "_shared/study-contract.ts",
      "_shared/study-provider.ts",
      "_shared/study-gemini.ts",
    ])
      form.append(
        "file",
        new Blob([fs.readFileSync("supabase/functions/" + path)], {
          type: "application/typescript",
        }),
        path,
      );
    const deployed = await fetch(
      `https://api.supabase.com/v1/projects/${ref}/functions/deploy?slug=study-assistant`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
        },
        body: form,
        signal: AbortSignal.timeout(60000),
      },
    );
    if (!deployed.ok)
      throw new Error(
        "Study assistant deployment HTTP " +
          deployed.status +
          ": " +
          (await deployed.text()).slice(0, 1500),
      );
    const info = await deployed.json();
    console.log(
      JSON.stringify({
        slug: info.slug,
        status: info.status,
        version: info.version,
        verify_jwt: info.verify_jwt,
      }),
    );
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
