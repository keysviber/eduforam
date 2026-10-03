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
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  const accountDialog = page.getByRole("dialog");
  await page.getByText("Create your account", { exact: true }).waitFor();
  await page.getByLabel("Email", { exact: true }).fill("invalid");
  await accountDialog
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page
    .getByText("Enter a valid email address.", { exact: true })
    .waitFor();
  await page.getByLabel("Email", { exact: true }).fill("student@example.com");
  await page.getByLabel("Password", { exact: true }).fill("learning-password");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("different-password");
  await accountDialog
    .getByRole("button", { name: "Form 4", exact: true })
    .click();
  await accountDialog
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page
    .getByText("Your passwords do not match.", { exact: true })
    .waitFor();
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("learning-password");
  await accountDialog
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page
    .getByText(
      "Account service is not connected yet. No account has been created.",
      { exact: true },
    )
    .waitFor();
  await accountDialog
    .getByRole("button", { name: "← Back", exact: true })
    .click();
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.getByText("Welcome back.", { exact: true }).waitFor();
  await accountDialog
    .getByRole("button", { name: "Send password reset email", exact: true })
    .click();
  await page
    .getByText("Password reset is not available in this preview.", {
      exact: true,
    })
    .waitFor();
  await accountDialog
    .getByRole("button", { name: "← Back", exact: true })
    .click();
  assert.equal(
    await page.getByRole("tab", { name: "Support", exact: true }).count(),
    0,
  );
  assert.equal(
    await page.getByRole("button", { name: "Premier", exact: true }).count(),
    0,
  );
  await page.getByRole("button", { name: "Form 4", exact: true }).click();
  await page
    .getByRole("button", { name: "Join classroom", exact: true })
    .click();
  await page
    .getByText("This feature needs the school service", { exact: false })
    .waitFor();
  await page.getByRole("tab", { name: "Home", exact: true }).click();
  await page.getByRole("button", { name: "Safe Room", exact: true }).click();
  await page
    .getByText("No requests or memberships are sent in demo mode.", {
      exact: false,
    })
    .waitFor();
  await page.getByRole("tab", { name: "Home", exact: true }).click();
  await page.screenshot({ path: "dist/mobile-preview.png", fullPage: true });
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
  await page
    .getByRole("button", { name: "2. Polite words", exact: false })
    .isDisabled()
    .then((v) => assert.equal(v, true));
  await page.getByRole("button", { name: "Hello", exact: true }).click();
  await page.getByRole("button", { name: "Good evening", exact: true }).click();
  await page.getByRole("button", { name: "Goodbye", exact: true }).click();
  await page.getByText("Category complete!", { exact: false }).waitFor();
  await page
    .getByRole("button", { name: "2. Polite words", exact: false })
    .click();
  await page.getByText("French \u00b7 Polite words", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Listen to Merci", exact: true })
    .waitFor();
  await page.getByRole("tab", { name: "Learn", exact: true }).click();
  await page.getByRole("button", { name: "Submit a lesson" }).click();
  await page.getByRole("button", { name: "Form 4", exact: true }).click();
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
  await page.getByRole("tab", { name: "Learn", exact: true }).click();
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
  assert.equal(await tabBar.getByRole("tab").count(), 4);
  for (const label of ["Home", "Library", "Learn", "You"]) {
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
    .getByRole("button", { name: "Explore admin preview", exact: true })
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
  await page
    .getByRole("button", { name: "Start Spanish", exact: true })
    .click();
  await page.getByText("Spanish · Greetings", { exact: true }).waitFor();
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
  await page.screenshot({ path: "dist/desktop-preview.png", fullPage: true });
  assert.deepEqual(errors, []);
  const gradePage = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  await gradePage.addInitScript(() => {
    const entries = ["Grade 7", "Form 3", "Form 4", "Form 5", "Form 6"].map(
      (level, i) => ({
        id: `video-${i}`,
        owner_id: "demo",
        kind: "reel",
        title: `${level} science video`,
        description: "A detailed science lesson for this school grade.",
        category: "Science",
        author: "Test teacher",
        level,
        status: "approved",
        created_at: "2026-10-02",
        target: 0,
        raised: 0,
        color: "#244d41",
      }),
    );
    localStorage.setItem(
      "education-forum-demo-v1",
      JSON.stringify({ entries, grade: "Form 4" }),
    );
  });
  await gradePage.goto("http://127.0.0.1:8080");
  await gradePage.getByText("Your home - Form 4", { exact: true }).waitFor();
  for (const grade of ["Form 3", "Form 4", "Form 5"])
    await gradePage
      .getByText(`${grade} science video`, { exact: true })
      .waitFor();
  for (const grade of ["Grade 7", "Form 6"])
    assert.equal(
      await gradePage
        .getByText(`${grade} science video`, { exact: true })
        .count(),
      0,
    );
  await gradePage
    .getByRole("button", { name: "Search all video lessons", exact: true })
    .click();
  await gradePage.getByLabel("Search video lessons").fill("Grade 7");
  await gradePage.getByText("Grade 7 science video", { exact: true }).waitFor();
  assert.equal(
    await gradePage.getByText("Form 4 science video", { exact: true }).count(),
    0,
  );
  await gradePage.close();
  await browser.close();
  console.log(
    "PASS: fixed phone tabs, nested back navigation, compact desktop preview, continue reading, library search, reading, bookmarks, language quiz, private submission, admin approval and persistence.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
