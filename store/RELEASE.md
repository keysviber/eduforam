# Play release handoff — 2 October 2026

The app is not yet ready to submit. This file records current evidence and the remaining release steps; it supersedes older missing-database notes.

## Verified locally

- Version 1.1.0, Android code 2, package `com.educationforum.app`.
- Existing release manifest targets API 36, minimum API 24. Backup is disabled. No microphone, broad storage, overlay or advertising ID permissions appear in the merged manifest.
- APK ZIP alignment passed `zipalign -c -P 16 4`. All 30 packaged arm64/x86_64 libraries passed ELF LOAD alignment checks. These are static checks, not a 16 KB device test or a final AAB check.
- Existing APK signature is valid but uses `CN=Android Debug`; **do not upload it to Play**.
- TypeScript and all nine unit tests pass.
- The live-backend browser smoke test passes with an asserted HTTP 200 catalogue response, visible signup and grade selection, no demo fallback and no browser exceptions. It does not create an account or send an email.
- Supabase Auth and all eight checked app tables returned HTTP 200 after setup. This does not prove authenticated RLS, email delivery or full signup flows on the hosted project.
- Store icon and feature graphic generated from existing app artwork; see `LISTING.md`.
- `adb devices` lists no connected Android device, so physical-device validation remains open.
- `npm audit --omit=dev` still reports four high dependency findings rooted in `node-forge` advisory [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv), through Expo CLI/signing tooling. This is not a clean audit. Resolve with a compatible upstream patch or document an informed tooling-risk assessment before release; the suggested Expo 44 downgrade is not an appropriate automatic fix for this Expo 57 app.

## Required owner inputs

1. New or existing Play application. An existing app must retain its package and use its existing upload key. Do not generate a replacement without checking this.
2. Owner Expo project/account and Play Console access. Link with `npx.cmd eas-cli init` while signed into the correct account. Keep the resulting project UUID in Expo config or `EAS_PROJECT_ID`.
3. Developer identity, support email, launch countries and intended learner ages.
4. Published HTTPS privacy, terms, support and account-deletion pages. Configure `.env.example` variables in the EAS **production** environment as well as local build configuration. Local `.env` is ignored and is not proof of cloud build configuration.
5. Operated deletion process with verified identity, removal of Auth/profile/content/storage and a documented retention policy. Existing foreign keys may prevent simply deleting Auth users with uploaded content. Do not promise deletion until the complete workflow has been tested.

## Release sequence

1. Finish the above inputs. Review `DATA_SAFETY.md`, the launch catalogue and the children/consent requirements for the intended countries. Configure moderation and support staff; Safe Room must remain disabled if it is not staffed.
2. Configure Supabase redirect `educationforum://auth/callback`, production email delivery, and an administrator. Test signup/confirmation, cold and warm recovery links, sign-in/out and grade persistence on Android with controlled test accounts.
3. Run `npm.cmd run check:play`, `npm.cmd run check:backend`, `npm.cmd run typecheck`, `npm.cmd test` and `npm.cmd run test:database`. `check:play` reports missing local configuration; it cannot inspect secrets/settings in an unlinked EAS account. Page HTTP success alone is not policy approval.
4. Build with `npm.cmd run production:android`. The EAS production profile creates an AAB, increments the remote version code and enforces production environment validation. Use the owner's upload credentials; back them up outside source control. Do not use local Gradle's current debug-signing fallback for Play.
5. Inspect the resulting AAB's certificate against the Play upload certificate. Check its manifest, permissions and bundletool page alignment (`PAGE_ALIGNMENT_16K`); test the Play-generated APKs, not only the old local APK. `scripts/inspect-android.ps1` provides reusable APK ZIP/ELF/signature checks and rejects debug signing.
6. Install from Play internal testing. Verify playback, pronunciation, PDF picker/reader, session restore, Back, offline errors, large text/TalkBack, classroom membership and private support isolation. Test on a 16 KB emulator/device. Record actual device models and results.
7. Capture final phone screenshots, complete the listing, Data safety, audience/content rating and reviewer App access. Supply a dedicated review account and usable classroom/content access through Play Console, never in this repository.
8. Complete any Console-required closed testing and production-access application. Publish only after these gates pass. No upload or rollout has been performed.

## Current policy references

- [Target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878): API 36 applies to new standard mobile apps and updates at the time of this check.
- [16 KB support and validation](https://developer.android.com/guide/practices/page-sizes).
- [Account deletion](https://support.google.com/googleplay/android-developer/answer/13327111): in-app initiation and an external web resource are required for apps offering account creation.
- [Families policy](https://support.google.com/googleplay/android-developer/answer/9893335): evaluate the actual school-age audience and personal-data handling.
- [New personal account testing](https://support.google.com/googleplay/android-developer/answer/14151465): affected accounts require at least 12 continuously opted-in closed testers for 14 days before applying for production access. Follow the eligibility shown in the owner's Console.
