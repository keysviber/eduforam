# Android App Bundle release

The Google Mobile Ads 17.2.0 Gradle script reads an absent extra property when
`app.json` has no library configuration. The root-level `android_sdk: classic`
setting fixes this without editing node_modules. Expo still supplies the AdMob
application ID through its config plugin; Expo's extra-root-key warning is expected.

## Signing

Local prebuilds use `plugins/with-android-signing.cjs`. Release builds require
`.credentials/education-forum-upload.jks` and `android-upload.properties`.
Both files are ignored by Git. Back up the entire `.credentials` directory in
secure storage, including its password file. Do not regenerate the key after
uploading to Play. EAS manages signing separately; import this same upload key
if switching to EAS after the first upload.

For a new app only, `node scripts/create-upload-key.cjs` creates credentials and
refuses to overwrite existing ones. Never run it to replace an existing Play key.

## Build

```powershell
# Production: requires real backend and published page URLs in .env
powershell -ExecutionPolicy Bypass -File scripts/build-aab.ps1
# Compile/sign verification while production configuration remains incomplete:
powershell -ExecutionPolicy Bypass -File scripts/build-aab.ps1 -ValidationOnly
```

Artifacts are copied to `release-artifacts/education-forum-production.aab` or
`education-forum-validation.aab`. A validation artifact is not a launch approval.
The local build uses app.json versionCode; increment it before a subsequent Play
upload. EAS instead uses remote version management and auto-increment.

Before rollout, run `npm.cmd run check:play`, verify certificate and 16 KB native
library compatibility, install via Play internal testing, and complete device,
backend/auth, moderation, store declarations and account-deletion checks.
EAS project linking is needed only for the EAS build path.

Current production configuration lacks privacy, terms, support and account-deletion
URLs. Publish operated pages and set the four corresponding EXPO_PUBLIC_*_URL
variables; do not substitute placeholders merely to pass validation.
