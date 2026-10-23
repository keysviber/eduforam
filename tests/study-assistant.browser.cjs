const { chromium } = require("playwright");
const { spawn } = require("node:child_process");
const assert = require("node:assert/strict"),
  fs = require("node:fs");
const url = fs
  .readFileSync(".env", "utf8")
  .match(/^EXPO_PUBLIC_SUPABASE_URL=(.+)$/m)[1]
  .trim()
  .replace(/^"|"$/g, "");
const ref = new URL(url).hostname.split(".")[0];
(async () => {
  const server = spawn(process.execPath, ["scripts/serve-preview.cjs"], {
    env: { ...process.env, PORT: "8093" },
    windowsHide: true,
    stdio: "ignore",
  });
  let browser;
  try {
    for (let i = 0; i < 50; i++) {
      try {
        if ((await fetch("http://127.0.0.1:8093")).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const user = {
      id: "aaaabbbb-4444-4444-8444-444444444444",
      email: "ai-browser@example.com",
      aud: "authenticated",
      role: "authenticated",
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
    };
    const token = [
      "e30",
      Buffer.from(
        JSON.stringify({
          sub: user.id,
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      ).toString("base64url"),
      "test",
    ].join(".");
    await page.addInitScript(
      ({ ref, user, token }) =>
        localStorage.setItem(
          `sb-${ref}-auth-token`,
          JSON.stringify({
            access_token: token,
            refresh_token: "test-refresh",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            expires_in: 3600,
            token_type: "bearer",
            user,
          }),
        ),
      { ref, user, token },
    );
    let ready = true,
      rateLimit = false,
      calls = [];
    await page.route("https://*.supabase.co/**", async (route) => {
      const path = route.request().url();
      let data = [];
      let status = 200;
      if (path.includes("/auth/v1/user")) data = user;
      else if (path.includes("/rest/v1/profiles"))
        data = {
          id: user.id,
          role: "student",
          grade: "Form 1",
          education_level: "Form 1",
          education_ordinal: 8,
        };
      else if (path.includes("/functions/v1/study-assistant")) {
        const body = route.request().postDataJSON();
        if (body.action === "status")
          data = {
            ready,
            configured: ready,
            provider: "gemini",
            enabled: true,
            daily_limit: 10,
          };
        else {
          calls.push(body);
          if (rateLimit) {
            status = 429;
            data = { error: "Today's study assistant limit has been reached." };
          } else
            data = {
              remaining: 9,
              result: {
                title:
                  body.mode === "practice"
                    ? "Practice addition"
                    : body.mode === "summarise"
                      ? "Your summary"
                      : "Understanding addition",
                content: "Adding joins groups together.",
                questions:
                  body.mode === "practice"
                    ? Array.from({ length: 5 }, (_, i) => ({
                        prompt: `Addition question ${i + 1}`,
                        choices: ["One", "Two", "Three", "Four"],
                        answer: 3,
                        explanation: "Two plus two makes four.",
                      }))
                    : [],
              },
            };
        }
      }
      await route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    });
    await page.goto("http://127.0.0.1:8093");
    await page.getByRole("tab", { name: "Learn", exact: true }).click();
    await page
      .getByRole("button", { name: "AI study assistant", exact: true })
      .click();
    await page
      .getByText("Up to 10 requests per day.", { exact: false })
      .waitFor();
    await page
      .getByLabel("Study topic or notes")
      .fill("Explain how simple addition works.");
    await page
      .getByRole("button", { name: "Explain this topic", exact: true })
      .click();
    await page.getByText("Understanding addition", { exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Summarise notes", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Summarise my notes", exact: true })
      .click();
    await page.getByText("Your summary", { exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Practice questions", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Create practice questions", exact: true })
      .click();
    await page.getByText("Practice addition", { exact: true }).waitFor();
    assert.equal(
      await page
        .getByText("Two plus two makes four.", { exact: false })
        .count(),
      0,
    );
    for (let i = 1; i <= 5; i++)
      await page
        .getByRole("button", { name: `Question ${i}: Four`, exact: true })
        .click();
    await page
      .getByRole("button", { name: "Check practice answers", exact: true })
      .click();
    await page
      .getByText("You answered 5 of 5 correctly.", { exact: false })
      .waitFor();
    assert.deepEqual(
      calls.map((x) => x.mode),
      ["explain", "summarise", "practice"],
    );
    rateLimit = true;
    await page
      .getByRole("button", { name: "Create practice questions", exact: true })
      .click();
    await page
      .getByText("Today's study assistant limit has been reached.", {
        exact: true,
      })
      .waitFor();
    ready = false;
    await page
      .getByRole("button", {
        name: "Refresh assistant availability",
        exact: true,
      })
      .click();
    await page
      .getByText("The study assistant is not available yet.", { exact: false })
      .waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Create practice questions", exact: true })
        .isDisabled(),
      true,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: mobile study explanation, summary, practice/reveal, rate-limit and missing-provider UI with mocked backend.",
    );
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
