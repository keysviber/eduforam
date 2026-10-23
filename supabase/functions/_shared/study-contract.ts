export type StudyMode = "explain" | "summarise" | "practice";
export type StudyRequest = { mode: StudyMode; text: string };
export type StudyResult = {
  title: string;
  content: string;
  questions: {
    prompt: string;
    choices: string[];
    answer: number;
    explanation: string;
  }[];
};
export function validateStudyRequest(value: unknown): StudyRequest {
  const v = value as Partial<StudyRequest> | null;
  if (!v || !["explain", "summarise", "practice"].includes(v.mode || ""))
    throw new Error("Choose a study mode.");
  if (
    typeof v.text !== "string" ||
    v.text.trim().length < 10 ||
    v.text.length > 6000
  )
    throw new Error("Enter 10–6,000 characters of a topic or your notes.");
  return { mode: v.mode as StudyMode, text: v.text.trim() };
}
export function validateStudyResult(
  value: unknown,
  mode: StudyMode,
): StudyResult {
  const v = value as StudyResult;
  if (
    !v ||
    typeof v.title !== "string" ||
    !v.title.trim() ||
    v.title.length > 200 ||
    typeof v.content !== "string" ||
    !v.content.trim() ||
    v.content.length > 16000 ||
    !Array.isArray(v.questions) ||
    v.questions.length !== (mode === "practice" ? 5 : 0)
  )
    throw new Error("Invalid AI response");
  for (const q of v.questions) {
    if (
      !q ||
      typeof q.prompt !== "string" ||
      !q.prompt.trim() ||
      q.prompt.length > 1500 ||
      !Array.isArray(q.choices) ||
      q.choices.length !== 4 ||
      q.choices.some(
        (c) => typeof c !== "string" || !c.trim() || c.length > 800,
      ) ||
      new Set(q.choices).size !== 4 ||
      !Number.isInteger(q.answer) ||
      q.answer < 0 ||
      q.answer > 3 ||
      typeof q.explanation !== "string" ||
      !q.explanation.trim() ||
      q.explanation.length > 2000
    )
      throw new Error("Invalid AI question");
  }
  return v;
}
export const studySchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "content", "questions"],
  properties: {
    title: { type: "string" },
    content: { type: "string" },
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["prompt", "choices", "answer", "explanation"],
        properties: {
          prompt: { type: "string" },
          choices: { type: "array", items: { type: "string" } },
          answer: { type: "integer" },
          explanation: { type: "string" },
        },
      },
    },
  },
};
