// NODE_PATH=/tmp/education-forum-tools/node_modules node tests/browser.integration.cjs
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    ...(process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : { channel: "chrome" }),
    headless: true,
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1080 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:8080");
  await page.getByText("Make room for discovery.").waitFor();
  await page.screenshot({ path: "docs/desktop-preview.png", fullPage: true });
  await page.getByRole("button", { name: "Explore the library" }).click();
  await page.getByLabel("Search library").fill("mathematics");
  await page
    .getByRole("button", { name: "Read The beauty of mathematics" })
    .click();
  await page
    .getByText("Chapter 1 · Finding patterns", { exact: false })
    .waitFor();
  await page
    .getByRole("button", { name: "Save for later", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Back to discovery", exact: false })
    .click();
  await page.getByText("Languages", { exact: true }).click();
  await page.getByRole("button", { name: "Begin lesson" }).first().click();
  await page.getByRole("button", { name: "Hello", exact: true }).click();
  await page
    .getByText("Correct! You completed this introductory lesson.")
    .waitFor();
  await page
    .getByRole("button", { name: "Back to learning", exact: false })
    .click();
  await page.getByText("Opportunities", { exact: true }).click();
  await page.getByRole("button", { name: "Submit your idea" }).click();
  await page
    .getByLabel("Title", { exact: true })
    .fill("Community science club");
  await page
    .getByLabel("Public description / purpose")
    .fill(
      "A student science club offering weekly practical experiments for learners.",
    );
  await page
    .getByRole("button", { name: "Submit for review", exact: true })
    .click();
  await page.getByText("Submitted for review.", { exact: false }).waitFor();
  assert.equal(
    await page.getByText("Community science club", { exact: true }).count(),
    0,
  );
  await page.getByText("Account & settings", { exact: true }).click();
  await page.getByText("Community science club", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Explore admin preview" }).click();
  await page
    .getByLabel("Review reason")
    .fill("Reviewed project purpose and information.");
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await page.getByText("Submission approved.", { exact: true }).waitFor();
  await page.getByText("Opportunities", { exact: true }).click();
  await page.getByText("Community science club", { exact: true }).waitFor();
  await page.reload();
  await page.getByText("Make room for discovery.").waitFor();
  await page.getByText("Account & settings", { exact: true }).click();
  await page.getByText("The beauty of mathematics", { exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByText("Overview", { exact: true }).click();
  await page.screenshot({ path: "docs/mobile-preview.png", fullPage: true });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
    false,
    "No horizontal page overflow",
  );
  assert.deepEqual(errors, []);
  await browser.close();
  console.log(
    "PASS: desktop/mobile render, library search, reading, bookmarks, language quiz, private submission, admin approval and persistence.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
