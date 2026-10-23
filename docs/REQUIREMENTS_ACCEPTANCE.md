# Complete requirements acceptance — 23 October 2026

The two supplied attachments are identical. All 35 requirements remain in scope, together with the existing admin signup, AI study assistant and AdMob work. This review distinguishes working local behavior from final device/provider acceptance. The app is **not yet cleared for a public production release**.

## Repairs made in this review

- Added per-user, per-language pronunciation voice selection, saved preferences, enhanced device-voice preference, a stop control, and cancellation of stale pronunciation requests.
- Corrected French and Spanish vocabulary and the human recording script.
- Kept quiz background music playing between questions; enabled it by default with the existing mute control and paused it when the app backgrounds or the set finishes.
- Prevented old chat responses from appearing after switching conversation/language; clear drafts and reports when changing conversation.
- Reloaded profile details after changing education system so an older profile form cannot restore the previous country.
- Made vertical video sizing fit its feed area and tightened shared-video identifier validation.
- Updated outdated browser selectors and isolated the demo export from the connected backend. Added role-based browser acceptance, international mapping/link tests, additional database permission checks and a read-only hosted readiness command.

## Requirement-by-requirement evidence

“Browser” below means the actual web UI with an isolated mocked API; “SQL” means migrations and RLS exercised in local PostgreSQL/PGlite. Neither substitutes for physical-device acceptance or real multi-user hosted media tests.

| # | Requirement | Evidence and remaining boundary |
|---|---|---|
| 1 | Direct chat | Browser send/recipient flow and SQL conversation isolation, blocking and sender permissions pass. Real two-device notification delivery remains open. |
| 2 | Language board | Browser language switching/send and SQL language filtering/forged-sender rejection pass. |
| 3 | Usernames | Signup metadata and settings UI tested; SQL case-insensitive uniqueness enforced. |
| 4 | Picture/About Me | Profile edit/save browser flow passes; private avatar ownership is enforced. Actual device image selection/upload/read still needs acceptance. |
| 5 | Named leaderboards | Browser and SQL use star-prefixed usernames rather than IDs. |
| 6 | Teacher invitation/roster | Browser teacher creation, automatic link population, joining and named roster pass. SQL restricts membership/resources. Installed-app link delivery still needs device proof. |
| 7 | Video watermark | Education Forum and Powered by Xenus overlays are implemented. This is an in-app overlay, not a watermark burned into downloaded source files. Device visual check remains. |
| 8 | Vertical talent feed | Separate paged talent feed, active playback and fitted video area implemented. Swipe/autoplay/audio acceptance remains on real phones. |
| 9 | Video sharing | Share includes a content link; link parsing/round-trip tests pass. Current links require the installed app; a public HTTPS website is not configured. |
| 10 | Upload subjects | Upload uses the predefined subject selector. |
| 11 | International equivalence | All six requested Zimbabwe/UK secondary mappings tested; SQL Year 12 maps to Form 5. |
| 12 | Human/custom voices | Saved voice selection works; admin recording upload and permission reference exist. Hosted count is **zero human recordings**. Supply recordings using VOICE-RECORDING-SCRIPT.md; no cloning model is required. |
| 13 | Safe Room applications | Video-required application UI and SQL review/approval permission gate pass. Actual media review still requires operator/device acceptance. |
| 14 | Show/hide password | Existing shared visibility control covers password and confirmation fields. |
| 15 | Question bank | Admin create/edit/delete browser flow passes; students cannot read answers or write questions through SQL. |
| 16 | Three-grade groups | SQL rejects invalid/overlapping groups; seven hosted groups each have three levels. |
| 17 | 30-second timer | SQL deadline/late-answer tests and browser automatic timeout submission pass. |
| 18 | Speed/hard categories | Named perfect-set speed leaderboard and monthly hard scoring tested. $15/$10/$5 reward rules exist. Review credits an earnings ledger; real withdrawal/settlement is not verified. |
| 19 | Ten-question sets | SQL snapshots have ten distinct questions; browser completes a set and displays the total. Wrong/late answers deduct three points. |
| 20 | Answer colours | Browser computed styles verify red selected wrong answers and green correct answers. |
| 21 | Quiz music/sounds | Looping beat plus correct/wrong effects implemented. Music continues between questions; actual native audio/mute/background behavior still needs device acceptance. |
| 22 | Student classroom view | Browser hides Create classroom for students; SQL denies unauthorized creation. |
| 23 | Teacher verification | Required ID/video, private review and approval gating implemented; SQL proves approved teacher posts publish instantly with account-owned attribution. |
| 24 | Video separation | Home/Video Lessons exclude talent; TalentFeed only selects approved talent reels. |
| 25 | Learn video uploads | Learning-material file picker accepts video, persists media type and uses the lesson player. Actual device upload/playback remains open. |
| 26 | Settings | Username, image, About Me, education and dark-theme controls present; browser save/selection flows pass. |
| 27 | Automatic author | SQL overrides forged author with authenticated account attribution; upload form has no author field. |
| 28 | Notification permission | Accept/decline prompt and registration/retry/settings UI implemented. **Expo project ID and device delivery setup are missing.** |
| 29 | Star usernames | Identity, chat, roster and leaderboard use ☆; browser/SQL checks cover these flows. |
| 30 | Xenus branding | Footer/settings/video overlays contain Powered by Xenus. |
| 31 | International support | Seven hosted systems, extensible catalog and canonical matching; no configured education level lacks a quiz group. |
| 32 | Birth-date calendar | Calendar selection used in signup browser checks; no manual date typing required. |
| 33 | Country list | Searchable country/education-system selector used in signup/settings. “Other / international” handles unlisted systems. |
| 34 | Invitation links | Same tested join flow as item 6; users do not manually enter codes. |
| 35 | Selectable categories | Country, date, subject, education level, quiz group and application type have selectable controls. |

## Validation completed

- TypeScript and all 38 unit tests passed.
- Expanded SQL/RLS integration suite passed.
- Student/teacher/admin acceptance and admin-signup browser tests passed with mocked APIs.
- Isolated demo browser regression passed, including navigation, reading, bookmarks, language review, submission approval and persistence.
- Web, Android and iOS JavaScript exports passed during this review; these are not new signed installation packages.
- The release preflight correctly remains blocked by the missing public policy pages and Expo project ID.

## Hosted checks

- Supabase connectivity checks returned HTTP 200; no pending migrations; one active owner is available for reviews.
- Four media buckets are private; relevant feature tables have row-level security enabled.
- All fourteen quiz pools (seven groups × two categories) contain 40 active questions each.
- A temporary hosted authentication account passed confirmation-token, login, refresh and password-recovery checks, then was deleted. **No email was sent; inbox delivery was not tested.**
- Custom SMTP is not configured. Email confirmation is required and the native auth callback is allowlisted.

## Remaining launch inputs and acceptance

1. The owner supplied **https://eduforum.co.zw/** as the intended website. On 23 October 2026, external HTTP checks failed with DNS `ENOTFOUND`; the root, query-link route and policy paths could not be inspected. Connect/register its DNS and hosting, publish the app and privacy/terms/support/deletion pages, then configure `EXPO_PUBLIC_SHARE_BASE_URL`. It is deliberately not activated while unreachable, preserving working installed-app links.
2. Supply/link the owner’s Expo/EAS project, configure push credentials, and test allow/decline plus actual notification delivery on a physical device.
3. Configure a verified SMTP sender for general-user email delivery and test a real inbox.
4. Supply consented human recordings if the app must use that voice. Device voices work in the meantime where installed.
5. Install a fresh native build and check video upload, talent paging, watermark, speech/audio, private application attachments, deep links and AdMob test placements. JavaScript export is not an APK/AAB or a device test.
6. Verify reward payouts with the chosen provider before promising cash withdrawal. Ledger-credit tests do not prove money settlement.

Run `npm.cmd run typecheck`, `npm.cmd test`, `npm.cmd run test:database`, `npm.cmd run build:web`, `npm.cmd run test:requirements`, and `npm.cmd run test:browser`. The last command builds an isolated demo; it intentionally blocks Supabase requests. Use `npm.cmd run check:requirements` for read-only hosted aggregates and `npm.cmd run check:play` for the remaining release configuration checks.

## Bringing eduforum.co.zw online

The existing web export can serve the public app; no second implementation is needed. Publish the contents of `dist` after `npm.cmd run build:web` to the selected web host, attach `eduforum.co.zw`, and apply the DNS records supplied by that host. Once HTTPS resolves, verify both the root page and `/?join=<classroom invitation>` / `/?video=<video UUID>` on a signed-out browser, then complete sign-in and check the destination. Set `EXPO_PUBLIC_SHARE_BASE_URL=https://eduforum.co.zw/` in local and production build environments only after that verification. Rebuild the mobile app to distribute the public link setting. Policy URLs must point to the actual published pages, not guessed paths.
