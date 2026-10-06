const { validateReleaseEnvironment } = require("./scripts/release-config.cjs");

module.exports = ({ config }) => {
  const production =
    process.env.EAS_BUILD_PROFILE === "production" ||
    process.env.EXPO_PUBLIC_APP_ENV === "production";
  if (production) validateReleaseEnvironment(process.env);
  const projectId = process.env.EAS_PROJECT_ID || config.extra?.eas?.projectId;
  const adsEnabled = process.env.EXPO_PUBLIC_ADS_ENABLED === "true";
  if (production && adsEnabled) {
    for (const name of [
      "ADMOB_ANDROID_APP_ID",
      "ADMOB_IOS_APP_ID",
      "EXPO_PUBLIC_ADMOB_ANDROID_BANNER",
      "EXPO_PUBLIC_ADMOB_IOS_BANNER",
      "EXPO_PUBLIC_ADMOB_ANDROID_NATIVE",
      "EXPO_PUBLIC_ADMOB_IOS_NATIVE",
      "EXPO_PUBLIC_ADMOB_ANDROID_REWARDED",
      "EXPO_PUBLIC_ADMOB_IOS_REWARDED",
    ]) {
      if (!process.env[name] || process.env[name].includes("3940256099942544"))
        throw new Error(`Production ads require your real ${name}.`);
    }
  }
  return {
    ...config,
    android: {
      ...config.android,
      ...(process.env.GOOGLE_SERVICES_JSON
        ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
        : {}),
    },
    plugins: [
      ...(config.plugins || []),
      "./plugins/with-android-signing.cjs",
      "expo-notifications",
      [
        "react-native-google-mobile-ads",
        {
          androidAppId:
            process.env.ADMOB_ANDROID_APP_ID ||
            "ca-app-pub-3940256099942544~3347511713",
          iosAppId:
            process.env.ADMOB_IOS_APP_ID ||
            "ca-app-pub-3940256099942544~1458002511",
          delayAppMeasurementInit: true,
        },
      ],
    ],
    extra: {
      ...config.extra,
      ...(projectId ? { eas: { ...config.extra?.eas, projectId } } : {}),
    },
  };
};
