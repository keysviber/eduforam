const { chromium } = require("playwright");
const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");
(async () => {
  const server = spawn(process.execPath, ["scripts/serve-preview.cjs"], {
    env: { ...process.env, PORT: "8092" },
    windowsHide: true,
    stdio: "ignore",
  });
  let browser;
  try {
    for (let i = 0; i < 50; i++) {
      try {
        if ((await fetch("http://127.0.0.1:8092")).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let signup;
    await page.route("https://*.supabase.co/**", async (route) => {
      if (route.request().url().includes("/rest/v1/education_systems"))
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([{ code: "ZW", name: "Zimbabwe" }]),
        });
      if (route.request().url().includes("/auth/v1/signup")) {
        signup = route.request().postDataJSON();
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            user: {
              id: "aaaabbbb-1111-4111-8111-111111111111",
              email: "admin@example.com",
              identities: [],
            },
            session: null,
          }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "[]",
      });
    });
    await page.goto("http://127.0.0.1:8092");
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .last()
      .click();
    await page.getByRole("button", { name: "Admin", exact: true }).click();
    await page
      .getByText("Admin access requires owner approval.", { exact: false })
      .waitFor();
    for (const [label, value] of [
      ["Name", "Test"],
      ["Surname", "Admin"],
      ["Username", "admin_candidate"],
      ["Email", "admin@example.com"],
      ["Password", "Secure-test-123!"],
      ["Confirm password", "Secure-test-123!"],
    ])
      await page.getByLabel(label, { exact: true }).fill(value);
    await page
      .getByRole("button", { name: "Date of birth", exact: true })
      .click();
    await page.getByRole("button", { name: "2005-01-01", exact: true }).click();
    await page.getByRole("button", { name: "Country", exact: true }).click();
    await page.getByRole("button", { name: /Zimbabwe/ }).click();
    await page
      .getByRole("button", { name: "Education level", exact: true })
      .click();
    await page.getByRole("button", { name: "Form 4", exact: true }).click();
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .last()
      .click();
    await page
      .getByText("Check your inbox for a confirmation link.", { exact: false })
      .waitFor();
    assert.equal(signup.data.account_type, "admin");
    assert.equal(signup.data.username, "admin_candidate");
    assert.equal(signup.data.education_system, "ZW");
    assert.equal(signup.data.education_level, "Form 4");
    assert.equal(signup.data.role, undefined);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: mobile-width admin signup, approval explanation, metadata and email confirmation (mocked Auth; no real account created).",
    );
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
