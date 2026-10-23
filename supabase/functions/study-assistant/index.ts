import { cors, json, service, user } from "../_shared/http.ts";
import { validateStudyRequest } from "../_shared/study-contract.ts";
import { generateStudy, StudyError } from "../_shared/study-provider.ts";
import {
  generateGeminiStudy,
  studyProviderConfig,
} from "../_shared/study-gemini.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  try {
    let who;
    try {
      who = await user(req);
    } catch {
      return json(
        { error: "Sign in with an active account to use the study assistant." },
        401,
      );
    }
    // Bound the body even if a caller omits or forges Content-Length.
    const reader = req.body?.getReader();
    if (!reader) return json({ error: "A study request is required." }, 400);
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 32000) {
        await reader.cancel();
        return json(
          { error: "This request is too large. Use up to 6,000 characters." },
          413,
        );
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    let body;
    try {
      body = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return json({ error: "Invalid study request." }, 400);
    }
    const db = service();
    const config = await db
      .from("study_ai_settings")
      .select("enabled,daily_user_limit")
      .eq("id", true)
      .single();
    if (config.error)
      throw new StudyError("The study assistant is not set up yet.");
    const { key, provider, model } = studyProviderConfig((name) =>
      Deno.env.get(name),
    );
    if (body?.action === "status")
      return json({
        ready: !!key && config.data.enabled,
        configured: !!key,
        provider,
        enabled: config.data.enabled,
        daily_limit: config.data.daily_user_limit,
      });
    let input;
    try {
      input = validateStudyRequest(body);
    } catch (e) {
      return json({ error: (e as Error).message }, 400);
    }
    if (!key || !config.data.enabled)
      throw new StudyError(
        "The study assistant is not available yet. Please try again after your school enables it.",
      );
    const profile = await db
      .from("profiles")
      .select("education_level,grade")
      .eq("id", who.id)
      .single();
    if (profile.error)
      throw new StudyError("Your education level could not be loaded.");
    const usage = await db.rpc("reserve_study_ai", { target_user: who.id });
    if (usage.error) {
      if (usage.error.message.includes("AI_DAILY_LIMIT"))
        throw new StudyError(
          "Today's study assistant limit has been reached. Please return tomorrow (limits reset at midnight UTC).",
          429,
        );
      if (usage.error.message.includes("AI_TOO_FAST"))
        throw new StudyError(
          "Please wait 10 seconds before another study request.",
          429,
        );
      throw new StudyError(
        "The study assistant is unavailable for this account.",
      );
    }
    const result = await (
      provider === "gemini" ? generateGeminiStudy : generateStudy
    )(
      input,
      profile.data.education_level || profile.data.grade || "school learner",
      key,
      model,
    );
    return json({ result, remaining: usage.data });
  } catch (e) {
    // Do not log learner material, provider responses or credentials.
    return json(
      {
        error:
          e instanceof StudyError
            ? e.message
            : "The study assistant could not complete this request. Try again later.",
      },
      e instanceof StudyError ? e.status : 503,
    );
  }
});
