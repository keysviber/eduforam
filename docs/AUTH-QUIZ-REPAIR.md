# Finish hosted email and Guru repairs

On 2026-10-13, hosted migrations 003, 004 and 005 were applied successfully. The live Guru questions endpoint returned HTTP 200 and a subsequent inspection reported no pending migrations. The hosted Site URL and redirect allowlist were verified for `educationforum://auth/callback`. Authenticated gameplay and physical-device email flows still require end-to-end verification.

The owner currently has no SMTP provider, domain, or published website. The local redirect is configured for the installed mobile app (`educationforum://auth/callback`). A website is not required for this native flow. A verified sending domain and SMTP provider are still needed for reliable production email. Supabase management access was supplied and saved in ignored `.env.local`. SMTP setup is still pending.

1. Set `SUPABASE_ACCESS_TOKEN` in ignored `.env.local` (never a public Expo variable).
2. Set `EXPO_PUBLIC_AUTH_REDIRECT_URL` to the deployed HTTPS app address. For a native-only release, use `educationforum://auth/callback`; opening that link requires the installed app. The helper preserves existing redirect allowlist entries.
3. Configure a verified SMTP provider in `.env.local`: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_ADMIN_EMAIL`, `SMTP_SENDER_NAME`, and `AUTH_EMAILS_PER_HOUR` at a limit supported by that provider. Do not commit credentials. Supabase's built-in mailer is not suitable for production signup/recovery traffic.
4. Inspect: `node scripts/deploy-services.cjs --auth --smtp`. Apply: `node scripts/deploy-services.cjs --apply --auth --smtp`. This installs missing community/services migrations and the quiz retry migration, updates Site URL and redirects, and configures SMTP. Do not run SETUP.sql on the existing database.
5. In Supabase email templates, retain `{{ .ConfirmationURL }}` as the verification link; remove hardcoded localhost links. Disable SMTP provider link tracking for authentication emails.
6. Rebuild the app with its public redirect variable, then request fresh emails. Previously issued emails retain their old destination.
7. Verify real signup, confirmation, sign-in, recovery and password update on the deployed web app and installed mobile app. Verify Guru answers persist after reload and duplicate requests do not increase scores. `node scripts/check-backend.cjs` verifies schema reachability, not authenticated gameplay or inbox delivery.

References: https://supabase.com/docs/guides/auth/auth-smtp and https://supabase.com/docs/guides/auth/redirect-urls

## Authentication verification

`node scripts/inspect-auth.cjs` reports non-secret hosted settings. The live project was verified to allow signup and require confirmation, with the mobile callback configured. No custom SMTP or email hook is configured; its sending limit is two emails per hour.

`node tests/auth.live.cjs` creates a temporary account through an admin-generated signup link, verifies confirmation, profile access, login, session refresh and password recovery, then deletes the test account. It does not send email or prove public signup email dispatch. Add `--browser` with a backend-connected export served on port 8080 to test the app screens too. The signup HTTP response is simulated in that browser check to avoid sending email; login and recovery use the real backend.

Export commands clear Metro caches because switching from a no-backend preview can otherwise retain the preview configuration. Rebuild and reinstall the mobile app to receive these source changes.

Verified on 2026-10-13: TypeScript and 16 unit tests passed. Live temporary-account tests passed confirmation enforcement, profile creation/RLS, password login, session refresh, recovery, old-password rejection and cleanup. Browser tests passed signup form/payload and pending confirmation with a simulated signup response; live login, session restoration after reload, sign-out, recovery callback and password update also passed. No confirmation/recovery email was sent, and installed-device deep links remain unverified. The backend-connected web export was checked for the public URL/key and absence of the management token.
