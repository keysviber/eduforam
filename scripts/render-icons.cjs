const { chromium } = require("playwright");
const { readFileSync } = require("node:fs");
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1024, height: 1024 },
    deviceScaleFactor: 1,
  });
  for (const name of ["icon", "adaptive-icon"]) {
    await page.setContent(
      `<html><body style="margin:0;background:transparent">${readFileSync(`assets/${name}.svg`, "utf8")}</body></html>`,
    );
    await page.screenshot({ path: `assets/${name}.png`, omitBackground: true });
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
