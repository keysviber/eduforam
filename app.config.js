const { validateReleaseEnvironment } = require("./scripts/release-config.cjs");

module.exports = ({ config }) => {
  const production =
    process.env.EAS_BUILD_PROFILE === "production" ||
    process.env.EXPO_PUBLIC_APP_ENV === "production";
  if (production) validateReleaseEnvironment(process.env);
  const projectId = process.env.EAS_PROJECT_ID || config.extra?.eas?.projectId;
  return {
    ...config,
    extra: {
      ...config.extra,
      ...(projectId ? { eas: { ...config.extra?.eas, projectId } } : {}),
    },
  };
};
