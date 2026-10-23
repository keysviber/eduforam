// Prints only non-secret auth configuration; never user records or credentials.
const fs = require("node:fs");
for (const file of [".env", ".env.local"]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z_0-9]+)=(.*)$/);
    if (match && !process.env[match[1]])
      process.env[match[1]] = match[2].trim().replace(/^"(.*)"$/, "$1");
  }
}
(async () => {
  const ref = new URL(process.env.EXPO_PUBLIC_SUPABASE_URL).hostname.split(
    ".",
  )[0];
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/config/auth`,
    {
      headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}` },
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!response.ok) throw new Error(`Auth inspection HTTP ${response.status}`);
  const config = await response.json();
  console.log(
    JSON.stringify(
      {
        signupEnabled: !config.disable_signup,
        emailEnabled: config.external_email_enabled,
        confirmationRequired: !config.mailer_autoconfirm,
        customSmtpConfigured: !!config.smtp_host,
        emailHookConfigured: !!config.hook_send_email_enabled,
        emailsPerHour: config.rate_limit_email_sent,
        mobileSiteUrl: config.site_url === "educationforum://auth/callback",
        mobileRedirectAllowed: String(config.uri_allow_list)
          .split(",")
          .includes("educationforum://auth/callback"),
        minimumPasswordLength: config.password_min_length,
        captchaEnabled: config.security_captcha_enabled,
      },
      null,
      2,
    ),
  );
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
