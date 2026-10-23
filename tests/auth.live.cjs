// Controlled hosted authentication test. No emails are sent. The generated-link
// path tests confirmation/recovery, NOT public signup email dispatch or inbox delivery.
// Admin keys remain in memory; only this run's temporary account is deleted.
const fs = require("node:fs");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const { createClient } = require("@supabase/supabase-js");
for (const file of [".env", ".env.local"]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z_0-9]+)=(.*)$/);
    if (match && !process.env[match[1]])
      process.env[match[1]] = match[2].trim().replace(/^"(.*)"$/, "$1");
  }
}
async function main() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const ref = new URL(url).hostname.split(".")[0];
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/api-keys`,
    {
      headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}` },
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!response.ok)
    throw new Error(`Management key access HTTP ${response.status}`);
  const keys = await response.json();
  const adminKey = keys.find((key) => key.name === "service_role")?.api_key;
  if (!adminKey)
    throw new Error("Server admin key unavailable; no account created.");
  const options = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  };
  const admin = createClient(url, adminKey, options);
  const client = createClient(url, publicKey, options);
  if (process.argv.includes("--cleanup-tests")) {
    const listed = checked(
      await admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      "List test accounts",
    );
    for (const u of listed.users.filter(
      (u) =>
        /^ef-auth-test-[0-9a-f-]+@example\.com$/.test(u.email || "") &&
        u.user_metadata.first_name === "Auth test" &&
        u.user_metadata.surname === "Temporary",
    )) {
      const progress = checked(
        await admin
          .from("learning_progress")
          .select("lesson_id")
          .eq("user_id", u.id),
        "Test progress",
      );
      checked(
        await admin.from("learning_progress").delete().eq("user_id", u.id),
        "Remove test progress",
      );
      for (const p of progress)
        checked(
          await admin
            .from("lessons")
            .delete()
            .eq("id", p.lesson_id)
            .eq("title", "Temporary course verification"),
          "Remove test lesson",
        );
      checked(
        await admin.from("entries").delete().eq("owner_id", u.id),
        "Remove test entries",
      );
      checked(
        await admin.from("audit_log").delete().eq("actor_id", u.id),
        "Remove test audit",
      );
      checked(await admin.auth.admin.deleteUser(u.id), "Remove test account");
      console.log(
        "Removed a leftover controlled test account and its fixtures.",
      );
    }
    return;
  }
  const email = `ef-auth-test-${crypto.randomUUID()}@example.com`;
  const password = `Test!${crypto.randomBytes(18).toString("hex")}`;
  let userId;
  let lessonId, entryId;
  function checked(result, label) {
    if (result.error)
      throw new Error(
        `${label}: ${result.error.code || result.error.status || "failed"}`,
      );
    return result.data;
  }
  try {
    const signup = checked(
      await admin.auth.admin.generateLink({
        type: "signup",
        email,
        password,
        options: {
          redirectTo: "educationforum://auth/callback",
          data: {
            first_name: "Auth test",
            surname: "Temporary",
            grade: "Form 4",
            date_of_birth: "2005-01-01",
            country: "South Africa",
            account_type: "student",
          },
        },
      }),
      "Generate controlled signup",
    );
    userId = signup.user.id;
    assert.equal(
      new URL(signup.properties.action_link).searchParams.get("redirect_to"),
      "educationforum://auth/callback",
    );
    const unconfirmed = await client.auth.signInWithPassword({
      email,
      password,
    });
    assert.equal(unconfirmed.error?.code, "email_not_confirmed");
    checked(
      await client.auth.verifyOtp({
        token_hash: signup.properties.hashed_token,
        type: "signup",
      }),
      "Confirm account",
    );
    const profile = checked(
      await client
        .from("profiles")
        .select("id,grade,first_name,account_type,role")
        .eq("id", userId)
        .single(),
      "Own profile",
    );
    assert.equal(profile.grade, "Form 4");
    assert.equal(profile.first_name, "Auth test");
    assert.equal(profile.role, "student");
    checked(await client.auth.signOut(), "Sign out");
    assert.equal(
      (
        await client.auth.signInWithPassword({
          email,
          password: "Wrong-password!123",
        })
      ).error?.code,
      "invalid_credentials",
    );
    checked(
      await client.auth.signInWithPassword({ email, password }),
      "Password login",
    );
    checked(await client.auth.refreshSession(), "Refresh session");
    console.log(
      "PASS: confirmation required, confirmation token, profile creation/RLS, wrong password, login, session refresh.",
    );
    if (process.argv.includes("--browser")) {
      const { chromium } = require("playwright");
      const browser = await chromium.launch({
        channel: "chrome",
        headless: true,
      });
      try {
        const page = await browser.newPage({
          viewport: { width: 390, height: 844 },
        });
        await page.goto("http://127.0.0.1:8080");
        let signupPayload;
        let emailRequests = 0;
        await page.route(`${url}/auth/v1/signup**`, async (route) => {
          signupPayload = route.request().postDataJSON();
          await route.fulfill({
            status: 200,
            headers: { "access-control-allow-origin": "*" },
            contentType: "application/json",
            body: JSON.stringify({
              id: userId,
              email,
              identities: [],
              aud: "authenticated",
              role: "authenticated",
              created_at: new Date().toISOString(),
            }),
          });
        });
        // Prevent any email dispatch from this UI test, even if cooldown breaks.
        await page.route(`${url}/auth/v1/resend**`, async (route) => {
          emailRequests++;
          await route.fulfill({
            status: 429,
            contentType: "application/json",
            body: JSON.stringify({
              code: "over_email_send_rate_limit",
              message: "email rate limit exceeded",
            }),
          });
        });
        await page
          .getByRole("button", { name: "Create account", exact: true })
          .first()
          .click();
        const signupDialog = page.getByRole("dialog");
        for (const [label, value] of Object.entries({
          Name: "Auth test",
          Surname: "Temporary",
          Email: email,
          Password: password,
          "Confirm password": password,
        })) {
          await signupDialog.getByLabel(label, { exact: true }).fill(value);
        }
        await signupDialog
          .getByLabel("Username", { exact: true })
          .fill(`test_${crypto.randomBytes(6).toString("hex")}`);
        await signupDialog
          .getByRole("button", { name: "Date of birth", exact: true })
          .click();
        await page
          .getByRole("button", { name: "2005-01-01", exact: true })
          .click();
        await signupDialog
          .getByRole("button", { name: "Country", exact: true })
          .click();
        await page
          .getByRole("button", { name: "South Africa", exact: true })
          .click();
        await signupDialog
          .getByRole("button", { name: "Education level", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Grade 11", exact: true })
          .click();
        await signupDialog
          .getByRole("button", { name: "Show password", exact: true })
          .click();
        assert.equal(
          await signupDialog
            .getByLabel("Password", { exact: true })
            .evaluate((input) => input.type),
          "text",
        );
        await signupDialog
          .getByRole("button", { name: "Create account", exact: true })
          .click();
        await signupDialog
          .getByText("Check your email", { exact: true })
          .waitFor()
          .catch(async () => {
            throw new Error(
              `Signup UI failed (request captured: ${!!signupPayload}): ${(await signupDialog.getByRole("alert").allTextContents()).join(" ")}`,
            );
          });
        assert.equal(signupPayload.email, email);
        assert.equal(signupPayload.data.grade, "Form 4");
        await signupDialog
          .getByRole("button", {
            name: "Resend confirmation email",
            exact: true,
          })
          .click();
        await signupDialog.getByText("Please wait", { exact: false }).waitFor();
        assert.equal(emailRequests, 0);
        console.log(
          "PASS: signup UI/payload, pending confirmation, password visibility and duplicate-email protection (signup response simulated; no email sent).",
        );
        await signupDialog
          .getByRole("button", { name: "← Back", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Log in", exact: true })
          .first()
          .click();
        const dialog = page.getByRole("dialog");
        await dialog.getByLabel("Email", { exact: true }).fill(email);
        await dialog
          .getByLabel("Password", { exact: true })
          .fill("Wrong-password!123");
        await dialog
          .getByRole("button", { name: "Sign in", exact: true })
          .click();
        await dialog
          .getByText("The email or password is incorrect.", { exact: false })
          .waitFor();
        await dialog.getByLabel("Password", { exact: true }).fill(password);
        await dialog
          .getByRole("button", { name: "Sign in", exact: true })
          .click();
        await page.getByText("Your home - Form 4", { exact: true }).waitFor();
        await page.reload();
        await page.getByText("Your home - Form 4", { exact: true }).waitFor();
        await page.getByRole("tab", { name: "You", exact: true }).click();
        await page.getByText(email, { exact: true }).waitFor();
        await page
          .getByRole("button", { name: "Settings and profile", exact: true })
          .click();
        await page
          .getByLabel("Display name", { exact: true })
          .fill("Verified test profile");
        await page
          .getByLabel("About me", { exact: true })
          .fill("Temporary integration test biography");
        await page
          .getByRole("button", { name: "Save profile", exact: true })
          .click();
        await page.getByText("Profile saved.", { exact: true }).waitFor();
        assert.equal(
          checked(
            await client
              .from("profiles")
              .select("display_name")
              .eq("id", userId)
              .single(),
            "Saved profile",
          ).display_name,
          "Verified test profile",
        );
        await page
          .getByLabel("Account request message", { exact: true })
          .fill("Temporary test support request");
        await page
          .getByRole("button", { name: "Send account request", exact: true })
          .click();
        await page
          .getByText("Your private request has been submitted.", {
            exact: true,
          })
          .waitFor();
        assert.equal(
          checked(
            await client
              .from("account_requests")
              .select("id")
              .eq("user_id", userId),
            "Private support request",
          ).length,
          1,
        );
        await page.getByRole("tab", { name: "You", exact: true }).click();
        console.log(
          "PASS: profile editing and private account-support submission through the real browser and hosted database.",
        );
        entryId = crypto.randomUUID();
        checked(
          await client.from("entries").insert({
            id: entryId,
            owner_id: userId,
            kind: "course",
            title: "Temporary test submission",
            description:
              "Temporary integration test submission for editing and resubmission.",
            category: "Languages",
            author: "Test learner",
            level: "Form 4",
            status: "pending",
          }),
          "Create test submission",
        );
        await page.reload();
        await page.getByRole("tab", { name: "You", exact: true }).click();
        await page
          .getByRole("button", { name: "Edit and resubmit", exact: true })
          .click();
        await page
          .getByLabel("Revised title", { exact: true })
          .fill("Revised temporary submission");
        await page
          .getByRole("button", { name: "Send for review again", exact: true })
          .click();
        await page
          .getByText("Resubmitted for review.", { exact: true })
          .waitFor();
        assert.equal(
          checked(
            await client
              .from("entries")
              .select("title,status")
              .eq("id", entryId)
              .single(),
            "Read revised entry",
          ).title,
          "Revised temporary submission",
        );
        const language = checked(
          await admin
            .from("languages")
            .select("id")
            .eq("name", "French")
            .single(),
          "Test lesson language",
        );
        lessonId = crypto.randomUUID();
        checked(
          await admin.from("lessons").insert({
            id: lessonId,
            language_id: language.id,
            title: "Temporary course verification",
            level: "beginner",
            active: true,
            content: {
              body: "Bonjour means hello in French. Read the lesson, then review it when ready.",
              question: "How do you say hello in French?",
              answer: "Bonjour",
            },
          }),
          "Create test lesson",
        );
        await page.getByRole("tab", { name: "Learn", exact: true }).click();
        await page
          .getByRole("button", { name: "Browse language courses", exact: true })
          .click();
        await page
          .getByRole("button", {
            name: "Study Temporary course verification",
            exact: true,
          })
          .click();
        await page
          .getByRole("button", { name: "Save for later", exact: true })
          .click();
        await page
          .getByText("Study progress saved.", { exact: true })
          .waitFor();
        await page
          .getByRole("button", { name: "Start lesson review", exact: true })
          .click();
        assert.equal(
          await page
            .getByText(
              "Bonjour means hello in French. Read the lesson, then review it when ready.",
              { exact: true },
            )
            .count(),
          0,
        );
        await page.getByLabel("Your answer", { exact: true }).fill("Bonjour");
        await page
          .getByRole("button", { name: "Check answer", exact: true })
          .click();
        await page
          .getByText("Correct. Lesson completed and progress saved.", {
            exact: true,
          })
          .waitFor();
        assert.equal(
          checked(
            await client
              .from("learning_progress")
              .select("progress")
              .eq("user_id", userId)
              .eq("lesson_id", lessonId)
              .single(),
            "Saved lesson progress",
          ).progress,
          100,
        );
        await page.getByRole("tab", { name: "You", exact: true }).click();
        console.log(
          "PASS: submission revision and separate lesson study/review with hosted progress persistence.",
        );
        await page
          .getByRole("button", { name: "Sign out", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Log in", exact: true })
          .first()
          .waitFor();
        console.log(
          "PASS: real browser login, restored session after reload, profile identity, sign out.",
        );
      } finally {
        await browser.close();
      }
    }
    checked(await client.auth.signOut(), "Sign out before recovery");
    const recovery = checked(
      await admin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: "educationforum://auth/callback" },
      }),
      "Generate controlled recovery",
    );
    const recovered = checked(
      await client.auth.verifyOtp({
        token_hash: recovery.properties.hashed_token,
        type: "recovery",
      }),
      "Recover session",
    );
    const nextPassword = `New!${crypto.randomBytes(18).toString("hex")}`;
    if (process.argv.includes("--browser")) {
      const { chromium } = require("playwright");
      const browser = await chromium.launch({
        channel: "chrome",
        headless: true,
      });
      try {
        const page = await browser.newPage({
          viewport: { width: 390, height: 844 },
        });
        const fragment = new URLSearchParams({
          type: "recovery",
          access_token: recovered.session.access_token,
          refresh_token: recovered.session.refresh_token,
          expires_in: "3600",
          token_type: "bearer",
        });
        await page.goto(`http://127.0.0.1:8080/#${fragment}`);
        const dialog = page.getByRole("dialog");
        await dialog
          .getByText("Choose a new password", { exact: true })
          .waitFor();
        await dialog.getByLabel("Password", { exact: true }).fill(nextPassword);
        await dialog
          .getByLabel("Confirm password", { exact: true })
          .fill("does-not-match");
        await dialog
          .getByRole("button", { name: "Update password", exact: true })
          .click();
        await dialog
          .getByText("Your passwords do not match.", { exact: true })
          .waitFor();
        await dialog
          .getByLabel("Confirm password", { exact: true })
          .fill(nextPassword);
        await dialog
          .getByRole("button", { name: "Update password", exact: true })
          .click();
        await page
          .getByText("Your password has been updated.", { exact: true })
          .waitFor();
        console.log(
          "PASS: recovery callback opens password form, matching-password validation and real password update through UI.",
        );
      } finally {
        await browser.close();
      }
    } else
      checked(
        await client.auth.updateUser({ password: nextPassword }),
        "Update password",
      );
    checked(await client.auth.signOut(), "Sign out after recovery");
    assert.equal(
      (await client.auth.signInWithPassword({ email, password })).error?.code,
      "invalid_credentials",
    );
    checked(
      await client.auth.signInWithPassword({ email, password: nextPassword }),
      "New password login",
    );
    console.log(
      "PASS: recovery token, password update, old password rejected, new password accepted.",
    );
  } finally {
    await client.auth.signOut();
    if (userId)
      checked(
        await admin.from("learning_progress").delete().eq("user_id", userId),
        "Test progress cleanup",
      );
    if (lessonId)
      checked(
        await admin.from("lessons").delete().eq("id", lessonId),
        "Test lesson cleanup",
      );
    if (entryId)
      checked(
        await admin.from("entries").delete().eq("id", entryId),
        "Test submission cleanup",
      );
    if (userId)
      checked(
        await admin.from("audit_log").delete().eq("actor_id", userId),
        "Test audit cleanup",
      );
    if (userId) {
      checked(
        await admin.auth.admin.deleteUser(userId),
        "Temporary account cleanup",
      );
      console.log("Temporary test account removed.");
    }
  }
  console.log(
    "Email dispatch, inbox delivery and installed-device deep links were not tested.",
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
