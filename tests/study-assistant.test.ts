import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateStudyRequest,
  validateStudyResult,
} from "../supabase/functions/_shared/study-contract.ts";
import { generateStudy } from "../supabase/functions/_shared/study-provider.ts";

const question = {
  prompt: "What is 2 + 2?",
  choices: ["1", "2", "3", "4"],
  answer: 3,
  explanation: "Two pairs make four.",
};
const result = {
  title: "Addition",
  content: "Combine groups to add.",
  questions: [],
};
function providerMock(
  output: unknown = result,
  options: { flagged?: boolean; status?: string; http?: number } = {},
) {
  const calls: { url: string; body: any }[] = [];
  const fetcher = (async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = String(url);
    calls.push({ url: path, body: JSON.parse(String(init?.body)) });
    return new Response(
      JSON.stringify(
        path.endsWith("/moderations")
          ? { results: [{ flagged: !!options.flagged }] }
          : {
              status: options.status || "completed",
              output: [
                {
                  type: "message",
                  content: [
                    { type: "output_text", text: JSON.stringify(output) },
                  ],
                },
              ],
            },
      ),
      { status: options.http || 200 },
    );
  }) as typeof fetch;
  return { fetcher, calls };
}
test("study input bounds and modes cannot be bypassed", () => {
  for (const v of [
    null,
    {},
    { mode: "admin", text: "explain science" },
    { mode: "explain", text: "short" },
    { mode: "practice", text: "x".repeat(6001) },
  ])
    assert.throws(() => validateStudyRequest(v));
  assert.deepEqual(
    validateStudyRequest({
      mode: "explain",
      text: "  Explain fractions  ",
      model: "attacker",
      user_id: "other",
    }),
    { mode: "explain", text: "Explain fractions" },
  );
});
test("all three modes use stateless structured output and moderate input/output", async () => {
  for (const mode of ["explain", "summarise", "practice"] as const) {
    const expected = {
      ...result,
      questions:
        mode === "practice"
          ? Array.from({ length: 5 }, () => ({ ...question }))
          : [],
    };
    const mock = providerMock(expected);
    assert.deepEqual(
      await generateStudy(
        { mode, text: "Explain simple addition" },
        "Form 1",
        "test-key",
        "test-model",
        mock.fetcher,
      ),
      expected,
    );
    assert.equal(mock.calls.length, 3);
    const body = mock.calls[1].body;
    assert.equal(body.store, false);
    assert.equal(body.model, "test-model");
    assert.equal(body.max_output_tokens, 3000);
    assert.equal(body.text.format.strict, true);
    assert.equal(body.tools, undefined);
    assert.match(body.instructions, /Form 1/);
  }
});
test("flagged prompts never reach generation", async () => {
  const mock = providerMock(result, { flagged: true });
  await assert.rejects(
    () =>
      generateStudy(
        { mode: "explain", text: "School material" },
        "Grade 4",
        "key",
        "model",
        mock.fetcher,
      ),
    /classroom discussion/,
  );
  assert.equal(mock.calls.length, 1);
});
test("malformed and incomplete responses never reach learners", async () => {
  for (const output of [
    { ...result, questions: [question] },
    { ...result, content: "" },
    null,
  ]) {
    const mock = providerMock(output);
    await assert.rejects(
      () =>
        generateStudy(
          { mode: "explain", text: "School material" },
          "Grade 4",
          "key",
          "model",
          mock.fetcher,
        ),
      /usable format/,
    );
  }
  const mock = providerMock(result, { status: "incomplete" });
  await assert.rejects(
    () =>
      generateStudy(
        { mode: "explain", text: "School material" },
        "Grade 4",
        "key",
        "model",
        mock.fetcher,
      ),
    /could not be completed/,
  );
});
test("practice answers must have valid distinct choices and answer indices", () => {
  for (const invalid of [
    { ...question, answer: 4 },
    { ...question, choices: ["1", "1", "2", "3"] },
    { ...question, explanation: "" },
  ])
    assert.throws(() =>
      validateStudyResult(
        { ...result, questions: Array.from({ length: 5 }, () => invalid) },
        "practice",
      ),
    );
});
test("provider errors never expose keys or raw provider payloads", async () => {
  const mock = providerMock(
    { error: "secret credential details" },
    { http: 429 },
  );
  await assert.rejects(
    () =>
      generateStudy(
        { mode: "explain", text: "School material" },
        "Grade 4",
        "private-key",
        "model",
        mock.fetcher,
      ),
    (e) => {
      assert.doesNotMatch(String(e), /private-key|secret credential/);
      return true;
    },
  );
});
