// Reuses the existing app artwork in a code-rendered store layout.
const { chromium } = require("playwright");
const fs = require("node:fs");
(async () => {
  fs.mkdirSync("store/assets", { recursive: true });
  const icon = `data:image/png;base64,${fs.readFileSync("assets/icon-v2.png").toString("base64")}`;
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 512, height: 512 },
      deviceScaleFactor: 1,
    });
    await page.setContent(
      `<body style="margin:0;background:#2c5542"><img src="${icon}" style="display:block;width:512px;height:512px"></body>`,
    );
    await page.locator("img").evaluate((img) => img.decode());
    await page.screenshot({ path: "store/assets/icon-512.png" });
    await page.setViewportSize({ width: 1024, height: 500 });
    await page.setContent(
      `<html><style>*{box-sizing:border-box}body{margin:0;width:1024px;height:500px;background:#fafbf7;color:#244d41;font-family:Arial,sans-serif;display:flex;align-items:center;padding:70px;gap:52px}img{width:230px;height:230px;border-radius:36px}h1{font-size:58px;line-height:1.02;letter-spacing:-2px;margin:0 0 25px}p{font-size:25px;line-height:1.4;margin:0;color:#526654}.label{font-size:13px;letter-spacing:3px;font-weight:bold;margin-bottom:20px}</style><body><img src="${icon}"><main><div class="label">LEARN AT YOUR PACE</div><h1>Education<br>Forum</h1><p>Discover. Practise. Grow.</p></main></body></html>`,
    );
    await page.locator("img").evaluate((img) => img.decode());
    await page.screenshot({
      path: "store/assets/feature-1024x500.jpg",
      type: "jpeg",
      quality: 95,
    });
    console.log(
      "Created 512px store icon and 1024x500 feature graphic in store/assets.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
