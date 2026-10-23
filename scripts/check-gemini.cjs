const fs = require("fs");
for (const file of [".env", ".env.local"])
  if (fs.existsSync(file))
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
      if (m && !process.env[m[1]])
        process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1");
    }
(async () => {
  const r = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models",
    {
      headers: { "x-goog-api-key": process.env.GEMINI_API_KEY },
      signal: AbortSignal.timeout(30000),
    },
  );
  const data = await r.json();
  console.log(
    JSON.stringify({
      status: r.status,
      errorStatus: data.error?.status,
      reasons: data.error?.details?.map((d) => d.reason).filter(Boolean),
      models: data.models
        ?.filter(
          (m) =>
            m.supportedGenerationMethods?.includes("generateContent") &&
            /flash/.test(m.name),
        )
        .map((m) => m.name),
    }),
  );
  if (!r.ok) process.exitCode = 1;
})().catch(() => {
  console.error(
    "Provider connectivity check failed; credential not displayed.",
  );
  process.exitCode = 1;
});
