# Community update

Implemented locally: readable input hints, brighter gradient, explicit web confirmation redirect, signup identity fields, volume-only pronunciation, two more language units, video sharing/search, talent reels with instant publication, reviewed video lessons, likes/comments, admin-assigned moderators, in-app review/support notifications, quizzes with server-scored one-time answers and a global leaderboard, classroom price tags, and published administrator-controlled earning rates per 1,000 views.

## Deploy the database

For an existing installation with migrations 001 and 002, apply **only** `supabase/migrations/003_community.sql` in a transaction using the Supabase SQL editor. For an empty project use the regenerated `supabase/SETUP.sql`. Migration 003 has not been deployed by this change. Deploy it before releasing the updated client.

Teacher/student signup is an account description, not a staff privilege. An administrator grants moderator access in Users. Moderators can review/remove submissions and delete comments but cannot manage users, financial configuration or Safe Room messages. Removal unpublishes the resource and preserves its audit history. It does not erase the stored object.

Quiz points are not money. Twelve starter questions cover general knowledge, science and maths. A question can score once per account. Correct answers and explanations are not directly readable through the questions API. Dates of birth and surnames are not shown on the leaderboard.

## Confirmation emails and Safe Room

Set `EXPO_PUBLIC_AUTH_REDIRECT_URL` to the public HTTPS web origin. In Supabase Authentication > URL Configuration, set Site URL to the same origin and add the exact origin plus `educationforum://auth/callback` to Redirect URLs. Old confirmation emails may retain an old address; request a fresh email after updating configuration. Client code alone cannot change Supabase's hosted Site URL.

Reference: https://supabase.com/docs/guides/auth/redirect-urls

Safe Room now keeps the composer visible for signed-in users and explains unavailable support. An administrator must enable staffed support in Safe Room before requests can be sent. This change does not silently enable an unstaffed inbox.

## External work still required

- Notifications currently live inside the app. Device push registration, delivery service and credentials are not implemented.
- Talent reels use native video controls in a scrolling feed. Automatic playback, snap paging and trusted server-side duration inspection are not implemented. Uploaded video remains subject to the existing 20 MB limit.
- Earning rates are published, but trusted usage verification, accrual and payout processing are not implemented. No cash balance is fabricated from client views.
- Paid classrooms display USD prices, but paid enrolment is blocked until verified billing is connected. Free classrooms can be joined by invitation code.
- Ads and purchases are not integrated. Required: provider choice, ad app/unit IDs, store products, receipt verification, restore/refund handling and a signed native build. Target remove-ads price is USD 1, with the storefront's localized price displayed at checkout. Any verified app purchase should grant the no-ads entitlement; client flags must not grant it.
- Requested placements: one bottom banner across screens including book reading; one in-feed video ad after every five reels; no popup/interstitial ads elsewhere. Reserve space above navigation and in reader modals so a banner cannot cover controls. Suppress every placement for verified purchasers.
- Two rewarded ads before long videos must be an optional, clearly described offer with a skip path if AdMob is used. Skipping cannot prevent ordinary lesson playback. The reward and provider must be decided before implementing this flow.

AdMob reference: https://support.google.com/admob/answer/7313578?hl=en-GB

## Validation

Run `npm run typecheck`, `npm test`, `npm run test:database`, and `npm run build:web`. Database integration uses an isolated PostgreSQL-compatible engine and verifies role boundaries, private data, moderation, quiz score integrity, instant reel publication and paid-enrolment blocking. It does not prove hosted migration deployment, email delivery, device UX, ad delivery or store purchases.
