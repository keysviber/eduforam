import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "./Theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import { useVideoPlayer } from "expo-video";
import { backend } from "./backend";
import { curriculum, languageCategories } from "./discovery";
import { SelectField } from "./FormControls";

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
  const [voices, setVoices] = useState<Speech.Voice[]>([]);
  const [voiceChoice, setVoiceChoice] = useState("recorded");
  const [voiceReady, setVoiceReady] = useState(false);
  const pronunciationRequest = useRef(0);
  const recording = useVideoPlayer(null);
  const key = `ef-language-units-v1:${userId || "guest"}`;
  const course = curriculum[language];
  const voiceKey = `ef-pronunciation:${userId || "guest"}:${course.code}`;
  useEffect(() => {
    let active = true;
    setVoiceReady(false);
    setVoiceChoice("recorded");
    void Promise.all([
      Speech.getAvailableVoicesAsync().catch(() => [] as Speech.Voice[]),
      AsyncStorage.getItem(voiceKey).catch(() => null),
    ]).then(([available, saved]) => {
      if (!active) return;
      const matching = available.filter((v) =>
        v.language.toLowerCase().startsWith(course.code.slice(0, 2)),
      );
      setVoices(matching);
      setVoiceChoice(
        saved === "device" || matching.some((v) => v.identifier === saved)
          ? saved!
          : "recorded",
      );
      setVoiceReady(true);
    });
    return () => {
      active = false;
      pronunciationRequest.current++;
      void Speech.stop();
      recording.pause();
    };
  }, [voiceKey, recording]);
  function stopPronunciation() {
    pronunciationRequest.current++;
    void Speech.stop();
    recording.pause();
  }
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
    const request = ++pronunciationRequest.current;
    try {
      await Speech.stop();
      if (request !== pronunciationRequest.current) return;
      recording.pause();
      if (voiceChoice === "recorded" && backend && userId) {
        const audio = await backend
          .from("pronunciation_audio")
          .select("path,speaker")
          .eq("language_code", course.code)
          .eq("phrase", text)
          .eq("active", true)
          .maybeSingle();
        if (request !== pronunciationRequest.current) return;
        if (audio.data) {
          const file = await backend.storage
            .from("pronunciation")
            .createSignedUrl(audio.data.path, 300);
          if (request !== pronunciationRequest.current) return;
          if (!file.error) {
            await recording.replaceAsync(file.data.signedUrl);
            if (request !== pronunciationRequest.current) return;
            recording.play();
            setMessage(`Recorded pronunciation by ${audio.data.speaker}.`);
            return;
          }
        }
      }
      const voices = await Speech.getAvailableVoicesAsync();
      if (request !== pronunciationRequest.current) return;
      const matching = voices.filter((v) =>
        v.language.toLowerCase().startsWith(course.code.slice(0, 2)),
      );
      const voice =
        matching.find((v) => v.identifier === voiceChoice) ||
        matching.find((v) => v.quality === Speech.VoiceQuality.Enhanced) ||
        matching[0];
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
      setMessage(
        `Device pronunciation: ${voice.name}.${voiceChoice === "recorded" ? " No recording is available for this phrase." : ""}`,
      );
    } catch {
      if (request === pronunciationRequest.current)
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
              stopPronunciation();
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
      <SelectField
        label="Pronunciation voice"
        value={voiceChoice}
        options={[
          { value: "recorded", label: "Human recording when available" },
          { value: "device", label: "Best available device voice" },
          ...voices.map((v) => ({
            value: v.identifier,
            label: `${v.name} (${v.language})`,
          })),
        ]}
        onChange={(value) => {
          stopPronunciation();
          setVoiceChoice(value);
          void AsyncStorage.setItem(voiceKey, value).catch(() =>
            setMessage(
              "Voice changed for this visit; the preference could not be saved.",
            ),
          );
        }}
      />
      <Pressable
        accessibilityRole="button"
        onPress={stopPronunciation}
        style={s.button}
      >
        <Text>Stop pronunciation</Text>
      </Pressable>
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
              stopPronunciation();
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
              disabled={!voiceReady}
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
            stopPronunciation();
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
