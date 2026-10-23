> Latest review: [23 October 2026 requirement-by-requirement acceptance and remaining launch inputs](REQUIREMENTS_ACCEPTANCE.md). The dated evidence below describes the previous snapshot.

# Update status — 22 October 2026

This is the current review checklist for all 35 items in COMPLETE-REQUIREMENTS.txt, plus admin signup. The original requirements remain intact. Source locations below identify implementation to review; they do not certify every feature as release-ready.

## Admin signup

- Signup offers Student, Teacher and Admin. Admin selection creates a pending request with an ordinary student role.
- Confirm the email and open Settings → Admin access to see the request and decision.
- An existing active owner opens the administration screen → Admin access requests, enters a reason, and approves or rejects the applicant.
- Approved applicants sign out and sign in to load admin tools. Regular admins cannot appoint other admins. Suspended applicants cannot be approved. Decisions generate an audit record and in-app notification.
- Signup now sends the chosen username, education system and education level to Auth.
- Migration 011_admin_signup.sql is deployed to the connected Supabase project. A subsequent inspection reported no pending migrations.
- First-owner setup is complete. The replacement account explicitly designated by the operator was confirmed, active and promoted to `owner`; a subsequent live lookup verified the saved role. The change has an `owner.bootstrap` audit record. Sign out and back in to load owner tools.
- First-owner setup remains a trusted operator action: verify the operator's account identity and assign its profile role to `owner` in the Supabase SQL editor. Public signup cannot create an owner. Do not grant owner status to arbitrary applicants.

## Complete update review list

### AI study assistant addition

Explain topics, summarise notes and create five-question practice sets are implemented, with owner controls and daily quotas. Migration 012 and the Gemini-enabled Edge Function are deployed. **Gemini is configured and enabled**, with live provider checks passing in all three modes. Limits remain 10 requests per learner and 100 per school per UTC day. See [setup and validation details](AI_STUDY_ASSISTANT.md).

All rows below still require final acceptance on the intended devices and hosted services. Source coverage is not a claim that all requested behavior has passed acceptance.

| # | Requested update | Implementation / acceptance focus |
|---|---|---|
| 1 | Direct chat | src/Chat.tsx; test two real accounts and isolation |
| 2 | Language chat board | src/Chat.tsx and App.tsx; verify language filtering |
| 3 | Usernames | Signup metadata repaired; src/IdentitySettings.tsx; verify uniqueness errors |
| 4 | Profile pictures and About Me | src/IdentitySettings.tsx and src/FeatureWorkflows.tsx; hosted upload/read |
| 5 | Leaderboard names | src/TimedQuiz.tsx and migration 009; populated leaderboard |
| 6 | Teacher classroom invitation link | src/SchoolFeatures.tsx; link opening and member roster |
| 7 | Video watermark | src/LessonVideo.tsx; visual overlay, not burned into exported video |
| 8 | Vertical talent feed | src/TalentFeed.tsx; device paging and active-video playback |
| 9 | Video share link | src/TalentFeed.tsx and src/content-links.ts; recipient opens shared content |
| 10 | Upload subject selection | App.tsx and src/education.ts; dropdown and saved subject |
| 11 | International education levels | src/education.ts, src/education-catalog.ts, migration 008; signup metadata repaired |
| 12 | Language voice changes | Partial: recorded audio administration and automatic device voice selection exist; learner-selectable voice controls still need implementation |
| 13 | Safe Room applications | src/IdentitySettings.tsx; private video and approval workflow |
| 14 | View password | App.tsx; signup/login/recovery visibility control |
| 15 | Admin question bank | src/QuizAdministration.tsx; create/edit bank and permissions |
| 16 | Three-grade quiz groups | migration 009 and src/QuizAdministration.tsx; group membership |
| 17 | 30-second quiz timer | src/TimedQuiz.tsx and migration 009; server deadline and device timing |
| 18 | Two quiz categories | src/TimedQuiz.tsx; speed/hard category behavior |
| 19 | Ten-question sets | migration 009; enough unseen published questions per group |
| 20 | Answer colours | src/TimedQuiz.tsx; correct/wrong feedback on device |
| 21 | Quiz sound/music | src/TimedQuiz.tsx and assets/audio; device audio and mute behavior |
| 22 | Classroom student view | src/SchoolFeatures.tsx; membership/resource restrictions |
| 23 | Teacher verification | src/IdentitySettings.tsx and migration 008; ID/video review and teacher access |
| 24 | Separate video lessons | App.tsx and src/TalentFeed.tsx; discovery separation |
| 25 | Learn video uploads | App.tsx; upload, moderation and playback |
| 26 | Settings | src/IdentitySettings.tsx and src/Theme.tsx; persistence and dark theme |
| 27 | Material author | App.tsx and submission policies; authenticated ownership |
| 28 | Notification permission | src/PushSettings.tsx; physical-device permission and delivery |
| 29 | Username symbol | Identity, classroom and community UI; visual consistency |
| 30 | Powered by Xenus | Settings and video UI; visual review |
| 31 | International support | Education catalog; country-specific signup and content matching |
| 32 | Date of birth | src/FormControls.tsx and signup validation; calendar and invalid dates |
| 33 | Country selection | Searchable signup selector and education catalog |
| 34 | Invitation links | src/SchoolFeatures.tsx and App.tsx; signed-out and signed-in link handling |
| 35 | Dropdown improvements | src/FormControls.tsx; mobile keyboard, search and selection |

## Verification and remaining release work

- Passed: TypeScript check, 16 unit tests, database integration suite including new admin authorization tests.
- Passed: migration deployment and subsequent hosted migration inspection.
- Passed: production web export and `node tests/admin-signup.browser.cjs` at mobile width. Browser test checks Admin selection, owner-approval explanation, username/education metadata and confirmation instructions using mocked Auth; it creates no live accounts and does not prove email delivery.
- Signed validation AAB 1.2.0 (versionCode 3) built successfully; upload signature and 32 native libraries' 16 KB ELF LOAD alignment passed. See [artifact details](AAB_RELEASE.md). Production policy/support/deletion URLs were deferred by the operator.
- Still required: real email confirmation and two-account owner approval acceptance, final acceptance for every row above, physical-device video/audio/push checks, provider/payment checks where enabled, and production release approval.
- Existing dated release documents describe older snapshots. This checklist supersedes their migration status for this update; older APK/AAB evidence does not cover the new code.
