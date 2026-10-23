import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, StyleSheet } from "./Theme";
import { backend } from "./backend";
import { FeatureButton } from "./FeatureWorkflows";
type Lesson = {
  id: string;
  language_id: string;
  title: string;
  level: string;
  active: boolean;
  content: { body?: string; question?: string; answer?: string };
};
export function CourseLibrary({
  userId,
  admin,
}: {
  userId?: string;
  admin: boolean;
}) {
  const [languages, setLanguages] = useState<
      { id: string; name: string; code: string }[]
    >([]),
    [lessons, setLessons] = useState<Lesson[]>([]),
    [progress, setProgress] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Lesson | null>(null),
    [answer, setAnswer] = useState(""),
    [review, setReview] = useState(false);
  const [language, setLanguage] = useState(""),
    [level, setLevel] = useState("beginner"),
    [title, setTitle] = useState(""),
    [body, setBody] = useState(""),
    [question, setQuestion] = useState(""),
    [solution, setSolution] = useState(""),
    [editing, setEditing] = useState<string | null>(null);
  const [languageName, setLanguageName] = useState(""),
    [languageCode, setLanguageCode] = useState("");
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const [allowed, setAllowed] = useState(true);
  const lock = useRef(false);
  async function run(fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setNotice((e as Error).message || "Unable to load learning. Try again.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function load() {
    if (!backend) return;
    const [l, c, access] = await Promise.all([
      backend!.from("languages").select("id,name,code").order("name"),
      backend!
        .from("lessons")
        .select("id,language_id,title,level,content,active")
        .order("title"),
      backend.rpc("has_feature_access", { feature: "language_courses" }),
    ]);
    if (l.error || c.error || access.error)
      throw l.error || c.error || access.error;
    setAllowed(access.data === true);
    setLanguages(l.data || []);
    setLessons(c.data || []);
    if (!language && l.data?.length) setLanguage(l.data[0].id);
    if (userId) {
      const p = await backend!
        .from("learning_progress")
        .select("lesson_id,progress")
        .eq("user_id", userId);
      if (p.error) throw p.error;
      setProgress(
        Object.fromEntries(
          (p.data || []).map((x) => [x.lesson_id, x.progress]),
        ),
      );
    }
  }
  useEffect(() => {
    void run(load);
  }, [userId, admin]);
  const field = (
    label: string,
    value: string,
    change: (v: string) => void,
    multiline = false,
  ) => (
    <View>
      <Text>{label}</Text>
      <TextInput
        style={s.input}
        accessibilityLabel={label}
        value={value}
        onChangeText={change}
        multiline={multiline}
      />
    </View>
  );
  async function saveProgress(value: number) {
    if (!userId || !selected)
      throw new Error("Sign in to save your progress across devices.");
    const r = await backend!.from("learning_progress").upsert({
      user_id: userId,
      lesson_id: selected.id,
      progress: value,
      updated_at: new Date().toISOString(),
    });
    if (r.error) throw r.error;
    setProgress({ ...progress, [selected.id]: value });
  }
  return (
    <View style={s.stack}>
      <Text style={s.title}>Language courses</Text>
      <Text>
        Study a lesson first. Start its separate review when you are ready. Your
        signed-in progress follows your account.
      </Text>
      {!!notice && <Text accessibilityRole="alert">{notice}</Text>}
      <FeatureButton
        label="Refresh courses"
        disabled={busy || !backend}
        onPress={() => void run(load)}
      />
      {!backend && (
        <Text>Connect the learning service to access published courses.</Text>
      )}
      {!allowed && (
        <Text>
          These courses require an active plan. Open You, then Explore Premier
          to view available plans or restore your purchase.
        </Text>
      )}
      {allowed && !lessons.length && (
        <Text>
          No courses have been published yet. Introductory vocabulary is
          available under Learn a language.
        </Text>
      )}
      {selected ? (
        <View style={s.card}>
          <Text style={s.title}>{selected.title}</Text>
          <Text>{selected.level}</Text>
          {!review ? (
            <>
              <Text style={s.body}>
                {selected.content.body || "No lesson text available."}
              </Text>
              <FeatureButton
                label="Save for later"
                disabled={busy || !userId}
                onPress={() =>
                  void run(async () => {
                    await saveProgress(
                      Math.max(progress[selected.id] || 0, 50),
                    );
                    setNotice("Study progress saved.");
                  })
                }
              />
              <FeatureButton
                label="Start lesson review"
                disabled={!selected.content.question}
                onPress={() => {
                  setReview(true);
                  setAnswer("");
                  setNotice("");
                }}
              />
            </>
          ) : (
            <>
              <Text>{selected.content.question}</Text>
              {field("Your answer", answer, setAnswer)}
              <FeatureButton
                label="Check answer"
                disabled={busy}
                onPress={() =>
                  void run(async () => {
                    if (
                      answer.trim().toLocaleLowerCase() !==
                      selected.content.answer?.trim().toLocaleLowerCase()
                    )
                      throw new Error(
                        "Try again, or return to study for a refresher.",
                      );
                    if (userId) await saveProgress(100);
                    setNotice(
                      userId
                        ? "Correct. Lesson completed and progress saved."
                        : "Correct. Sign in to save your progress.",
                    );
                  })
                }
              />
              <FeatureButton
                label="Return to lesson"
                onPress={() => setReview(false)}
              />
            </>
          )}
          <FeatureButton
            label="Back to courses"
            onPress={() => {
              setSelected(null);
              setReview(false);
              setNotice("");
            }}
          />
        </View>
      ) : (
        lessons
          .filter((l) => l.active)
          .map((l) => (
            <View key={l.id} style={s.card}>
              <Text style={s.title}>{l.title}</Text>
              <Text>
                {languages.find((x) => x.id === l.language_id)?.name} -{" "}
                {l.level} - {progress[l.id] || 0}%
              </Text>
              <FeatureButton
                label={`Study ${l.title}`}
                onPress={() => {
                  setSelected(l);
                  setReview(false);
                  setNotice("");
                }}
              />
            </View>
          ))
      )}
      {admin && backend && (
        <View style={s.card}>
          <Text style={s.title}>Manage language courses</Text>
          {languages.map((l) => (
            <FeatureButton
              key={l.id}
              label={`${language === l.id ? "Selected: " : ""}${l.name}`}
              onPress={() => setLanguage(l.id)}
            />
          ))}
          {["beginner", "intermediate", "advanced"].map((l) => (
            <FeatureButton
              key={l}
              label={`${level === l ? "Selected: " : ""}${l}`}
              onPress={() => setLevel(l)}
            />
          ))}
          {field("Lesson title", title, setTitle)}
          {field("Lesson text", body, setBody, true)}
          {field("Review question", question, setQuestion, true)}
          {field("Expected answer", solution, setSolution)}
          <FeatureButton
            label={editing ? "Save lesson draft" : "Create lesson draft"}
            disabled={busy}
            onPress={() =>
              void run(async () => {
                if (
                  !language ||
                  title.trim().length < 4 ||
                  body.trim().length < 20 ||
                  !question.trim() ||
                  !solution.trim()
                )
                  throw new Error(
                    "Choose a language and complete the lesson and review fields.",
                  );
                const values = {
                  language_id: language,
                  title: title.trim(),
                  level,
                  content: {
                    body: body.trim(),
                    question: question.trim(),
                    answer: solution.trim(),
                  },
                  active: false,
                };
                const r = editing
                  ? await backend!
                      .from("lessons")
                      .update(values)
                      .eq("id", editing)
                  : await backend!.from("lessons").insert(values);
                if (r.error) throw r.error;
                setEditing(null);
                setTitle("");
                setBody("");
                setQuestion("");
                setSolution("");
                await load();
                setNotice("Draft saved. Publish it below when reviewed.");
              })
            }
          />
          {lessons.map((l) => (
            <View key={l.id} style={s.card}>
              <Text>
                {l.title} - {l.active ? "Published" : "Draft"}
              </Text>
              <FeatureButton
                label={`Edit ${l.title}`}
                disabled={busy}
                onPress={() => {
                  setEditing(l.id);
                  setLanguage(l.language_id);
                  setLevel(l.level);
                  setTitle(l.title);
                  setBody(l.content.body || "");
                  setQuestion(l.content.question || "");
                  setSolution(l.content.answer || "");
                }}
              />
              <FeatureButton
                label={l.active ? `Unpublish ${l.title}` : `Publish ${l.title}`}
                disabled={busy}
                onPress={() =>
                  void run(async () => {
                    const r = await backend!
                      .from("lessons")
                      .update({ active: !l.active })
                      .eq("id", l.id);
                    if (r.error) throw r.error;
                    await load();
                  })
                }
              />
            </View>
          ))}
          <Text style={s.title}>Add a language</Text>
          {field("Language name", languageName, setLanguageName)}
          {field("Language code", languageCode, setLanguageCode)}
          <FeatureButton
            label="Add language"
            disabled={busy}
            onPress={() =>
              void run(async () => {
                if (
                  languageName.trim().length < 2 ||
                  !/^[a-z]{2,3}(-[A-Z]{2})?$/.test(languageCode.trim())
                )
                  throw new Error(
                    "Enter a language name and a code such as fr or fr-FR.",
                  );
                const r = await backend!.from("languages").insert({
                  name: languageName.trim(),
                  code: languageCode.trim(),
                  active: true,
                });
                if (r.error) throw r.error;
                setLanguageName("");
                setLanguageCode("");
                await load();
              })
            }
          />
        </View>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  stack: { gap: 12 },
  card: {
    padding: 18,
    gap: 12,
    backgroundColor: "white",
    borderRadius: 14,
    marginVertical: 8,
  },
  title: { fontSize: 22, fontWeight: "700", color: "#244d41" },
  body: { fontSize: 17, lineHeight: 27 },
  input: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#c8d6cb",
    marginTop: 6,
  },
});
