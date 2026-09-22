// Serve dist on port 8080, then run npm run test:browser.
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
    viewport: { width: 390, height: 844 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:8080");
  await page.getByText("What will you learn today?").waitFor();
  await page.screenshot({ path: "docs/mobile-preview.png", fullPage: true });
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
  await page.getByRole("tab", { name: "Learn", exact: true }).click();
  await page.getByRole("button", { name: "Explore language lessons" }).click();
  await page.getByRole("button", { name: "Begin lesson" }).first().click();
  await page.getByRole("button", { name: "Hello", exact: true }).click();
  await page
    .getByText("Correct! You completed this introductory lesson.")
    .waitFor();
  await page
    .getByRole("button", { name: "Back to learning", exact: false })
    .click();
  await page.getByRole("tab", { name: "Support", exact: true }).click();
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
  await page
    .getByText("Submitted for review.", { exact: false })
    .first()
    .waitFor();
  assert.equal(
    await page.getByText("Community science club", { exact: true }).count(),
    0,
  );
  await page.getByRole("tab", { name: "You", exact: true }).click();
  await page.getByText("Community science club", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Explore admin preview" }).click();
  await page
    .getByLabel("Review reason")
    .fill("Reviewed project purpose and information.");
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await page.getByText("Submission approved.", { exact: true }).waitFor();
  await page.getByRole("tab", { name: "Support", exact: true }).click();
  await page.getByText("Community science club", { exact: true }).waitFor();
  await page.reload();
  await page.getByText("What will you learn today?").waitFor();
  await page.getByRole("tab", { name: "You", exact: true }).click();
  await page.getByText("The beauty of mathematics", { exact: true }).waitFor();
  await page.getByRole("tab", { name: "Home", exact: true }).click();
  await page
    .getByRole("button", { name: "Continue reading", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Back to discovery", exact: false })
    .click();
  await page.setViewportSize({ width: 320, height: 640 });
  const tabBar = page.getByRole("tablist");
  assert.equal(await tabBar.getByRole("tab").count(), 5);
  for (const label of ["Home", "Library", "Learn", "Support", "You"]) {
    const box = await tabBar
      .getByRole("tab", { name: label, exact: true })
      .boundingBox();
    assert.ok(
      box &&
        box.x >= 0 &&
        box.x + box.width <= 320 &&
        box.y + box.height <= 640,
      `${label} fits on a small phone`,
    );
  }
  await page.getByRole("tab", { name: "You", exact: true }).click();
  await page
    .getByRole("button", { name: "Student moments", exact: true })
    .click();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await page.getByText("Welcome, curious mind.", { exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole("tab", { name: "You", exact: true })
      .getAttribute("aria-selected"),
    "true",
  );
  await page.getByRole("tab", { name: "Home", exact: true }).click();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
    false,
    "No horizontal page overflow",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  const appWidth = await page.getByRole("tablist").boundingBox();
  assert.ok(appWidth.width <= 520, "Desktop preview keeps the app layout");
  await page.screenshot({ path: "docs/desktop-preview.png", fullPage: true });
  assert.deepEqual(errors, []);
  await browser.close();
  console.log(
    "PASS: fixed phone tabs, nested back navigation, compact desktop preview, continue reading, library search, reading, bookmarks, language quiz, private submission, admin approval and persistence.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
