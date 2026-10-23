// Validate before storing credentials remotely. Never print credentials or prompt bodies.
const fs = require("node:fs");
for (const file of [".env", ".env.local"])
  if (fs.existsSync(file))
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
      if (m && !process.env[m[1]])
        process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1");
    }
(async () => {
  const key = process.env.GEMINI_API_KEY,
    model = process.env.STUDY_GEMINI_MODEL || "gemini-3.5-flash-lite";
  if (!key)
    throw new Error(
      "GEMINI_API_KEY is missing from ignored local configuration.",
    );
  const checkedFetch = async (url, options) => {
    const r = await fetch(url, options);
    if (!r.ok) {
      const detail = await r
        .clone()
        .json()
        .catch(() => ({}));
      console.error(
        JSON.stringify({
          providerStatus: r.status,
          reason: detail.error?.status,
          message: String(detail.error?.message || "")
            .replaceAll(key, "[redacted]")
            .slice(0, 700),
        }),
      );
    }
    return r;
  };
  const { generateGeminiStudy } =
    await import("../supabase/functions/_shared/study-gemini.ts");
  for (const mode of ["explain", "summarise", "practice"]) {
    const output = await generateGeminiStudy(
      {
        mode,
        text: "Photosynthesis: green plants use sunlight, carbon dioxide and water to produce glucose and oxygen. Chlorophyll absorbs light in chloroplasts.",
      },
      "Form 1",
      key,
      model,
      checkedFetch,
    );
    console.log(
      JSON.stringify({
        mode,
        title: output.title,
        questionCount: output.questions.length,
        contentLength: output.content.length,
      }),
    );
  }
  if (!process.argv.includes("--apply")) {
    console.log("Provider checks passed. No hosted settings changed.");
    return;
  }
  const ref = new URL(process.env.EXPO_PUBLIC_SUPABASE_URL).hostname.split(
    ".",
  )[0];
  if (!/^[a-z0-9]{20}$/.test(ref) || !process.env.SUPABASE_ACCESS_TOKEN)
    throw new Error("Missing management configuration.");
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/secrets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      { name: "GEMINI_API_KEY", value: key },
      { name: "STUDY_AI_PROVIDER", value: "gemini" },
      { name: "STUDY_GEMINI_MODEL", value: model },
    ]),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`Hosted secret configuration HTTP ${r.status}`);
  console.log(
    "Gemini credential and provider settings saved in Supabase secrets. Assistant activation is a separate step.",
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
