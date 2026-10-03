// Read-only preflight; never prints credentials or uploads a build.
const fs = require("node:fs");
const { validateReleaseEnvironment } = require("./release-config.cjs");
if (fs.existsSync(".env")) process.loadEnvFile(".env");
const app = require("../app.json").expo;
const pkg = require("../package.json");
const lock = require("../package-lock.json");
const eas = require("../eas.json");
let failures = 0;
function report(ok, message) {
  console.log(`${ok ? "PASS" : "BLOCKED"}: ${message}`);
  if (!ok) failures++;
}
async function main() {
  report(
    app.version === pkg.version &&
      pkg.version === lock.version &&
      lock.packages[""].version === pkg.version,
    "App/package versions match",
  );
  report(
    eas.build.production.android.buildType === "app-bundle" &&
      eas.build.production.env.EXPO_PUBLIC_APP_ENV === "production",
    "Production build uses AAB and production configuration validation",
  );
  try {
    validateReleaseEnvironment(process.env);
    report(true, "Production environment validation");
  } catch (error) {
    report(false, error.message);
  }
  const project = process.env.EAS_PROJECT_ID || app.extra?.eas?.projectId;
  report(
    /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(project || ""),
    "EAS project linked (EAS_PROJECT_ID or expo.extra.eas.projectId)",
  );
  for (const name of ["PRIVACY", "TERMS", "SUPPORT", "ACCOUNT_DELETION"]) {
    const value = process.env[`EXPO_PUBLIC_${name}_URL`];
    if (!value) {
      report(false, `${name} page URL missing`);
      continue;
    }
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || url.username || url.password)
        throw new Error("A public HTTPS URL without credentials is required");
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      const text = await response.text();
      report(
        response.ok &&
          new URL(response.url).protocol === "https:" &&
          /text\/html/i.test(response.headers.get("content-type") || "") &&
          text.length > 200,
        `${name} page available as HTTPS HTML (HTTP ${response.status})`,
      );
    } catch {
      report(false, `${name} page could not be verified`);
    }
  }
  console.log(
    "Page availability does not verify policy accuracy or an operated deletion service.",
  );
  console.log(
    "Still verify: upload certificate, AAB/16 KB compatibility, device flows, content rights, Play declarations and testing eligibility.",
  );
  process.exitCode = failures ? 1 : 0;
}
main().catch(() => {
  console.error("Preflight failed unexpectedly.");
  process.exitCode = 1;
});
