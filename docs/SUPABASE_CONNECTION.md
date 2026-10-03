# Connected project

Project: `https://nhjrbknlspvqedijnezf.supabase.co`.

The supplied public publishable key is saved in the ignored `.env`, using the app's `EXPO_PUBLIC_SUPABASE_ANON_KEY` variable. It is intended for the client. Never replace it with a secret/service-role key. See [Supabase API key guidance](https://supabase.com/docs/guides/getting-started/api-keys).

## Live read-only checks

The supplied URL/key returned HTTP 200 from the Auth settings endpoint. Email signup is enabled, and email confirmation is required. The application tables returned `PGRST205` / HTTP 404: `profiles`, `entries`, `bookmarks`, `classrooms`, `classroom_members`, `classroom_lessons`, `support_settings` and `support_requests` are absent from the exposed schema cache. No accounts, confirmation emails or remote data were created by these checks.

## Required dashboard setup

1. Open [this project's SQL Editor](https://supabase.com/dashboard/project/nhjrbknlspvqedijnezf/sql/new).
2. Paste and run the whole `supabase/SETUP.sql` file once. It installs both migrations in a transaction, creates the private submission bucket and RLS policies, and creates student profiles for existing Auth accounts without promoting metadata to staff roles. This file is for a project without the app schema; do not rerun it over an existing installation.
3. In [Auth URL configuration](https://supabase.com/dashboard/project/nhjrbknlspvqedijnezf/auth/url-configuration), add `educationforum://auth/callback` and the exact web origin you use. Set the Site URL to your real web app when published. Configure email delivery before opening registration broadly.
4. Create an account in the app, confirm the email, and log in. An operator must assign the first administrator/owner from the trusted SQL Editor as described in `NEXT_RELEASE.md`.
5. Recheck the connection with `node scripts/check-backend.cjs`. It requests zero rows and prints status codes/settings, never keys or content records.

## Build and browser validation

The web export loaded `.env` and passed the live-mode browser smoke test: the app requested this project's REST API, displayed signup and grade selection, and did not display the demo registration warning. The request returned 404 while the schema remained missing. No signup was submitted. Run this check with a server serving `dist` on port 8080: `node tests/backend.browser.cjs`.

The original `test:browser` script tests a demo export. Use the live-mode test above for an export containing `.env`; do not interpret a demo-fixture test failure against the connected app as a live authentication result.

The public key provides client access, not SQL administration. The setup file has been validated locally with the access-control tests; deployment must be performed in the project dashboard or through an authorised database-management connection.

`SETUP.sql` is generated from the canonical migrations by `node scripts/prepare-supabase.cjs`. If you later adopt Supabase CLI migration tracking, reconcile the manually applied migrations before running `db push`; see [migration guidance](https://supabase.com/docs/guides/deployment/database-migrations).

Android rebuild also passed for version 1.1.0 / build 2. The packaged APK contains the configured project URL and public key. Certificate verification identifies CN=Android Debug; this artifact is for testing and is not production-signed. A final read-only backend check still returned missing-table responses for all eight app tables. No real signup or confirmation email was submitted.
