# Activate the connected services

The code is implemented; no real ads, purchases, notifications or money transfers have been exercised. The management token and provider accounts are not configured in this checkout. Do not treat local tests as a live-service launch.

## 1. Database and email confirmation

Put `SUPABASE_ACCESS_TOKEN` in ignored `.env.local`. Keep the existing public project URL/key in `.env`. Add `EXPO_PUBLIC_AUTH_REDIRECT_URL` with the real HTTPS website origin, or `educationforum://auth/callback` for a mobile-only application.

Run `node scripts/deploy-services.cjs --auth` to inspect, then `node scripts/deploy-services.cjs --apply --auth` to apply pending migrations 003/004 atomically and update Supabase Site URL plus redirect allowlist. Existing allowlist entries are preserved. The helper refuses to invent a website address. Existing installations must not rerun SETUP.sql. An empty project can use SETUP.sql.

Request a fresh confirmation email after changing hosted settings. Verify it on a real device with the app installed. Documentation: https://supabase.com/docs/guides/auth/redirect-urls

## 2. Deploy Edge Functions and server-only secrets

Copy `supabase/functions.env.example` to ignored `.env.functions.local` and fill available values. Do not put service secrets in EXPO_PUBLIC variables. Supply the Supabase access token to the CLI environment (the CLI does not automatically read .env.local).

```
npx.cmd supabase secrets set --env-file .env.functions.local --project-ref YOUR_PROJECT_REF
npx.cmd supabase functions deploy --project-ref YOUR_PROJECT_REF
```

The functions validate either a logged-in active user or a dedicated server bearer secret. Public-key gateway JWT verification is disabled intentionally in config.toml; authentication remains inside each function.

## 3. Device notifications

Link the real EAS project ID, set Firebase/FCM credentials for Android and APNs credentials for iOS, and rebuild the native app. Configure `GOOGLE_SERVICES_JSON` as an EAS file secret for Android. Enable Expo push access-token security and configure `EXPO_ACCESS_TOKEN` on the server.

Set a random `PUSH_WORKER_SECRET` in Edge Function secrets. In Supabase Vault create `ef_push_worker_secret` with the same value and `ef_push_worker_url` with the deployed push-dispatch URL. Apply `scripts/schedule-push.sql` once. It runs every minute, with claim leases, capped attempts, receipt checking and invalid-token retirement. Inspect `push_jobs` for failed deliveries. Push text is generic: private Safe Room replies are never put on the lock screen.

Sign in on a physical device and enable notifications in Account. Verify denied permission, recovery through settings, registration retry, foreground/background delivery and logout. Expo tickets confirm acceptance; only receipts confirm provider handoff, and physical delivery must still be tested.

## 4. Store purchases and paid classrooms

Create non-consumable `remove_ads` products on Google Play and App Store Connect with a USD 1 target price. The client displays the storefront's local price; it does not invent a price if the product is unavailable. Use the same product identifier on both platforms, or adjust the mapping implementation before publishing different IDs.

Configure RevenueCat with the two store apps, public SDK keys, a private REST API key, and a `remove_ads` entitlement attached to **every** product. Each classroom also needs its own non-consumable product and unique entitlement (e.g. classroom_<UUID>). An administrator maps that product/entitlement to the classroom in Billing & creator operations. A creator's price tag alone does not create a store product; the admin must configure matching store pricing.

Set the RevenueCat webhook URL to revenuecat-webhook and its Authorization header to `Bearer <REVENUECAT_WEBHOOK_SECRET>`. Enable purchase, refund/cancellation, expiration, and transfer events. Configure restore behavior to keep purchases attached to the original app user ID unless an intentional account-transfer policy has been approved. App user IDs are Supabase user UUIDs; no anonymous purchase flow is used.

The server fetches authoritative RevenueCat data on purchase/restore and webhook. It replaces access atomically and ignores snapshots older than the latest sync. Sandbox transactions do not grant production access. Enable ALLOW_SANDBOX_PURCHASES only in a separate test backend. Test cancellation, failed verification with retry/restore, refunds and cross-account restores before enabling sales.

Any active verified mapped purchase removes ads. Refunded classroom purchases remove room access even if an old membership row remains. Published content elsewhere in the library remains public; buying a classroom grants room membership, not exclusivity over already-public resources.

## 5. Ads

Set AdMob app IDs and banner/native-video/rewarded unit IDs for both platforms. Configure privacy messages and ad-unit refresh in AdMob. Enable EXPO_PUBLIC_ADS_ENABLED only after a rebuilt test app works. Debug builds use Google test units. Production rejects missing/test IDs when ads are enabled.

There is one anchored banner above navigation; modal readers/forms show their own visible banner while the underlying one is unmounted. Reading has no other ad format. Native video-ad slots occur after every five reels; non-video inventory and failures are omitted. Ads must be configured to supply video inventory. There are no app-open or general interstitial ads.

The long-lesson offer explicitly asks to watch two rewarded ads for 30 minutes without ads in the current session. Skip leaves the lesson available. Completion of both SDK reward events grants the temporary benefit; this is not cash or Guru points. Consent is gathered before initializing/requesting ads, with conservative child-directed/under-age settings and G-rated inventory for this student audience. Confirm the actual target-audience declarations and allowed inventory in the provider accounts before launch.

## 6. Earnings and payouts

Set a positive administrator earning rate (displayed per 1,000 views). Viewing evidence requires foreground activity and at least 30 seconds; video requires playback. It is deduplicated per viewer/content/day, excludes the owner, and caps new daily sessions. This does not prove a human watched: an admin reviews qualified evidence before crediting money. Rate and currency are captured when the session starts; later rate changes do not rewrite it. Fractional per-view earnings accumulate without rounding away small amounts.

Creators see pending/approved/available totals and can request their available balance once above the configured minimum. Requests reserve funds transactionally to prevent duplicate withdrawals. Payout requests currently support two-decimal USD/EUR/GBP/ZAR; confirm provider support for the actual business and recipient countries first.

The optional Stripe Connect implementation requires a supported platform/recipient country, configured Connect onboarding and a funded platform Stripe balance. Set STRIPE_SECRET_KEY, STRIPE_CONNECT_COUNTRY and a real HTTPS PAYOUT_RETURN_URL. Store receipts do not automatically fund Stripe. The return page should explain that the creator returns to the app to continue/retry setup; the app always generates a fresh onboarding link. Stripe collects identity/bank information, so this data is not stored in the app database.

An administrator approves a payout in the dashboard. The function checks recipient capabilities and issues an idempotent transfer. `transferred` means funds moved to the connected payout account, **not** confirmed arrival in a bank. Bank settlement and failed bank payouts must be reconciled in Stripe. An unknown transfer result keeps the balance reserved; retry the same request. Automatic retry is blocked after 23 hours to prevent a new transfer after Stripe's idempotency window; reconcile its metadata payout_id with Stripe before any manual recovery. Never create a replacement request while a transfer result is uncertain.

Do not activate this provider until the business country and guardian/recipient requirements for student creators are confirmed. The ledger and payout requests can operate independently while the appropriate payout provider is selected.

## Validation completed locally

Tests cover: migration and RLS, server-only purchase grants, expired/sandbox entitlement rejection, stale snapshot rejection, refund-driven classroom revocation, push ownership/claim leases, duplicate quiz scores, self-view exclusion, timed activity review, fractional earnings, payout reservations and old-transfer retry blocking. Native SDKs require rebuilding the application; exports alone do not validate native installation, provider credentials, live payment or delivery.
