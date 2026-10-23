import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable } from "./Theme";
import { backend } from "./backend";
import { FeatureButton } from "./FeatureWorkflows";
import {
  validateStudyRequest,
  validateStudyResult,
} from "../supabase/functions/_shared/study-contract";
import type {
  StudyMode,
  StudyResult,
} from "../supabase/functions/_shared/study-contract";

async function invoke(body: unknown) {
  if (!backend) throw new Error("The study assistant is not connected yet.");
  const { data, error } = await backend.functions.invoke("study-assistant", {
    body: body as Record<string, unknown>,
    timeout: 115000,
  });
  if (error) {
    let message =
      "The study assistant could not connect. Check your connection and try again.";
    if (error.context instanceof Response) {
      try {
        const detail = await error.context.json();
        if (typeof detail.error === "string") message = detail.error;
      } catch {}
    }
    throw new Error(message);
  }
  return data;
}
export function StudyAssistant({
  userId,
  onSignIn,
}: {
  userId?: string;
  onSignIn: () => void;
}) {
  const [mode, setMode] = useState<StudyMode>("explain"),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false),
    [providerName, setProviderName] = useState("the configured AI provider"),
    [checking, setChecking] = useState(false),
    [limit, setLimit] = useState(0),
    [result, setResult] = useState<StudyResult | null>(null),
    [answers, setAnswers] = useState<Record<number, number>>({}),
    [checked, setChecked] = useState(false);
  const alive = useRef(true),
    lock = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function status() {
    if (!userId || lock.current) return;
    lock.current = true;
    setChecking(true);
    setNotice("");
    try {
      const data = await invoke({ action: "status" });
      if (alive.current) {
        setReady(data.ready === true);
        setProviderName(
          data.provider === "gemini"
            ? "Google Gemini"
            : data.provider === "openai"
              ? "OpenAI"
              : "the configured AI provider",
        );
        setLimit(data.daily_limit || 0);
        if (!data.ready)
          setNotice(
            "The study assistant is not available yet. Please check again later.",
          );
      }
    } catch (e) {
      if (alive.current) {
        setReady(false);
        setNotice((e as Error).message);
      }
    } finally {
      lock.current = false;
      if (alive.current) setChecking(false);
    }
  }
  useEffect(() => {
    void status();
  }, [userId]);
  async function generate() {
    if (lock.current || !userId || !ready) return;
    let request;
    try {
      request = validateStudyRequest({ mode, text });
    } catch (e) {
      setNotice((e as Error).message);
      return;
    }
    lock.current = true;
    setBusy(true);
    setNotice("");
    setResult(null);
    setAnswers({});
    setChecked(false);
    try {
      const data = await invoke(request);
      const output = validateStudyResult(data.result, mode);
      if (alive.current) {
        setResult(output);
        setNotice(
          `${data.remaining} requests remaining today. Limits reset at midnight UTC.`,
        );
      }
    } catch (e) {
      if (alive.current) setNotice((e as Error).message);
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <View style={{ gap: 16 }}>
      <Text style={{ fontSize: 28, fontWeight: "700" }}>
        AI study assistant
      </Text>
      <Text>
        Understand a topic, turn your notes into a summary, or practise what you
        have learned.
      </Text>
      <Text>
        AI can make mistakes. Check important answers with your textbook or
        teacher. Practice here does not affect your marks or leaderboard.
      </Text>
      {!userId ? (
        <>
          <Text>Sign in to use your study assistant.</Text>
          <FeatureButton label="Sign in for study help" onPress={onSignIn} />
        </>
      ) : (
        <>
          <Text accessibilityRole="alert">{notice}</Text>
          <FeatureButton
            label={
              checking
                ? "Checking availability…"
                : "Refresh assistant availability"
            }
            disabled={busy || checking}
            onPress={() => void status()}
          />
          {ready && (
            <Text>
              Up to {limit} requests per day. Failed generation attempts also
              count toward the limit.
            </Text>
          )}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {(
              [
                ["explain", "Explain a topic"],
                ["summarise", "Summarise notes"],
                ["practice", "Practice questions"],
              ] as const
            ).map(([value, label]) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{
                  selected: mode === value,
                  disabled: busy,
                }}
                disabled={busy}
                onPress={() => {
                  setMode(value);
                  setResult(null);
                  setAnswers({});
                  setChecked(false);
                }}
                style={{
                  padding: 12,
                  borderWidth: mode === value ? 2 : 1,
                  borderColor: mode === value ? "#16734b" : "#b5c9bd",
                  borderRadius: 10,
                }}
              >
                <Text>{label}</Text>
              </Pressable>
            ))}
          </View>
          <Text>
            {mode === "summarise"
              ? "Paste your own study notes"
              : "What are you studying?"}
          </Text>
          <TextInput
            accessibilityLabel="Study topic or notes"
            multiline
            value={text}
            onChangeText={setText}
            editable={!busy}
            maxLength={6000}
            placeholder={
              mode === "summarise"
                ? "Paste the notes you want to revise…"
                : "For example: explain photosynthesis with a simple example"
            }
            style={{
              minHeight: 150,
              borderWidth: 1,
              borderColor: "#b5c9bd",
              padding: 14,
              borderRadius: 12,
              textAlignVertical: "top",
            }}
          />
          <Text>
            {text.length}/6,000 characters. Your submitted text is sent to
            {providerName} to generate the answer. Leave out names, contact
            details and private information. This screen does not save your
            notes or answers.
          </Text>
          <FeatureButton
            label={
              busy
                ? "Preparing study help…"
                : mode === "practice"
                  ? "Create practice questions"
                  : mode === "summarise"
                    ? "Summarise my notes"
                    : "Explain this topic"
            }
            disabled={!ready || busy || checking || text.trim().length < 10}
            onPress={() => void generate()}
          />
          <FeatureButton
            label="Clear study session"
            disabled={busy}
            onPress={() => {
              setText("");
              setResult(null);
              setAnswers({});
              setChecked(false);
              setNotice("");
            }}
          />
        </>
      )}
      {result && (
        <View style={{ gap: 16 }}>
          <Text style={{ fontSize: 22, fontWeight: "700" }}>
            {result.title}
          </Text>
          <Text selectable>{result.content}</Text>
          {result.questions.map((q, index) => (
            <View
              key={index}
              style={{
                gap: 8,
                padding: 14,
                borderWidth: 1,
                borderColor: "#b5c9bd",
                borderRadius: 12,
              }}
            >
              <Text style={{ fontWeight: "700" }}>
                {index + 1}. {q.prompt}
              </Text>
              {q.choices.map((choice, i) => (
                <Pressable
                  key={i}
                  accessibilityRole="button"
                  accessibilityLabel={`Question ${index + 1}: ${choice}`}
                  accessibilityState={{
                    selected: answers[index] === i,
                    disabled: checked,
                  }}
                  disabled={checked}
                  onPress={() => setAnswers((a) => ({ ...a, [index]: i }))}
                  style={{
                    padding: 12,
                    borderWidth: answers[index] === i ? 2 : 1,
                    borderColor:
                      checked && q.answer === i ? "#16734b" : "#b5c9bd",
                  }}
                >
                  <Text>
                    {String.fromCharCode(65 + i)}. {choice}
                  </Text>
                </Pressable>
              ))}
              {checked && (
                <Text>
                  {answers[index] === q.answer ? "Correct." : "Not quite."}{" "}
                  Answer: {q.choices[q.answer]}. {q.explanation}
                </Text>
              )}
            </View>
          ))}
          {result.questions.length > 0 && (
            <FeatureButton
              label="Check practice answers"
              disabled={
                checked ||
                Object.keys(answers).length !== result.questions.length
              }
              onPress={() => setChecked(true)}
            />
          )}
          {checked && (
            <Text accessibilityRole="alert">
              You answered{" "}
              {
                result.questions.filter((q, i) => answers[i] === q.answer)
                  .length
              }{" "}
              of {result.questions.length} correctly. Review the explanations,
              then try another topic.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

export function StudyAssistantSettings() {
  const [enabled, setEnabled] = useState(false),
    [userLimit, setUserLimit] = useState("10"),
    [totalLimit, setTotalLimit] = useState("100"),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false),
    [notice, setNotice] = useState("");
  async function load() {
    setBusy(true);
    try {
      const r = await backend!
        .from("study_ai_settings")
        .select("*")
        .eq("id", true)
        .single();
      if (r.error) throw r.error;
      setEnabled(r.data.enabled);
      setUserLimit(String(r.data.daily_user_limit));
      setTotalLimit(String(r.data.daily_total_limit));
      setLoaded(true);
      const status = await invoke({ action: "status" });
      setNotice(
        status.configured
          ? "AI provider key is configured."
          : "AI provider key is missing. Add GEMINI_API_KEY (Gemini) or OPENAI_API_KEY (OpenAI) to Supabase Edge Function secrets before enabling.",
      );
    } catch {
      setNotice(
        "Could not load study assistant settings. Check deployment and retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  return (
    <View style={{ gap: 12, padding: 18 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>
        Study assistant controls
      </Text>
      <Text accessibilityRole="alert">{notice}</Text>
      <FeatureButton
        label="Refresh AI settings"
        disabled={busy}
        onPress={() => void load()}
      />
      <FeatureButton
        label={
          enabled
            ? "Assistant enabled — tap to disable"
            : "Assistant disabled — tap to enable"
        }
        disabled={busy || !loaded}
        onPress={() => setEnabled(!enabled)}
      />
      <Text>Daily requests per learner (1–50)</Text>
      <TextInput
        accessibilityLabel="Daily AI learner limit"
        value={userLimit}
        onChangeText={setUserLimit}
        keyboardType="number-pad"
      />
      <Text>Daily requests across the school (1–2,000)</Text>
      <TextInput
        accessibilityLabel="Daily AI school limit"
        value={totalLimit}
        onChangeText={setTotalLimit}
        keyboardType="number-pad"
      />
      <FeatureButton
        label="Save AI settings"
        disabled={busy || !loaded}
        onPress={() =>
          void (async () => {
            if (
              !/^\d+$/.test(userLimit) ||
              !/^\d+$/.test(totalLimit) ||
              Number(userLimit) < 1 ||
              Number(userLimit) > 50 ||
              Number(totalLimit) < 1 ||
              Number(totalLimit) > 2000
            ) {
              setNotice("Enter valid whole-number daily limits.");
              return;
            }
            setBusy(true);
            try {
              if (enabled) {
                const status = await invoke({ action: "status" });
                if (!status.configured)
                  throw new Error(
                    "Configure the AI provider key before enabling.",
                  );
              }
              const r = await backend!.rpc("configure_study_ai", {
                active: enabled,
                user_limit: Number(userLimit),
                total_limit: Number(totalLimit),
              });
              if (r.error)
                throw new Error(
                  "Could not save AI settings. Owner access is required.",
                );
              setNotice("Study assistant settings saved.");
            } catch (e) {
              setNotice((e as Error).message);
            } finally {
              setBusy(false);
            }
          })()
        }
      />
    </View>
  );
}
