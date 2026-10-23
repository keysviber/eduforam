import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generateGeminiStudy,
  studyProviderConfig,
} from "../supabase/functions/_shared/study-gemini.ts";
const result = {
  title: "Photosynthesis",
  content: "Plants use light to make glucose.",
  questions: [],
};
test("Gemini supports all study modes with server-only credentials and safety settings", async () => {
  for (const mode of ["explain", "summarise", "practice"] as const) {
    const expected = {
      ...result,
      questions:
        mode === "practice"
          ? Array.from({ length: 5 }, () => ({
              prompt: "What supplies energy?",
              choices: ["Sunlight", "Sand", "Salt", "Stone"],
              answer: 0,
              explanation: "Sunlight provides energy.",
            }))
          : [],
    };
    const mock = (async (url, init) => {
      assert.equal(
        String(url),
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
      );
      assert.equal(
        new Headers(init?.headers).get("x-goog-api-key"),
        "test-key",
      );
      assert.doesNotMatch(String(url), /test-key/);
      const body = JSON.parse(String(init?.body));
      assert.equal(body.safetySettings.length, 4);
      assert.equal(body.generationConfig.responseMimeType, "application/json");
      assert.equal(body.tools, undefined);
      return new Response(
        JSON.stringify({
          candidates: [
            {
              finishReason: "STOP",
              content: {
                parts: [
                  { text: "Internal reasoning", thought: true },
                  { text: JSON.stringify(expected) },
                ],
              },
            },
          ],
        }),
      );
    }) as typeof fetch;
    assert.deepEqual(
      await generateGeminiStudy(
        { mode, text: "Explain photosynthesis" },
        "Form 1",
        "test-key",
        "gemini-3.8-flash",
        mock,
      ),
      expected,
    );
  }
});
test("Gemini rejects blocked, truncated and malformed responses", async () => {
  for (const response of [
    { promptFeedback: { blockReason: "SAFETY" } },
    { candidates: [{ finishReason: "MAX_TOKENS" }] },
    {
      candidates: [
        { finishReason: "STOP", content: { parts: [{ text: "not JSON" }] } },
      ],
    },
    {
      candidates: [
        {
          finishReason: "STOP",
          safetyRatings: [{ blocked: true }],
          content: { parts: [{ text: JSON.stringify(result) }] },
        },
      ],
    },
  ]) {
    await assert.rejects(() =>
      generateGeminiStudy(
        { mode: "explain", text: "Explain photosynthesis" },
        "Form 1",
        "secret",
        "gemini-3.8-flash",
        (async () => new Response(JSON.stringify(response))) as typeof fetch,
      ),
    );
  }
});
test("Gemini authentication and quota errors are actionable and redact raw provider data", async () => {
  for (const code of [401, 403, 429, 500])
    await assert.rejects(
      () =>
        generateGeminiStudy(
          { mode: "explain", text: "Explain photosynthesis" },
          "Form 1",
          "secret",
          "gemini-3.8-flash",
          (async () =>
            new Response("secret provider details", {
              status: code,
            })) as typeof fetch,
        ),
      (error) => {
        assert.doesNotMatch(String(error), /secret provider details/);
        assert.match(
          String(error),
          code === 429
            ? /usage limit/
            : code === 401 || code === 403
              ? /credential/
              : /unavailable/,
        );
        return true;
      },
    );
});
test("Provider selection is explicit and never falls back to a different vendor", () => {
  const config = (values: Record<string, string>) =>
    studyProviderConfig((name) => values[name]);
  assert.equal(config({ GEMINI_API_KEY: "gemini" }).provider, "gemini");
  assert.equal(config({ OPENAI_API_KEY: "openai" }).provider, "openai");
  assert.equal(
    config({ STUDY_AI_PROVIDER: "gemini", OPENAI_API_KEY: "openai" }).key,
    undefined,
  );
  assert.equal(
    config({
      STUDY_AI_PROVIDER: "openai",
      GEMINI_API_KEY: "gemini",
      OPENAI_API_KEY: "openai",
    }).key,
    "openai",
  );
  assert.throws(() => config({ STUDY_AI_PROVIDER: "unknown" }));
});
