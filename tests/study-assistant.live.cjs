const fs = require("node:fs"),
  crypto = require("node:crypto"),
  assert = require("node:assert/strict");
const { createClient } = require("@supabase/supabase-js");
for (const file of [".env", ".env.local"])
  if (fs.existsSync(file))
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
      if (m && !process.env[m[1]])
        process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1");
    }
(async () => {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL,
    publicKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    ref = new URL(url).hostname.split(".")[0];
  const keysResponse = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/api-keys`,
    {
      headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}` },
    },
  );
  if (!keysResponse.ok)
    throw new Error("Cannot access controlled test credentials");
  const key = (await keysResponse.json()).find(
    (k) => k.name === "service_role",
  )?.api_key;
  if (!key) throw new Error("No server key");
  const options = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  };
  const admin = createClient(url, key, options),
    client = createClient(url, publicKey, options);
  const email = `ef-ai-test-${crypto.randomUUID()}@example.com`,
    password = crypto.randomBytes(24).toString("base64url");
  let id;
  function checked(r) {
    if (r.error)
      throw new Error(
        `Controlled test operation failed (${r.error.code || r.error.status || "unknown"})`,
      );
    return r.data;
  }
  async function call(body, token) {
    return fetch(`${url}/functions/v1/study-assistant`, {
      method: "POST",
      headers: {
        apikey: publicKey,
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
  }
  try {
    assert.equal((await call({ action: "status" })).status, 401);
    id = checked(
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { first_name: "AI test", surname: "Temporary" },
      }),
    ).user.id;
    const session = checked(
      await client.auth.signInWithPassword({ email, password }),
    ).session;
    const token = session.access_token;
    const status = await call({ action: "status" }, token);
    assert.equal(status.status, 200);
    const state = await status.json();
    assert.equal(typeof state.ready, "boolean");
    console.log(
      `Hosted AI state: configured=${state.configured}, enabled=${state.enabled}`,
    );
    assert.ok(
      (
        await client.rpc("configure_study_ai", {
          active: true,
          user_limit: 50,
          total_limit: 2000,
        })
      ).error,
    );
    assert.ok(
      (await client.rpc("reserve_study_ai", { target_user: id })).error,
    );
    assert.equal(
      (await call({ mode: "invalid", text: "Explain fractions" }, token))
        .status,
      400,
    );
    assert.equal(
      (await call({ mode: "explain", text: "x".repeat(33000) }, token)).status,
      413,
    );
    if (!state.ready) {
      assert.equal(
        (await call({ mode: "explain", text: "Explain photosynthesis" }, token))
          .status,
        503,
      );
      assert.equal(
        checked(
          await admin.from("study_ai_usage").select("*").eq("user_id", id),
        ).length,
        0,
      );
    }

    if (process.argv.includes("--browser")) {
      assert.equal(
        state.ready,
        true,
        "Hosted assistant must be enabled and configured",
      );
      const { chromium } = require("playwright");
      const { spawn } = require("node:child_process");
      const server = spawn(process.execPath, ["scripts/serve-preview.cjs"], {
        env: { ...process.env, PORT: "8094" },
        windowsHide: true,
        stdio: "ignore",
      });
      let browser;
      try {
        for (let i = 0; i < 50; i++) {
          try {
            if ((await fetch("http://127.0.0.1:8094")).ok) break;
          } catch {}
          await new Promise((r) => setTimeout(r, 200));
        }
        browser = await chromium.launch({ channel: "chrome", headless: true });
        const page = await browser.newPage({
          viewport: { width: 390, height: 844 },
        });
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.addInitScript(
          ({ ref, session }) =>
            localStorage.setItem(
              "sb-" + ref + "-auth-token",
              JSON.stringify(session),
            ),
          { ref, session },
        );
        await page.goto("http://127.0.0.1:8094");
        await page.getByRole("tab", { name: "Learn", exact: true }).click();
        await page
          .getByRole("button", { name: "AI study assistant", exact: true })
          .click();
        await page
          .getByText("Up to 10 requests per day.", { exact: false })
          .waitFor();
        const modes = [
          ["Explain a topic", "Explain this topic"],
          ["Summarise notes", "Summarise my notes"],
          ["Practice questions", "Create practice questions"],
        ];
        for (let index = 0; index < modes.length; index++) {
          if (index > 0) await page.waitForTimeout(10500);
          await page
            .getByRole("button", { name: modes[index][0], exact: true })
            .click();
          await page
            .getByLabel("Study topic or notes")
            .fill(
              "Photosynthesis: green plants use sunlight, carbon dioxide and water to produce glucose and oxygen. Chlorophyll absorbs light in chloroplasts.",
            );
          const responsePromise = page.waitForResponse(
            (r) =>
              r.url().includes("/functions/v1/study-assistant") &&
              r.request().postDataJSON()?.mode,
            { timeout: 100000 },
          );
          await page
            .getByRole("button", { name: modes[index][1], exact: true })
            .click();
          const response = await responsePromise;
          const payload = await response.json();
          assert.equal(
            response.status(),
            200,
            payload.error || "Hosted generation failed",
          );
          assert.ok(payload.result.content.length > 20);
          console.log(
            JSON.stringify({
              mode: modes[index][0],
              title: payload.result.title,
              content: payload.result.content,
              questions: payload.result.questions,
            }),
          );
          await page.getByText(payload.result.title, { exact: true }).waitFor();
          if (index === 2) {
            assert.equal(payload.result.questions.length, 5);
            for (let i = 0; i < 5; i++)
              await page
                .getByRole("button", {
                  name:
                    "Question " +
                    (i + 1) +
                    ": " +
                    payload.result.questions[i].choices[
                      payload.result.questions[i].answer
                    ],
                  exact: true,
                })
                .click();
            await page
              .getByRole("button", {
                name: "Check practice answers",
                exact: true,
              })
              .click();
            await page
              .getByText("You answered 5 of 5 correctly.", { exact: false })
              .waitFor();
          }
        }
        assert.deepEqual(errors, []);
        console.log(
          "PASS: real browser, real Auth, deployed function and live Gemini answers for all three modes; practice answer checking passed.",
        );
      } finally {
        if (browser) await browser.close();
        server.kill();
      }
    }

    checked(
      await admin.from("profiles").update({ suspended: true }).eq("id", id),
    );
    assert.equal((await call({ action: "status" }, token)).status, 401);
    console.log(
      "PASS: hosted AI authentication, inactive accounts, input bounds, owner-only settings, service-only quotas and disabled-provider handling. Generation is only requested with --browser.",
    );
  } finally {
    if (id) checked(await admin.auth.admin.deleteUser(id));
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
