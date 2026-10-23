# Android AdMob setup and verification

The supplied Android app ID and all four ad unit IDs are configured in `.env.example` and `eas.json`. Local `.env.local` is also configured. Production uses real units; development and EAS preview builds use Google test units. iOS requires its own app and unit IDs before an iOS production build with ads enabled.

Placements:
- Banner: existing main screen banners, subject to consent and purchase access.
- Native advanced: sponsored card below the talent video feed.
- Rewarded: optional lesson offer; two earned-reward events grant 30 ad-free minutes for this app session. Closing early never earns the benefit. Completed progress is retained while the offer remains mounted.
- Interstitial: separate optional “Watch an ad” button on lesson videos. It grants no reward and is never automatically shown.

The SDK initializes after the consent check, with the existing child-directed, under-age and general-audience restrictions. Ad privacy choices remain available when required. Verified remove-ads access suppresses placements. Ad failures never block lesson playback. Full-screen requests are serialized and cancelled on component unmount.

## Build and device check

Use `npm.cmd run preview:android` for a native APK with test ads. Expo Go and the web build do not display these native ads. Changing app IDs requires a native rebuild; restarting Metro alone does not update an installed manifest.

On an Android device:
1. Check banner and native card rendering and ad attribution.
2. Open a lesson, choose Watch an ad, close it, and confirm playback remains usable.
3. Complete the rewarded offer and confirm banners/native/interstitial offers disappear for 30 minutes.
4. Close a rewarded ad early; confirm no benefit is granted. Retry, go offline, leave the lesson while loading, and background/return to the app.
5. Check ad privacy choices and an account with verified remove-ads access.

Use `npm.cmd run production:android` after the project release prerequisites are configured. In AdMob, confirm these IDs belong to the Android application, the app is ready to serve, and required Privacy & messaging settings are published. Complete the Play Console ads declaration. Account approval, live fill, impressions and revenue require verification in the actual account/device; local tests cannot prove them.

SDK reference: https://docs.page/invertase/react-native-google-mobile-ads
