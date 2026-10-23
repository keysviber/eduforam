# Ads setup and verification

The Android/iOS implementation supports an adaptive bottom banner, a native ad
beneath the paged talent feed, and an optional two-ad lesson offer. Both earned
reward callbacks grant 30 minutes without ads for the current app session. Closing
early grants no reward; completing the first ad preserves progress for a retry.
Lessons remain accessible without watching ads. Verified ad-free purchasers see
none of these placements. Web intentionally does not load the native ad SDK.

## Test ads

Set these public build settings in ignored `.env.local`:

```dotenv
EXPO_PUBLIC_ADS_ENABLED=true
EXPO_PUBLIC_ADS_TEST_MODE=true
```

Rebuild a validation Android app. Release-mode validation builds then use Google's
test units, as development builds do. Test mode cannot be enabled in a production
ads build. The existing 1.2.0 build 3 AAB predates these fixes; rebuild before testing.

## Live ads

Supply the Education Forum Android AdMob app ID (`ca-app-pub-…~…`) and three
ad-unit IDs (`ca-app-pub-…/…`) in `ADMOB_ANDROID_APP_ID`,
`EXPO_PUBLIC_ADMOB_ANDROID_BANNER`, `EXPO_PUBLIC_ADMOB_ANDROID_NATIVE`, and
`EXPO_PUBLIC_ADMOB_ANDROID_REWARDED`. Set `EXPO_PUBLIC_ADS_TEST_MODE=false`.
Configure the matching iOS IDs before an iOS release. Android-only builds validate
Android IDs; an unspecified-platform build validates both platforms.

Complete AdMob app/account readiness and Privacy & messaging configuration.
The current app conservatively treats all ad requests as child-directed and
under-age, restricts content to G, and requests non-personalized ads. Keep the
AdMob audience configuration consistent with this behavior. Publish accurate
app privacy information before launch.

Consent controls SDK initialization. Privacy-choice updates remove existing ads
and recheck eligibility. Banners and native requests retry after 60 seconds on
failure; native assets are destroyed when hidden/unmounted. Native creatives may
contain video or images. No fill hides the placement without blocking content.

## Acceptance

23 October 2026: TypeScript and Android Hermes bundle export with test ads enabled
passed. The 30-test suite passed, followed by a passing additional production-ID
configuration test (five targeted ad tests total). No Android device was connected;
native rendering, live fill and revenue are not verified. AdMob IDs remain unset.

- On Android, verify test labels, banner sizing and native media/AdChoices/CTA.
- Close an optional ad early; ensure the lesson remains usable and no reward is granted.
- Complete one ad, fail/close the second, retry, then complete it; check 30-minute suppression.
- Navigate away while loading and return; no late full-screen ad should appear.
- Exercise offline/reconnect, app background/foreground, and consent choices.
- Verify a server-confirmed ad-free purchase suppresses every placement.
- Repeat with live configuration on registered test devices before rollout.

Automated reward lifecycle tests cover completion, early close, cancellation,
timeout, and synchronous/asynchronous SDK failure. They do not prove AdMob fill
or native device rendering. See the [SDK consent guide](https://docs.page/invertase/react-native-google-mobile-ads/european-user-consent)
and [native ad guide](https://docs.page/invertase/react-native-google-mobile-ads/ad-formats/native).
