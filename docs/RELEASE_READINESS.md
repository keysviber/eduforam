# Release readiness and specification coverage

This is an initial implementation, not a claim that the complete specification is delivered. External credentials are only one category of remaining work: several product workflows still need development.

## Implemented

- Shared native/web React Native UI, responsive desktop navigation and mobile navigation.
- Original education-first visual system and small, secondary community area.
- Library discovery with title/author/subject search, level filters, newest sorting, sample reader, bookmarks, PDF upload, private submission, approval, rejection, change requests, removal, and decision reasons.
- Supabase email sign-up/sign-in/sign-out and reset email request. Server-owned account roles; administrative permissions are checked inside RPCs.
- Local preview storage separated from live backend mode. No demo records are automatically uploaded to a real backend.
- Beginner French, Dutch, and Spanish vocabulary samples and quizzes with device-session/local demo progress.
- Helping Hands and Supporting Hands submissions and approved public listings; private attachment authorization.
- Subscription plan creation, pricing, benefits, activation/deactivation; persisted live plans displayed in Premier.
- Feature access and earnings policy configuration, user suspension, report submission/review, audit viewing.
- Central schema for payments, earnings, funding, language content, bookmarks, and progress; no client writes to financial records.
- Administrative actions use transactional SQL functions with audit records. Role escalation through client profile updates is blocked by lack of a write policy.
- Storage limits and private file access; non-public assistance files are never eligible for public signed URL access.

## Not complete — required before launch

### Core and library (specification 1–3, 21–26)

- Deploy and execute migrations in a staging Supabase project. Test policies with separate student, suspended, teacher, admin, and anonymous identities.
- Add cover upload, PDF page-position persistence, approved full-length licensed materials, view telemetry, recommendations, popular/most-viewed ranking, categories administration, and author discovery. The current catalogue offers title and newest ordering, not a recommendation engine.
- Add pending submission editing after change requests, orphaned-upload cleanup, malware scanning, duplicate upload handling, and richer moderation reasons.
- Add complete recovery deep-link/password update flow, account deletion, verification, profile editing, owner-controlled role assignment, MFA for admins, and session expiry/device testing.
- Add user warnings/bans, appeal workflows, reporting reasons, rate limiting, and pagination. Current admin lists fetch limited users/audit entries.
- Finish privacy/terms/contact/support screens, consent and age treatment appropriate to students, retention/deletion controls, accessibility checks, and localization. Determine launch jurisdictions with the owner.
- Book files already downloaded cannot be revoked. Signed URLs expire after 60 seconds; removing an entry blocks new access but does not invalidate previously issued URLs immediately.

### Learning (9, 22, 28)

- Actual teacher/tutor profiles, verification, discovery, educator follows/subscriptions, course catalogue and curriculum management.
- Admin-managed language and lesson screens, intermediate/advanced grammar/reading/listening content, media playback, lesson assessments, server-synced progress. Current language lesson samples are bundled introductions; they are not a full curriculum.
- Connect the `learning_progress` table to live lessons; local preview progress is not an authoritative learning record.

### Money and monetization (4–8, 10–11, 24–25)

- Implement a trusted checkout service and market/provider routing, server-priced orders, signed webhooks, receipt verification, retry/reconciliation jobs, unique event handling, and authorization for refunds.
- Integrate appropriate Apple/Google billing for digital subscriptions and content, including restore purchases and entitlement expiration. External payment requests must follow the applicable store rules and market permissions.
- Implement and validate PayPal, OPay, EcoCash and bank-transfer adapters only after merchant eligibility, country availability, currency settlement, credentials, and provider contracts are confirmed. A provider row is a placeholder, not an integration.
- Implement server-enforced premium entitlements. Configuring an access rule currently stores the rule; it does not gate every feature.
- Trusted activity aggregation, anti-abuse review, policy versioning, integer-money ledger entries, earned-balance reconciliation, approval/adjustment workflows, payout verification, payout limits, idempotent payout requests, and provider reconciliation.
- Never calculate payable balances using the client helper or trust client-reported views. `calculateEarnings` is a preview/test helper only.
- User/admin transaction lists, invoices/receipts, payment failure and refund screens. Current earnings screen intentionally displays no balance.
- Sensitive financial mutations must remain server-only and audited. Existing schema constraints do not substitute for a complete financial service.

### Student support (12–18)

- Structured private supporting details, funding-target administration, donation checkout/receipts/history, verified disbursement, assistance completion/suspension, and donor-approved public identity controls.
- Negotiation messaging, funding conditions and acceptance, staged release approvals, project milestones, progress evidence, and project completion. The database has agreements; there is no end-to-end funding workflow yet.

### Reels (19–21)

- Video duration validation, transcoding, playback, accessible captions, reactions, comments and moderation, creator blocking, finite viewing sessions, and storage/CDN cost controls. Current screen supports moderated submission but is not a video player.

### Advertising (27)

- Intentionally deferred as requested by the specification. No invented ad placements.

## Production operations

- Final branding assets, app icons, splash screens, support URL, privacy policy, terms and store metadata.
- Managed deployment, CI, migration rollback strategy, backups and restore drills, error monitoring, security review, load testing, production credentials and secret rotation.
- Real iOS/Android device testing (file selection, keyboard, safe areas, signed URL opening, accessibility, connectivity loss, auth persistence), followed by TestFlight / Play internal testing.
- Owner-selected package identifiers, Apple/Google developer accounts, signing, EAS configuration, and submitted store builds.
- Resolve or explicitly assess all dependency audit findings. Do not run a blind breaking `npm audit fix --force`.

## Approval policy verification to perform on staging

1. Student inserts an entry with `approved`: rejected.
2. Student inserts pending entry for another user: rejected.
3. Student updates role, monetization eligibility, balance, or transaction status: rejected.
4. Anonymous and unrelated users read pending entries/supporting documents: denied.
5. Student calls moderation/configuration RPC: rejected.
6. Admin review succeeds, creates exactly one audit record, and public discovery changes atomically.
7. Remove approved content and confirm new file access is denied to nonowners.
8. Suspended users cannot submit, report, or call administrator mutations.
9. Duplicate transaction idempotency key/provider reference: rejected.
10. Concurrent webhook/payout processing cannot create duplicate financial effects (requires the financial service first).

## Verification completed locally

- TypeScript strict check and three domain tests passed.
- PostgreSQL-compatible PGlite executed the full migration with Supabase auth/storage stubs. Integration checks passed for publication, authorization, private attachments, content removal, financial write denial, plans, account suspension and audits. A real Supabase staging test is still required.
- Headless Chrome verified desktop/mobile rendering, library search, reading, bookmarks, vocabulary quiz, private idea submission, admin approval, and reload persistence.
- Web production export and iOS/Android Hermes bundle exports passed. These are JavaScript bundles, not signed installable apps. Native signed binaries and physical device tests have not been performed.
- Expo SDK upgraded to 57 with its matching React Native modules. A targeted `xcode → uuid ^11.1.1` override preserves the v4 API and removes the transitive UUID advisory. npm reported zero vulnerabilities after installation.
