// UI acceptance with an isolated in-memory API. No live accounts or messages.
const { chromium } = require("playwright");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const base = "http://127.0.0.1:8094";
const ref = new URL(
  fs
    .readFileSync(".env", "utf8")
    .match(/^EXPO_PUBLIC_SUPABASE_URL=(.+)$/m)[1]
    .trim(),
).hostname.split(".")[0];
const uid = "aaaabbbb-4444-4444-8444-444444444444";
const peer = {
  id: "bbbbcccc-4444-4444-8444-444444444444",
  username: "study_friend",
  display_name: "Study Friend",
  avatar_path: null,
};
const roomId = "ccccdddd-4444-4444-8444-444444444444";
const invite = "abcdef0123456789abcdef0123456789";
const user = {
  id: uid,
  email: "requirements@example.com",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
  created_at: new Date().toISOString(),
};
const token = [
  "e30",
  Buffer.from(
    JSON.stringify({ sub: uid, exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString("base64url"),
  "fixture",
].join(".");
const systems = [
  { code: "ZW", name: "Zimbabwe" },
  { code: "GB", name: "United Kingdom" },
];
const levels = systems.flatMap((s) =>
  Array.from({ length: 13 }, (_, i) => ({
    system_code: s.code,
    ordinal: i + 1,
    label:
      s.code === "GB"
        ? `Year ${i + 1}`
        : i < 7
          ? `Grade ${i + 1}`
          : `Form ${i - 6}`,
  })),
);
async function button(page, name) {
  await page.getByRole("button", { name, exact: true }).click();
}
async function select(page, label, option) {
  await button(page, label);
  await button(page, option);
}
async function home(page) {
  await page.getByRole("tab", { name: "Home", exact: true }).click();
}
async function account(page) {
  await page.getByRole("tab", { name: "You", exact: true }).click();
}
async function fixture(browser, role = "student") {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [],
    writes = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(
    ({ ref, user, token }) => {
      localStorage.setItem(
        `sb-${ref}-auth-token`,
        JSON.stringify({
          access_token: token,
          refresh_token: "fixture",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          expires_in: 3600,
          token_type: "bearer",
          user,
        }),
      );
    },
    { ref, user, token },
  );
  const profile = {
    id: uid,
    role,
    grade: "Form 5",
    education_system: "ZW",
    education_level: "Form 5",
    education_ordinal: 12,
    username: "test_learner",
    display_name: "Test Learner",
    first_name: "Test",
    surname: "Learner",
    country: "Zimbabwe",
    bio: "I enjoy learning.",
    avatar_path: null,
    discoverable: false,
  };
  let messages = [],
    languageMessages = [],
    questions = [],
    rooms = [],
    position = 0,
    score = 0,
    timeoutNext = false;
  const group = {
    id: "group-one",
    name: "Levels 10-12",
    levels: [10, 11, 12],
    active: true,
  };
  await page.route("https://*.supabase.co/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname,
      method = req.method();
    const body =
      ["POST", "PATCH", "PUT"].includes(method) && req.postData()
        ? req.postDataJSON()
        : null;
    let data = [];
    if (method !== "GET" && method !== "OPTIONS")
      writes.push({ path, method, body });
    if (path === "/auth/v1/user") data = user;
    else if (path === "/rest/v1/profiles") data = profile;
    else if (path === "/rest/v1/education_systems") data = systems;
    else if (path === "/rest/v1/education_levels") data = levels;
    else if (path.endsWith("/rpc/set_my_identity")) {
      profile.username = body.handle;
      profile.avatar_path = body.photo;
      data = null;
    } else if (path.endsWith("/rpc/set_my_education")) {
      profile.education_system = body.system;
      profile.education_level = body.level_label;
      data = null;
    } else if (path.endsWith("/rpc/update_my_profile")) {
      profile.bio = body.biography;
      data = null;
    } else if (path.endsWith("/rpc/find_people")) data = [peer];
    else if (path.endsWith("/rpc/public_people")) data = [peer, { ...profile }];
    else if (path === "/rest/v1/direct_messages") {
      if (method === "POST")
        messages.push({
          ...body,
          id: "message-one",
          created_at: new Date().toISOString(),
        });
      data = messages;
    } else if (path === "/rest/v1/languages")
      data = [
        { id: "fr", name: "French" },
        { id: "es", name: "Spanish" },
      ];
    else if (path === "/rest/v1/language_messages") {
      if (method === "POST")
        languageMessages.push({
          ...body,
          id: `language-${languageMessages.length}`,
          created_at: new Date().toISOString(),
        });
      data = languageMessages.filter(
        (m) =>
          !url.searchParams.has("language_id") ||
          url.searchParams.get("language_id") === `eq.${m.language_id}`,
      );
    } else if (path === "/rest/v1/quiz_groups") data = [group];
    else if (path === "/rest/v1/quiz_bank") {
      if (method === "POST") questions.push({ ...body, id: "question-one" });
      if (method === "PATCH")
        questions = questions.map((q) => ({ ...q, ...body }));
      if (method === "DELETE") questions = [];
      data = questions;
    } else if (path.endsWith("/rpc/start_quiz")) {
      position = 0;
      score = 0;
      data = "quiz-set";
    } else if (path.endsWith("/rpc/quiz_next"))
      data = {
        status: "playing",
        position,
        prompt: `Practice question ${position + 1}`,
        choices: [
          "Correct option",
          "Wrong option",
          "Third option",
          "Fourth option",
        ],
        score,
        server_time: new Date().toISOString(),
        deadline: new Date(
          Date.now() + (timeoutNext ? 700 : 30000),
        ).toISOString(),
      };
    else if (path.endsWith("/rpc/submit_quiz_answer")) {
      const correct = body.choice === 0;
      score += correct ? 10 : -3;
      data = {
        correct,
        correct_choice: 0,
        selected: body.choice,
        points: correct ? 10 : -3,
        explanation: "Worked answer.",
        score,
        completed: ++position === 10,
        elapsed_ms: 12345,
      };
    } else if (path.endsWith("/rpc/speed_quiz_leaderboard"))
      data = [{ learner: "☆study_friend", elapsed_ms: 12345 }];
    else if (path.endsWith("/rpc/timed_quiz_leaderboard"))
      data = [{ learner: "☆study_friend", points: 87 }];
    else if (path === "/rest/v1/classrooms") {
      if (method === "POST")
        rooms.push({ ...body, id: roomId, join_code: invite });
      data = rooms;
    } else if (path.endsWith("/rpc/classroom_offer"))
      data = [
        {
          id: roomId,
          title: "Science classroom",
          price_minor: 0,
          currency: "USD",
        },
      ];
    else if (path.endsWith("/rpc/join_classroom")) {
      rooms = [
        {
          id: roomId,
          title: "Science classroom",
          grade: "Form 5",
          owner_id: peer.id,
          price_minor: 0,
          currency: "USD",
        },
      ];
      data = roomId;
    } else if (path.endsWith("/rpc/classroom_roster"))
      data = [
        {
          user_id: peer.id,
          username: peer.username,
          display_name: peer.display_name,
        },
      ];
    else if (path === "/rest/v1/support_settings") data = { enabled: true };
    else if (path === "/rest/v1/pronunciation_audio") data = null;
    else if (path.endsWith("/rpc/is_owner")) data = role === "owner";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
  return {
    page,
    errors,
    writes,
    profile,
    setTimeoutQuestion() {
      timeoutNext = true;
    },
  };
}
(async () => {
  const server = spawn(process.execPath, ["scripts/serve-preview.cjs"], {
    env: { ...process.env, PORT: "8094" },
    windowsHide: true,
    stdio: "ignore",
  });
  let browser;
  try {
    for (let i = 0; i < 80; i++) {
      try {
        if ((await fetch(base)).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const student = await fixture(browser),
      { page, writes } = student;
    await page.goto(`${base}?join=${invite}`);
    await page.getByLabel("Classroom invitation link").waitFor();
    assert.equal(
      await page.getByLabel("Classroom invitation link").inputValue(),
      `educationforum://open?join=${invite}`,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Create classroom", exact: true })
        .count(),
      0,
    );
    await button(page, "Join classroom");
    await page.getByText("Science classroom", { exact: true }).waitFor();
    assert.ok(
      writes.some(
        (w) =>
          w.path.endsWith("/rpc/join_classroom") &&
          w.body.invite_code === invite,
      ),
    );
    await account(page);
    await button(page, "Settings and profile");
    await page.getByLabel("Username", { exact: true }).fill("renamed_learner");
    await button(page, "Save username and picture");
    await page.getByText("Username and profile picture saved.").waitFor();
    await page
      .getByLabel("About me", { exact: true })
      .fill("I enjoy science and languages.");
    await button(page, "Save profile");
    await page.getByText("Profile saved.", { exact: true }).waitFor();
    await select(page, "Country / education system", "United Kingdom");
    await select(page, "Education level", "Year 12");
    await button(page, "Save education level");
    await page.getByText("Education level saved.", { exact: true }).waitFor();
    await button(page, "Dark theme: off");
    await button(page, "Dark theme: on");
    assert.equal(student.profile.bio, "I enjoy science and languages.");
    assert.ok(
      writes.some(
        (w) =>
          w.path.endsWith("/rpc/set_my_education") &&
          w.body.system === "GB" &&
          w.body.level_label === "Year 12",
      ),
    );
    await select(page, "Application type", "Safe Room responder");
    assert.equal(
      await page
        .getByRole("button", { name: "Attach picture of ID", exact: true })
        .count(),
      0,
    );
    await button(page, "Submit for verification");
    await page
      .getByText(
        "Attach the required files and explain why you qualify (at least 20 characters).",
      )
      .waitFor();
    await select(page, "Application type", "Teacher verification");
    await page
      .getByRole("button", { name: "Attach picture of ID", exact: true })
      .waitFor();
    await account(page);
    await button(page, "Direct messages");
    await page.getByLabel("Find username").fill("study_friend");
    await button(page, "Find people");
    await button(page, "Message ☆study_friend");
    await page
      .getByLabel("Message", { exact: true })
      .fill("Hello from the isolated test.");
    await button(page, "Send message");
    await page
      .getByText("Hello from the isolated test.", { exact: true })
      .waitFor();
    assert.ok(
      writes.some(
        (w) =>
          w.path === "/rest/v1/direct_messages" &&
          w.body.recipient_id === peer.id,
      ),
    );
    await home(page);
    await button(page, "Languages");
    await select(page, "Pronunciation voice", "Best available device voice");
    assert.equal(
      await page.evaluate(() =>
        localStorage.getItem(
          "ef-pronunciation:aaaabbbb-4444-4444-8444-444444444444:fr-FR",
        ),
      ),
      "device",
    );
    await button(page, "2. Polite words");
    await page
      .getByRole("button", { name: "Listen to Merci", exact: true })
      .waitFor();
    await button(page, "Language practice chat board");
    await page.getByLabel("Message", { exact: true }).fill("Bonjour les amis.");
    await button(page, "Send message");
    await page.getByText("Bonjour les amis.", { exact: true }).waitFor();
    await select(page, "Practice language", "Spanish");
    await page
      .getByText("Bonjour les amis.", { exact: true })
      .waitFor({ state: "hidden" });
    await page.getByLabel("Message", { exact: true }).fill("Hola amigos.");
    await button(page, "Send message");
    await page.getByText("Hola amigos.", { exact: true }).waitFor();
    assert.ok(
      writes.some(
        (w) =>
          w.path === "/rest/v1/language_messages" &&
          w.body.language_id === "es",
      ),
    );
    await home(page);
    await button(page, "Guru quiz");
    await page.getByText(/☆study_friend/).waitFor();
    await button(page, "Hard questions");
    await button(page, "Start or resume hard quiz");
    await page.getByText("Practice question 1", { exact: true }).waitFor();
    await button(page, "Wrong option");
    await page.getByText("Incorrect or timed out:", { exact: false }).waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: /Wrong option/ })
        .evaluate((e) => getComputedStyle(e).backgroundColor),
      "rgb(255, 224, 230)",
    );
    assert.equal(
      await page
        .getByRole("button", { name: /Correct option/ })
        .evaluate((e) => getComputedStyle(e).backgroundColor),
      "rgb(216, 245, 225)",
    );
    for (let i = 1; i < 10; i++) {
      await button(page, "Next question");
      await page
        .getByText(`Practice question ${i + 1}`, { exact: true })
        .waitFor();
      await button(page, "Correct option");
    }
    await page.getByText("Set complete: 87 points", { exact: false }).waitFor();
    await button(page, "Return to leaderboard");
    student.setTimeoutQuestion();
    await button(page, "Speed quiz");
    await button(page, "Start or resume speed quiz");
    await page.getByText("Incorrect or timed out:", { exact: false }).waitFor();
    assert.ok(
      writes.some(
        (w) =>
          w.path.endsWith("/rpc/submit_quiz_answer") && w.body.choice === null,
      ),
    );
    assert.deepEqual(student.errors, []);
    console.log(
      "PASS: student invitation, role gates, identity/About Me, country/level, theme, verification validation, direct/language chat, voice preference, ten-question scoring, answer colours and timeout UI (mock API).",
    );
    const teacher = await fixture(browser, "teacher");
    await teacher.page.goto(base);
    await home(teacher.page);
    await button(teacher.page, "Join classroom");
    await teacher.page.getByLabel("Classroom title").fill("My teaching room");
    await button(teacher.page, "Create classroom");
    await teacher.page
      .getByText(`educationforum://open?join=${invite}`, { exact: true })
      .waitFor();
    await button(teacher.page, "View joined students");
    await teacher.page
      .getByText("☆study_friend · Study Friend", { exact: true })
      .waitFor();
    assert.deepEqual(teacher.errors, []);
    console.log(
      "PASS: teacher classroom creation, invitation link and named student roster (mock API).",
    );
    const admin = await fixture(browser, "owner");
    await admin.page.goto(base);
    await account(admin.page);
    await button(admin.page, "Open admin dashboard");
    await admin.page.getByText("Quiz question bank", { exact: true }).waitFor();
    await admin.page
      .getByLabel("Question prompt", { exact: true })
      .fill("What is 2 + 2?");
    for (let i = 0; i < 4; i++)
      await admin.page
        .getByLabel(`Answer option ${i + 1}`, { exact: true })
        .fill(String(i + 1));
    await select(admin.page, "Correct answer option", "Option 4");
    await button(admin.page, "Create question");
    await button(admin.page, "Edit: What is 2 + 2?");
    await admin.page
      .getByLabel("Question prompt", { exact: true })
      .fill("What is 3 + 1?");
    await button(admin.page, "Save question changes");
    await admin.page
      .getByRole("button", { name: "Edit: What is 3 + 1?", exact: true })
      .waitFor();
    await button(admin.page, "Delete question");
    await admin.page
      .getByRole("button", { name: "Edit: What is 3 + 1?", exact: true })
      .waitFor({ state: "hidden" });
    assert.ok(
      admin.writes.some(
        (w) =>
          w.path === "/rest/v1/quiz_bank" &&
          w.method === "POST" &&
          w.body.correct === 3,
      ),
    );
    assert.ok(
      admin.writes.some(
        (w) => w.path === "/rest/v1/quiz_bank" && w.method === "PATCH",
      ),
    );
    assert.ok(
      admin.writes.some(
        (w) => w.path === "/rest/v1/quiz_bank" && w.method === "DELETE",
      ),
    );
    assert.deepEqual(admin.errors, []);
    console.log(
      "PASS: admin question create/edit/delete and correct-answer payload (mock API).",
    );
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
