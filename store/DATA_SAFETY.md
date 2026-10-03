# Data safety working inventory

This is an implementation inventory for the owner to review, not a submitted declaration or a legal policy. Verify deployed services, logs, providers and retention before completing Play Console.

| Data | Current use/location | Review needed |
| --- | --- | --- |
| Email, account ID, authentication credentials | Supabase Auth signup/login/recovery; account administration | Account management collection; provider handling and logs; email delivery provider |
| Display name, grade, role | Supabase profiles; grade-based discovery and access control | Personal-information categories and purpose; avoid collecting unnecessary child identifiers |
| Submitted titles, descriptions, author names, PDFs/videos | Supabase database/private storage; approved entries become discoverable | Files/documents, videos and other user-generated content; public visibility and licenses |
| Saved books and classroom membership | Supabase bookmarks/membership tables | App activity, educational information and account-linked functionality |
| Private support text and administrator replies | Supabase support tables; user/admin access | Messages may contain sensitive information; staffed access, retention and child safeguards |
| Reports and audit history | Supabase reports/audit tables | Safety/abuse prevention; retention and administrator access |
| Language quiz progress | Device storage, separated per account | Currently local; not synced as an authoritative learning record |
| IP/service logs and pronunciation services | Hosting/Auth infrastructure and device-selected speech engine | Review actual providers and voice behavior; do not claim all processing stays on-device |

No visible payments, advertising or analytics integration is implemented in this release. Disabled financial schema is not evidence of payment collection. Review dependencies and the production environment before declaring no collection/sharing in any category.

HTTPS is configured for the backend, but do not declare encryption or deletion practices solely from a URL. Service-provider processing and user-directed publication need to be classified using Google's current definitions; neither automatically means all data is "shared" or "not shared".

The policy and external deletion page must identify Education Forum and its actual operator, explain data uses/recipients, public submissions, learner ages/consent, retention, deletion exceptions and a working contact. Choose real retention periods and response commitments before publishing. Do not use placeholder names or invent a legal basis.

Release blockers: published owner-approved pages, tested deletion operation, children/consent decision, hosted multi-account privacy tests and accurate Console declarations.

Reference: [Google Data safety guidance](https://support.google.com/googleplay/android-developer/answer/10787469).
