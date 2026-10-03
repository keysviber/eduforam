// Read-only smoke test for a web export configured with the real backend.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const url = fs
  .readFileSync(".env", "utf8")
  .match(/^EXPO_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]
  .trim();
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const entriesResponse = page.waitForResponse((response) =>
      response.url().startsWith(`${url}/rest/v1/entries`),
    );
    await page.goto("http://127.0.0.1:8080");
    await page
      .getByText("What will you learn today?", { exact: true })
      .waitFor();
    const response = await entriesResponse;
    console.log(`Live entries request status: ${response.status()}`);
    assert.equal(
      response.status(),
      200,
      "The deployed entries table must be available",
    );
    assert.equal(await page.getByText("DEMO", { exact: true }).count(), 0);
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByText("Create your account", { exact: true }).waitFor();
    await dialog.getByLabel("Email", { exact: true }).waitFor();
    await dialog.getByLabel("Confirm password", { exact: true }).waitFor();
    await dialog.getByRole("button", { name: "Form 4", exact: true }).click();
    assert.equal(
      await dialog
        .getByText(
          "Account registration and login are not available in this preview.",
          { exact: false },
        )
        .count(),
      0,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: live backend configured; signup and grade selection render; no account or email created.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
