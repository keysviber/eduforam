import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Speech from "expo-speech";
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
  const [message, setMessage] = useState("");
  const [completed, setCompleted] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const key = `ef-language-units-v1:${userId || "guest"}`;
  const course = curriculum[language];
  const words = course.units[unit];
  useEffect(() => {
    let active = true;
    setLoaded(false);
    setCompleted([]);
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (active) {
          const value = raw ? JSON.parse(raw) : [];
          setCompleted(
            Array.isArray(value)
              ? value.filter((x) => typeof x === "string")
              : [],
          );
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
        Start with greetings, then build up to everyday conversation. Complete
        each short check to unlock the next category. Progress stays on this
        device for your account.
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
              setMessage("");
            }}
          >
            <Text>{c.name}</Text>
          </Pressable>
        ))}
      </View>
      {languageCategories.map((category, i) => {
        const unlocked =
          loaded && (i === 0 || completed.includes(`${course.name}:${i - 1}`));
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
      {words.map(([word, meaning]) => (
        <View style={s.card} key={word}>
          <Text style={s.word}>{word}</Text>
          <Text>{meaning}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Listen to ${word}`}
            style={s.button}
            onPress={() => void pronounce(word)}
          >
            <Text>Listen to pronunciation</Text>
          </Pressable>
        </View>
      ))}
      <Text style={s.word}>
        Quick check {question + 1} of {words.length}: What does “
        {words[question][0]}” mean?
      </Text>
      {[...words].reverse().map(([, meaning]) => (
        <Pressable
          key={meaning}
          accessibilityRole="button"
          disabled={!loaded}
          style={s.button}
          onPress={async () => {
            if (meaning !== words[question][1]) {
              setMessage("Try again. Review the words above.");
              return;
            }
            if (question < words.length - 1) {
              setQuestion(question + 1);
              setMessage("Correct! Try the next word.");
              return;
            }
            const next = [...new Set([...completed, `${course.name}:${unit}`])];
            try {
              await AsyncStorage.setItem(key, JSON.stringify(next));
              setCompleted(next);
              setMessage(
                "Category complete! Choose the next category or practise again.",
              );
            } catch {
              setMessage("Could not save progress. Try the answer again.");
            }
          }}
        >
          <Text>{meaning}</Text>
        </Pressable>
      ))}
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
