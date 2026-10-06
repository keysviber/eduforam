const { withAppBuildGradle } = require("expo/config-plugins");
const fs = require("node:fs");
const path = require("node:path");

module.exports = (config) => withAppBuildGradle(config, (config) => {
  const marker = "// Education Forum upload signing";
  if (!config.modResults.contents.includes(marker)) {
    config.modResults.contents += "\n" + fs.readFileSync(path.join(__dirname, "upload-signing.gradle"), "utf8");
  }
  return config;
});
