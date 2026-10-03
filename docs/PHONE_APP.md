# Run Education Forum as a phone app

Education Forum uses React Native views, text inputs, scrolling and modals on iOS and Android. There is no WebView wrapper. The browser is an optional preview of the same app.

## App experience

- Four core release tabs: Home, Library, Learn, You.
- Compact home, swipeable book shelf, two-column library, saved books and last-opened book.
- Ordered language categories with pronunciation, video lessons, invitation classrooms and private Safe Room support. Earnings, Premier and funding remain deferred. See [1.1.0 setup](NEXT_RELEASE.md).
- Screen back buttons, Android hardware back, iOS dismissible reader/submission sheets.
- Safe-area-aware layouts, keyboard-aware forms, pull-to-refresh and native selection haptics.
- Original home-screen icon, Android adaptive icon, and launch screen.

## Local development

```sh
npm ci
npm run ios
# Or, with Android Studio SDK + Java and a connected device/emulator:
npm run android
```

`ios` and `android` now **compile and install native development builds** using Expo, rather than only starting a browser preview. iOS requires Xcode and CocoaPods; Android requires the Android SDK and a compatible Java runtime. `npm start` starts Metro for the installed development app.

Native projects are generated from `app.json` using `npx expo prebuild`. The generated `ios/` and `android/` directories are ignored by Git; configuration, source assets and dependency versions are tracked so EAS can regenerate them.

## Installable Android APK

After signing in to your Expo account and linking this project:

```sh
npm run preview:android
```

The `preview` profile generates an APK intended for installation on Android phones, with JavaScript bundled inside. It does not require the development server. Download the APK from the successful EAS build and open it on the phone. The `production` profile instead produces an AAB for Play Store submission.

## iPhone installation

```sh
npm run preview:ios
```

This uses EAS internal distribution and requires Apple signing/provisioning and registered test devices. TestFlight/App Store distribution uses the production profile. An Android APK cannot be installed on an iPhone.

For an unsigned simulator build via EAS:

```sh
npx eas-cli build --profile simulator --platform ios
```

Build commands require account setup and may use your Expo build quota. No cloud build or store submission has been started in this task. No APK or IPA has been produced yet.

## Backend and launch status

For the current core Android release setup and validation, use
[ANDROID_RELEASE.md](ANDROID_RELEASE.md). Historical verification below predates
the core release scope and does not establish current Windows native readiness.

The app currently defaults to clearly labelled demo content unless Supabase environment variables are set. The visual/native redesign does not complete payment integrations or the unfinished product workflows in [RELEASE_READINESS.md](RELEASE_READINESS.md).

Verified native JavaScript exports are not the same as compiled, signed APK/IPA files. Physical-device testing is still required.

References: [Expo native CLI](https://docs.expo.dev/more/expo-cli/), [APK/internal distribution](https://docs.expo.dev/build/internal-distribution/), [iOS simulator builds](https://docs.expo.dev/build-reference/simulators/).

## Local verification (22 September 2026)

- TypeScript check passed.
- Web and iOS/Android JavaScript bundle exports passed.
- Native iOS and Android projects were generated successfully, including the supplied icons and splash configuration.
- Browser integration tests passed for all five tabs at 320px width, selected-tab accessibility, nested back navigation, reading resume, search, bookmarks, lessons, pending submissions, administrator approval and persistence.
- A standalone iPhone simulator binary was **not** compiled. Xcode 26.4 / iOS 26.4 simulator is present, but CocoaPods is absent. An isolated CocoaPods 1.16.2 installation failed because its dependency resolution selected FFI requiring Ruby 3+, while the system Ruby is 2.6.10. Installing a compatible FFI into `/tmp` did not resolve the subsequent installer dependency selection. No system Ruby was modified.
- Local compilation requires a supported Ruby/CocoaPods environment; cloud EAS builds avoid this local toolchain dependency but require an authenticated project. Neither route was completed to an installable binary in this task.
