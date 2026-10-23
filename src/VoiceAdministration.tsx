import React, { useState } from "react";
import { View, Text, TextInput } from "./Theme";
import { backend } from "./backend";
import { FeatureButton, useTask } from "./FeatureWorkflows";
import { SelectField } from "./FormControls";
import { uploadPrivate } from "./IdentitySettings";
import { curriculum } from "./discovery";
export function VoiceAdministration({ userId }: { userId?: string }) {
  const task = useTask(),
    [language, setLanguage] = useState(curriculum[0].code),
    [phrase, setPhrase] = useState(""),
    [speaker, setSpeaker] = useState(""),
    [permission, setPermission] = useState(""),
    [consent, setConsent] = useState(false),
    [path, setPath] = useState<string | null>(null);
  return (
    <View
      style={{
        gap: 12,
        padding: 16,
        backgroundColor: "white",
        borderRadius: 16,
      }}
    >
      <Text style={{ fontSize: 22, fontWeight: "700" }}>
        Human pronunciation recordings
      </Text>
      <Text>
        Use one recording per word or sentence, in a quiet room. WAV PCM 44.1 or
        48 kHz (16/24 bit, mono) is preferred; MP3 128 kbps or higher also
        works. No voice-cloning model is needed. Obtain the speaker's permission
        to publish the recordings in this app.
      </Text>
      <Text accessibilityRole="alert">{task.notice}</Text>
      <SelectField
        label="Recording language"
        value={language}
        options={curriculum.map((x) => ({ value: x.code, label: x.name }))}
        onChange={(v) => {
          setLanguage(v);
          setPhrase("");
        }}
      />
      <SelectField
        label="Recorded phrase"
        value={phrase}
        options={curriculum
          .find((x) => x.code === language)!
          .units.flat()
          .map(([word, meaning]) => ({
            value: word,
            label: `${word} — ${meaning}`,
          }))}
        onChange={setPhrase}
      />
      <TextInput
        accessibilityLabel="Voice owner credit"
        placeholder="Voice owner credit"
        value={speaker}
        onChangeText={setSpeaker}
      />
      <TextInput
        accessibilityLabel="Permission record"
        placeholder="Permission record or agreement reference (private)"
        value={permission}
        onChangeText={setPermission}
      />
      <FeatureButton
        label={
          consent
            ? "Speaker permission confirmed"
            : "Confirm speaker permission"
        }
        onPress={() => setConsent(!consent)}
      />
      <FeatureButton
        label={
          path ? "Recording attached - replace" : "Attach WAV or MP3 recording"
        }
        disabled={task.busy || !userId}
        onPress={() =>
          void task.run(async () => {
            const p = await uploadPrivate(
              "pronunciation",
              userId!,
              [
                "audio/mpeg",
                "audio/mp3",
                "audio/wav",
                "audio/x-wav",
                "audio/mp4",
              ],
              10 * 1024 * 1024,
            );
            if (p) setPath(p);
          })
        }
      />
      <FeatureButton
        label="Publish pronunciation recording"
        disabled={task.busy || !userId}
        onPress={() =>
          void task.run(async () => {
            if (
              !phrase ||
              !path ||
              !speaker.trim() ||
              permission.trim().length < 10 ||
              !consent
            )
              throw new Error(
                "Choose the phrase, attach audio and record the speaker's permission.",
              );
            const r = await backend!
              .from("pronunciation_audio")
              .upsert(
                {
                  language_code: language,
                  phrase,
                  path,
                  speaker: speaker.trim(),
                  permission_record: permission.trim(),
                  consent_confirmed: consent,
                  active: true,
                },
                { onConflict: "language_code,phrase" },
              );
            if (r.error) throw r.error;
            setPath(null);
            task.setNotice("Recorded pronunciation published.");
          })
        }
      />
    </View>
  );
}
