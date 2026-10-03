# Android education release 1.1.0

Current Play preparation, evidence and outstanding owner inputs: [store/RELEASE.md](../store/RELEASE.md). Supabase's eight app table checks now pass; the current APK remains debug-signed. Store listing assets and a Data safety working inventory are in `store/`.

Includes library, grade-based Home, ordered beginner language lessons with pronunciation, video lessons, invitation classrooms, private support and moderation. Funding, subscriptions and earnings remain hidden. See [1.1.0 setup and status](NEXT_RELEASE.md).

## Configuration required from the owner

1. Confirm `com.educationforum.app` is the final Android package identifier.
2. Link the app to the owner's Expo account with `npx eas-cli init`. Preserve
   the resulting project ID in app configuration or `EAS_PROJECT_ID`.
3. Deploy `supabase/migrations/001_platform.sql` followed by `002_learning_release.sql` to a fresh staging database,
   validate it there, then deploy to the selected production project. Set the
   public URL and public anon/publishable key from `.env.example` in the EAS
   **production** environment. Never bundle service-role keys.
4. In Supabase Auth, allow `educationforum://auth/callback` as a redirect URL.
   Configure email delivery and confirmation. Test both cold-start and
   already-open confirmation/recovery links on Android. The native callback
   handles Supabase's default implicit token redirects, not custom PKCE email
   templates. Test the password update and subsequent sign-in.
5. Publish real privacy, terms, support, and account-deletion request pages.
   Configure their four `EXPO_PUBLIC_*_URL` variables from `.env.example`.
   The deletion page must actually accept requests, verify the account owner,
   and have an operated deletion process covering Auth, database records,
   stored documents, and retention obligations. A link alone does not delete
   anything. These pages are not supplied or hosted by this repository.
6. Configure Android upload signing in the owner's EAS project. For an existing
   Play app, use its existing upload credentials. Keep keys and passwords out
   of source control and back up credentials securely.

Production EAS builds explicitly select the production environment and remote
version-code increments. They reject missing backend/page configuration and
privileged backend keys. Validation checks configuration shape, not deployment,
page availability, backend permissions, or operational readiness.

## Validation and build

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:database
npx.cmd expo export --platform android --platform web --output-dir dist
node scripts/serve-preview.cjs
# In a second terminal:
npm.cmd run test:browser
# After production environment and signing setup:
npm.cmd run production:android
```

Generated `android/` is ignored; durable native changes belong in Expo config
or config plugins. A local prebuild defaults to Android debug signing even for
the release build variant. Do not upload that artifact. Inspect the successful
EAS AAB's signing certificate against the selected upload key before submission.

## Required before Play rollout

- Staging tests with anonymous, student, suspended, and administrator accounts:
  authentication, session restore/expiry, private submission visibility,
  PDF upload/opening, moderation, saved books, and reporting.
- Real Android checks for offline/error recovery, keyboard, hardware Back,
  large text/TalkBack, file selection, app resume, and recovery links.
- Licensed launch content, administrator assignment and moderation operations,
  upload abuse/malware handling, monitoring, and tested backups/restore.
- Working deletion process and published owner-approved pages; complete Play
  listing, content rating, target audience and Data safety declarations based
  on actual deployed behavior. Student age/consent decisions remain with owner.
- Signed AAB and Play internal-track installation. No production rollout has
  been performed by this work.

Language samples save progress on the current device, separately per signed-in
user. They are not a full curriculum or synchronized learning records.

## Local verification on 22 September 2026

- TypeScript and all five unit tests passed.
- Database integration tests passed against PGlite with Supabase stubs; these
  do not replace deployed Supabase testing.
- Final Android Hermes and web exports passed.
- Chrome integration tests passed against the final export: four core tabs,
  search, reading, saved books, introductory quiz, lesson submission,
  moderation, navigation, small-screen layout, and reload persistence.
- `npm audit --omit=dev` reported zero vulnerabilities.
- Expo prebuild generated Android successfully. The manifest disables backup
  and removes microphone, legacy storage and overlay permissions.
- The production profile was verified to reject the absent Supabase URL.
- ADB reported no connected Android devices. Live backend and physical-device
  checks have not been performed.
- Local `:app:assembleRelease` and release lint passed. The validation APK is
  `android/app/build/outputs/apk/release/app-release.apk`. Certificate inspection
  confirmed `CN=Android Debug`; it is a demo-mode validation build, not a
  production-signed Play artifact. No production AAB has been created.

## Reference documentation

- [Expo EAS environment configuration](https://docs.expo.dev/eas/json/)
- [Expo version management](https://docs.expo.dev/build-reference/app-versions/)
- [Supabase native authentication](https://supabase.com/docs/guides/auth/quickstarts/react-native)
- [Expo permission configuration](https://docs.expo.dev/guides/permissions/)
