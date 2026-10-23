import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "./Theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import { useVideoPlayer } from "expo-video";
import { backend } from "./backend";
import { curriculum, languageCategories } from "./discovery";

export function Languages({
  userId,
  initialLanguage,
}: {
  userId?: string;
  initialLanguage?: string;
}) {
  const [language, setLanguage] = useState(() =>
    Math.max(
      0,
      curriculum.findIndex((c) => c.name === initialLanguage),
    ),
  );
  const [unit, setUnit] = useState(0);
  const [question, setQuestion] = useState(0);
  const [mode, setMode] = useState<"study" | "quiz" | "done">("study");
  const [message, setMessage] = useState("");
  const [completed, setCompleted] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const recording = useVideoPlayer(null);
  const key = `ef-language-units-v1:${userId || "guest"}`;
  const course = curriculum[language];
  const words = course.units[unit];
  const reviewWords = course.units.flat();
  const reviewChoices =
    course.units.find((items) => items.includes(reviewWords[question])) ||
    words;
  useEffect(() => {
    let active = true;
    setLoaded(false);
    setCompleted([]);
    AsyncStorage.getItem(key)
      .then(async (raw) => {
        if (active) {
          const value = raw ? JSON.parse(raw) : [];
          let restored: string[] = Array.isArray(value)
            ? value.filter((x) => typeof x === "string")
            : [];
          if (backend && userId) {
            const remote = await backend
              .from("language_reviews")
              .select("unit_key")
              .eq("user_id", userId);
            if (!active) return;
            if (remote.error)
              setMessage(
                "Using saved device progress. Reopen learning when connected to sync your progress.",
              );
            else
              restored = [
                ...new Set([
                  ...restored,
                  ...(remote.data || []).map((x) => x.unit_key),
                ]),
              ];
          }
          setCompleted(restored);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (active)
          setMessage("Could not load progress. Reopen learning to retry.");
      });
    return () => {
      active = false;
      void Speech.stop();
    };
  }, [key]);
  async function pronounce(text: string) {
    try {
      await Speech.stop();
      recording.pause();
      if (backend && userId) {
        const audio = await backend
          .from("pronunciation_audio")
          .select("path,speaker")
          .eq("language_code", course.code)
          .eq("phrase", text)
          .eq("active", true)
          .maybeSingle();
        if (audio.error) throw audio.error;
        if (audio.data) {
          const file = await backend.storage
            .from("pronunciation")
            .createSignedUrl(audio.data.path, 300);
          if (file.error) throw file.error;
          await recording.replaceAsync(file.data.signedUrl);
          recording.play();
          setMessage(`Recorded pronunciation by ${audio.data.speaker}.`);
          return;
        }
      }
      const voices = await Speech.getAvailableVoicesAsync();
      const voice = voices.find((v) =>
        v.language.toLowerCase().startsWith(course.code.slice(0, 2)),
      );
      if (!voice) {
        setMessage(
          "Install a voice for this language in your device speech settings, then retry.",
        );
        return;
      }
      Speech.speak(text, {
        language: course.code,
        voice: voice.identifier,
        rate: 0.8,
        onError: () =>
          setMessage(
            "Pronunciation could not play. Check your device voice settings.",
          ),
      });
    } catch {
      setMessage("Pronunciation is unavailable on this device.");
    }
  }
  return (
    <View style={s.stack}>
      <Text style={s.title}>Learn a language</Text>
      <Text>
        Start with greetings, then build up to everyday conversation. Study all
        categories at your own pace, then choose a separate review quiz.
        Signed-in progress syncs to your account. Human recordings are used when
        available; otherwise the app uses your installed language voice.
      </Text>
      <View style={s.row}>
        {curriculum.map((c, i) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: language === i }}
            style={[s.button, language === i && s.selected]}
            key={c.name}
            onPress={() => {
              void Speech.stop();
              setLanguage(i);
              setUnit(0);
              setQuestion(0);
              setMode("study");
              setMessage("");
            }}
          >
            <Text>{c.name}</Text>
          </Pressable>
        ))}
      </View>
      {languageCategories.map((category, i) => {
        const unlocked = loaded;
        return (
          <Pressable
            key={category}
            accessibilityRole="button"
            accessibilityState={{ disabled: !unlocked, selected: unit === i }}
            disabled={!unlocked}
            style={[
              s.button,
              unit === i && s.selected,
              !unlocked && { opacity: 0.5 },
            ]}
            onPress={() => {
              void Speech.stop();
              setUnit(i);
              setQuestion(0);
              setMode("study");
              setMessage("");
            }}
          >
            <Text>
              {i + 1}. {category}
              {completed.includes(`${course.name}:${i}`)
                ? " · Complete"
                : !unlocked
                  ? " · Locked"
                  : ""}
            </Text>
          </Pressable>
        );
      })}
      <Text style={s.title}>
        {course.name} · {languageCategories[unit]}
      </Text>
      {mode === "study" &&
        words.map(([word, meaning]) => (
          <View style={s.card} key={word}>
            <Text style={s.word}>{word}</Text>
            <Text>{meaning}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Listen to ${word}`}
              style={s.button}
              onPress={() => void pronounce(word)}
            >
              <Ionicons name="volume-high" size={24} color="#245642" />
            </Pressable>
          </View>
        ))}
      {mode === "study" && (
        <Pressable
          accessibilityRole="button"
          style={s.button}
          disabled={!loaded}
          onPress={() => {
            void Speech.stop();
            setQuestion(0);
            setMessage("");
            setMode("quiz");
          }}
        >
          <Text>Start review quiz - all categories</Text>
        </Pressable>
      )}
      {mode !== "study" && (
        <Pressable
          accessibilityRole="button"
          style={s.button}
          onPress={() => {
            setMode("study");
            setMessage("");
          }}
        >
          <Text>Return to study</Text>
        </Pressable>
      )}
      {mode === "done" && (
        <Text>
          Review complete! Keep studying and come back for another review
          whenever you are ready.
        </Text>
      )}
      {mode === "quiz" && (
        <>
          <Text style={s.word}>
            Review question {question + 1} of {reviewWords.length}: What does “
            {reviewWords[question][0]}” mean?
          </Text>
          {[...new Set(reviewChoices.map(([, meaning]) => meaning))]
            .reverse()
            .map((meaning) => (
              <Pressable
                key={meaning}
                accessibilityRole="button"
                disabled={!loaded}
                style={s.button}
                onPress={async () => {
                  if (meaning !== reviewWords[question][1]) {
                    setMessage(
                      "Try again, or return to study for a refresher.",
                    );
                    return;
                  }
                  if (question < reviewWords.length - 1) {
                    setQuestion(question + 1);
                    setMessage("Correct! Try the next word.");
                    return;
                  }
                  const next = [
                    ...new Set([
                      ...completed,
                      ...course.units.map((_, i) => `${course.name}:${i}`),
                    ]),
                  ];
                  try {
                    if (backend && userId) {
                      const r = await backend.from("language_reviews").upsert(
                        next.map((unit_key) => ({
                          user_id: userId,
                          unit_key,
                        })),
                      );
                      if (r.error) throw r.error;
                    }
                    await AsyncStorage.setItem(key, JSON.stringify(next));
                    setCompleted(next);
                    setMode("done");
                    setMessage(
                      "All categories reviewed. Your progress is saved.",
                    );
                  } catch {
                    setMessage(
                      "Could not save progress. Try the answer again.",
                    );
                  }
                }}
              >
                <Text>{meaning}</Text>
              </Pressable>
            ))}
        </>
      )}
      {!!message && <Text accessibilityRole="alert">{message}</Text>}
    </View>
  );
}
const s = StyleSheet.create({
  stack: { gap: 14 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  title: { fontSize: 25, fontWeight: "700", color: "#244d41" },
  word: { fontSize: 18, fontWeight: "600" },
  button: { padding: 14, borderRadius: 12, backgroundColor: "#edf1e8" },
  selected: { borderWidth: 2, borderColor: "#244d41" },
  card: { padding: 18, borderRadius: 16, backgroundColor: "white", gap: 10 },
});
