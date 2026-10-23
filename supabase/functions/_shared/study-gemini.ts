import { studySchema, validateStudyResult } from "./study-contract.ts";
import type { StudyRequest, StudyResult } from "./study-contract.ts";
import { StudyError, studyInstructions } from "./study-provider.ts";

export async function generateGeminiStudy(
  request: StudyRequest,
  level: string,
  key: string,
  model: string,
  fetcher: typeof fetch = fetch,
): Promise<StudyResult> {
  if (!/^[a-zA-Z0-9._-]+$/.test(model))
    throw new StudyError(
      "The study assistant model needs administrator configuration.",
    );
  let response: Response;
  try {
    response = await fetcher(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(80000),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: studyInstructions(level) }] },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: JSON.stringify({
                    mode: request.mode,
                    study_material: request.text,
                  }),
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: studySchema,
            maxOutputTokens: 4096,
            ...(model === "gemini-3.1-flash-lite"
              ? { thinkingConfig: { thinkingLevel: "minimal" } }
              : {}),
          },
          safetySettings: [
            "HARM_CATEGORY_HARASSMENT",
            "HARM_CATEGORY_HATE_SPEECH",
            "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            "HARM_CATEGORY_DANGEROUS_CONTENT",
          ].map((category) => ({
            category,
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          })),
        }),
      },
    );
  } catch {
    throw new StudyError(
      "The study assistant timed out. Please try again later.",
    );
  }
  if (response.status === 401 || response.status === 403)
    throw new StudyError(
      "The AI provider rejected the server credential. Please ask your administrator to check the Gemini key and project permissions.",
    );
  if (response.status === 429)
    throw new StudyError(
      "The AI provider's usage limit has been reached. Please try again later.",
      429,
    );
  if (!response.ok)
    throw new StudyError(
      "The study assistant is temporarily unavailable. Please try again later.",
    );
  let data;
  try {
    data = await response.json();
  } catch {
    throw new StudyError(
      "The study assistant returned an unreadable response.",
    );
  }
  const candidate = data.candidates?.[0];
  if (
    data.promptFeedback?.blockReason ||
    candidate?.finishReason === "SAFETY" ||
    candidate?.safetyRatings?.some((r: { blocked?: boolean }) => r.blocked)
  )
    throw new StudyError(
      "I can help with school topics. Please rephrase this request for a classroom discussion or ask a trusted teacher for help.",
      422,
    );
  if (candidate?.finishReason !== "STOP")
    throw new StudyError(
      "The answer could not be completed. Try a shorter topic.",
      422,
    );
  try {
    const text = candidate.content.parts
      .filter(
        (p: { text?: unknown; thought?: boolean }) =>
          typeof p.text === "string" && !p.thought,
      )
      .map((p: { text: string }) => p.text)
      .join("");
    return validateStudyResult(JSON.parse(text), request.mode);
  } catch {
    throw new StudyError(
      "The answer was not in a usable format. Please try again.",
      502,
    );
  }
}

export function studyProviderConfig(get: (name: string) => string | undefined) {
  const provider =
    get("STUDY_AI_PROVIDER") || (get("GEMINI_API_KEY") ? "gemini" : "openai");
  if (provider !== "gemini" && provider !== "openai")
    throw new StudyError(
      "The study assistant provider needs administrator configuration.",
    );
  return {
    provider,
    key: get(provider === "gemini" ? "GEMINI_API_KEY" : "OPENAI_API_KEY"),
    model:
      get(provider === "gemini" ? "STUDY_GEMINI_MODEL" : "STUDY_AI_MODEL") ||
      (provider === "gemini" ? "gemini-3.5-flash-lite" : "gpt-4.1-mini"),
  };
}
