# Education Forum 1.1.0 (build 2)

## Delivered in this version

- Home introduces video lessons, invitation classrooms, Safe Room and language learning.
- Create account and Log in are visible on Home and the account page, including preview mode. Signup validates email, password confirmation and grade. Login, email confirmation, recovery and logout use Supabase Auth when configured; the preview explicitly reports that no real account has been created.
- Sign-up requires Grade 1–7 or Form 1–6. The grade is created in the Supabase profile and can be changed on Home through a restricted RPC. Home recommendations include exactly that grade and its immediate neighbours, including Grade 7/Form 1. Missing grades and broad legacy levels do not receive recommendations. Library search and explicit video search remain available across grades.
- New book, lesson and video submissions require an exact grade. Videos require MP4/QuickTime attachments, with a 20 MB upload limit and administrator approval before discovery. The player uses private Storage signed URLs, native playback controls and no autoplay. Video links expire after an hour; reopen the lesson to renew access. Previously issued links remain valid until expiry even if content is removed.
- French, Dutch and Spanish each have four ordered beginner categories: greetings, polite words, numbers and everyday phrases. Each has three words/phrases and a three-question check. Completing a category unlocks the next. Pronunciation uses a matching installed device voice; unavailable voices show an explanation. Category progress is local to this device and account, not synced to Supabase.
- Administrators create classrooms and share random invitation codes. Learners join, open approved resources and leave. Administrators add/remove resources. Membership and content access are checked in PostgreSQL; students cannot enumerate other classrooms or add themselves without an invitation.
- Safe Room is private learner-to-administrator support, with request history, replies and closure. Other learners cannot read requests. It starts disabled. An administrator must enable it only when the school has assigned staff to respond. It is not emergency help or live chat. There are no push/email response notifications; learners return to the screen and refresh.
- Funding, subscriptions and earnings remain outside this release.

## Connect Supabase

1. For a fresh project, apply `supabase/migrations/001_platform.sql`, then `002_learning_release.sql`. For an existing installation of migration 001, apply only 002. Back up existing data and validate on staging first. These are ordered, one-time SQL migrations.
2. Copy `.env.example` to `.env`; set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` to the project URL and public key. Never use a service-role key in this app. Restart Expo after changes.
3. Configure Auth email delivery, confirmation and recovery. Allow `educationforum://auth/callback` plus the exact deployed web origin in Auth redirect URLs. Test confirmation, recovery and account switching on the installed app and web.
4. Create the operator account, then assign its `profiles.role` to `owner` from the trusted database console. Users cannot assign their own role. All non-suspended admin/owner accounts can access Safe Room requests; grant those roles only to authorised staff.
5. Existing users choose their grade on Home. Existing resources with broad levels stay searchable but are excluded from Home until an administrator assigns an exact grade in the database. No grade is guessed for live content.
6. Upload licensed grade-labelled resources and approve them. Create classrooms through the app's classroom screen while signed in as an administrator. Share invitation codes directly with the intended learners.
7. Decide the Safe Room operating policy, response hours, retention/deletion process and assigned staff before enabling requests. The current implementation assumes one school/operator per Supabase project; it does not isolate multiple schools' administrators.
8. Set the published privacy, terms, support and account-deletion URLs, link the EAS project, configure production signing, then build and test on the Play internal track. See `ANDROID_RELEASE.md`.

## Launch status

The supplied Supabase project is now configured in the ignored `.env`. Live Auth settings accepted the public key and confirmed email signup is enabled; the app tables are not yet deployed. See [connection status and dashboard steps](SUPABASE_CONNECTION.md). A local database test is not verification of deployed Auth, Storage, email or service operations. No signed production AAB or physical-device verification has been produced for 1.1.0.

Remaining launch gates: deployed backend verification; approved launch content; working deletion and legal/support pages; authorised moderation staff; production EAS/signing configuration; physical-device pronunciation, playback, auth-link and accessibility checks; store submission.

The dependency audit on 2026-10-02 reported four high-severity findings from the same `node-forge` signature-verification issue in Expo's CLI/signing dependencies (GHSA-86w9-cpqp-85rv). The registry's latest `node-forge` was 1.4.0, which the advisory still marks affected. No forced Expo downgrade or unsupported patch was applied. Recheck upstream remediation before release.

## Verification commands

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:database
npm.cmd run build:web
npm.cmd run build:native
node scripts/serve-preview.cjs
# Another terminal with Chrome installed:
npm.cmd run test:browser
```

Database integration runs both migrations with auth/storage stubs and exercises grade persistence, signup metadata validation, role protection, invitation membership, classroom isolation, private support, disabled service, administrator replies and suspended-user restrictions, alongside existing publication/storage checks.

## Local verification on 2026-10-02

- TypeScript passed; all nine unit tests passed.
- Both SQL migrations and the expanded database access-control tests passed in PGlite.
- Chrome integration passed at phone and desktop sizes, including category unlocking, pronunciation controls, Spanish navigation from Home, private submissions, approval, persistence, classroom/support demo boundaries, and grade-filtered video discovery with explicit cross-grade search.
- Signup/login browser checks passed: visible entry points, email validation, password confirmation, grade selection, and clear disconnected-service responses without falsely creating an account.
- Web export and Android/iOS JavaScript bundle exports passed. Browser screenshots in `docs/mobile-preview.png` and `docs/desktop-preview.png` reflect the updated Home.
- Version metadata matches across Expo, package, lockfile and generated Android configuration: 1.1.0, local build 2.
- `adb devices` listed no connected device. Physical playback and pronunciation remain unverified. Hosted Auth settings and the live-connection browser flow passed read-only checks; the database still reports missing tables, so account creation and data flows remain unverified.
- Android `:app:assembleRelease` and release lint passed after the signup update, using two Gradle workers. The APK is `android/app/build/outputs/apk/release/app-release.apk` (1.1.0 / 2). Certificate verification passed and identified `CN=Android Debug`. The APK was rebuilt with the supplied Supabase configuration; inspection confirmed both the project URL and public key in its packaged bundle. This is an installable connected test build, not a production-signed or Play-ready artifact. The hosted database setup remains outstanding. The generated native module registry includes both `SpeechModule` and `VideoModule`; the merged manifest retains `allowBackup=false` and excludes microphone/legacy storage permissions.

Implementation references: [Expo Speech](https://docs.expo.dev/versions/latest/sdk/speech/), [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).
