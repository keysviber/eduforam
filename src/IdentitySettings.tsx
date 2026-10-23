import { AdminAccess } from "./AdminAccess";
import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Image, Linking } from "./Theme";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { backend } from "./backend";
import { FeatureButton, useTask, ProfileSettings } from "./FeatureWorkflows";
import { SelectField } from "./FormControls";
import {
  educationSystems,
  levelsFor,
  canonicalGrade,
  subjects,
} from "./education";
import { useTheme } from "./Theme";
import { PushSettings } from "./PushSettings";
export async function uploadPrivate(
  bucket: string,
  uid: string,
  types: string[],
  limit: number,
) {
  const selected = await DocumentPicker.getDocumentAsync({
    type: types,
    copyToCacheDirectory: true,
  });
  if (selected.canceled) return null;
  const asset = selected.assets[0];
  if (!asset.mimeType || !types.includes(asset.mimeType))
    throw new Error("Choose one of the supported file formats.");
  const bytes = asset.file
    ? await asset.file.arrayBuffer()
    : await new File(asset.uri).arrayBuffer();
  if (bytes.byteLength > limit)
    throw new Error(
      `Choose a file under ${Math.floor(limit / 1024 / 1024)} MB.`,
    );
  const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2)}/${asset.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const r = await backend!.storage
    .from(bucket)
    .upload(path, bytes, { contentType: asset.mimeType });
  if (r.error) throw r.error;
  return path;
}
export function Avatar({
  path,
  size = 64,
}: {
  path?: string | null;
  size?: number;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let active = true;
    setUrl("");
    if (path && backend)
      void backend.storage
        .from("avatars")
        .createSignedUrl(path, 3600)
        .then((r) => {
          if (active && r.data) setUrl(r.data.signedUrl);
        });
    return () => {
      active = false;
    };
  }, [path]);
  return url ? (
    <Image
      accessibilityLabel="Profile picture"
      source={{ uri: url }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
    />
  ) : (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#dce9df",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: size / 2 }}>☆</Text>
    </View>
  );
}
export function IdentitySettings({
  userId,
  onEducationChanged,
}: {
  userId?: string;
  onEducationChanged: (grade: string, label?: string) => void;
}) {
  const task = useTask(),
    theme = useTheme();
  const [handle, setHandle] = useState(""),
    [profileRevision, setProfileRevision] = useState(0),
    [photo, setPhoto] = useState<string | null>(null),
    [system, setSystem] = useState("ZW"),
    [level, setLevel] = useState("");
  const [systems, setSystems] = useState(educationSystems),
    [levels, setLevels] = useState<
      { system_code: string; label: string; ordinal: number }[]
    >([]);
  useEffect(() => {
    if (!backend || !userId) return;
    void task.run(async () => {
      const [p, s, l] = await Promise.all([
        backend!
          .from("profiles")
          .select("username,avatar_path,education_system,education_level")
          .eq("id", userId)
          .single(),
        backend!.from("education_systems").select("code,name"),
        backend!
          .from("education_levels")
          .select("system_code,label,ordinal")
          .order("ordinal"),
      ]);
      if (p.error || s.error || l.error) throw p.error || s.error || l.error;
      setHandle(p.data.username);
      setPhoto(p.data.avatar_path);
      setSystem(p.data.education_system || "ZW");
      setLevel(p.data.education_level || "");
      setSystems(s.data || educationSystems);
      setLevels(l.data || []);
    });
  }, [userId]);
  return (
    <View style={{ gap: 16 }}>
      <Text style={{ fontSize: 26, fontWeight: "700" }}>Settings</Text>
      <FeatureButton
        label={theme.dark ? "Dark theme: on" : "Dark theme: off"}
        onPress={() => theme.setDark(!theme.dark)}
      />
      <Text accessibilityRole="alert">{task.notice}</Text>
      {!userId ? (
        <Text>Sign in to change your profile and education level.</Text>
      ) : (
        <>
          <Avatar path={photo} />
          <Text>Username: ☆{handle}</Text>
          <TextInput
            accessibilityLabel="Username"
            value={handle}
            onChangeText={setHandle}
            autoCapitalize="none"
            style={{ borderWidth: 1, borderColor: "#b5c9bd", padding: 12 }}
          />
          <FeatureButton
            label="Choose profile picture"
            disabled={task.busy}
            onPress={() =>
              void task.run(async () => {
                const path = await uploadPrivate(
                  "avatars",
                  userId,
                  ["image/jpeg", "image/png", "image/webp"],
                  5 * 1024 * 1024,
                );
                if (path) setPhoto(path);
              })
            }
          />
          <FeatureButton
            label="Save username and picture"
            disabled={task.busy}
            onPress={() =>
              void task.run(async () => {
                const r = await backend!.rpc("set_my_identity", {
                  handle,
                  photo,
                });
                if (r.error) throw r.error;
                task.setNotice("Username and profile picture saved.");
              })
            }
          />
          <SelectField
            label="Country / education system"
            value={system}
            options={systems.map((x) => ({ value: x.code, label: x.name }))}
            onChange={(v) => {
              setSystem(v);
              setLevel("");
            }}
          />
          <SelectField
            label="Education level"
            value={level}
            options={(levels.length
              ? levels.filter((x) => x.system_code === system)
              : levelsFor(system)
            ).map((x) => ({ value: x.label, label: x.label }))}
            onChange={setLevel}
          />
          <Text>
            Level comparisons are approximate, not qualifications equivalence.
            They help match learning material and quiz groups.
          </Text>
          <FeatureButton
            label="Save education level"
            disabled={task.busy || !level}
            onPress={() =>
              void task.run(async () => {
                const r = await backend!.rpc("set_my_education", {
                  system,
                  level_label: level,
                });
                if (r.error) throw r.error;
                const n = (
                  levels.length
                    ? levels.filter((x) => x.system_code === system)
                    : levelsFor(system)
                ).find((x) => x.label === level)!.ordinal;
                onEducationChanged(canonicalGrade(n), level);
                setProfileRevision((value) => value + 1);
                task.setNotice("Education level saved.");
              })
            }
          />
          <ProfileSettings key={profileRevision} userId={userId} />
          <VerificationCenter userId={userId} />
          <AdminAccess userId={userId} />
          <PushSettings userId={userId} />
        </>
      )}
      <Text style={{ textAlign: "center", padding: 18 }}>Powered by Xenus</Text>
    </View>
  );
}
type Application = {
  id: string;
  user_id: string;
  kind: string;
  subject: string;
  statement: string;
  id_path: string | null;
  video_path: string;
  status: string;
  reason: string;
};
export function VerificationCenter({
  userId,
  admin = false,
}: {
  userId?: string;
  admin?: boolean;
}) {
  const task = useTask();
  const [kind, setKind] = useState("teacher"),
    [subject, setSubject] = useState("Science"),
    [statement, setStatement] = useState(""),
    [idPath, setIdPath] = useState<string | null>(null),
    [video, setVideo] = useState<string | null>(null),
    [items, setItems] = useState<Application[]>([]),
    [reason, setReason] = useState("");
  async function load() {
    if (!backend || !userId) return;
    let q = backend
      .from("staff_applications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (!admin) q = q.eq("user_id", userId);
    const r = await q;
    if (r.error) throw r.error;
    setItems(r.data || []);
  }
  useEffect(() => {
    void task.run(load);
  }, [userId, admin]);
  async function open(path: string) {
    const r = await backend!.storage
      .from("verification")
      .createSignedUrl(path, 60);
    if (r.error) throw r.error;
    await Linking.openURL(r.data.signedUrl);
  }
  return (
    <View
      style={{
        gap: 12,
        padding: 18,
        backgroundColor: "white",
        borderRadius: 16,
      }}
    >
      <Text style={{ fontSize: 22, fontWeight: "700" }}>
        {admin
          ? "Review teacher and Safe Room applications"
          : "Teacher and Safe Room applications"}
      </Text>
      <Text accessibilityRole="alert">{task.notice}</Text>
      <FeatureButton
        label="Refresh applications"
        disabled={task.busy || !userId}
        onPress={() => void task.run(load)}
      />
      {!admin && userId && (
        <>
          <Text>
            Teacher accounts remain pending until an administrator reviews your
            ID and teaching video. Approved teachers can create classrooms and
            publish posts immediately. Safe Room applicants submit an
            introduction video; approved responders can read and reply to
            private support requests. These files are visible only to you and
            administrators.
          </Text>
          <SelectField
            label="Application type"
            value={kind}
            options={[
              { value: "teacher", label: "Teacher verification" },
              { value: "safe_responder", label: "Safe Room responder" },
            ]}
            onChange={setKind}
          />
          <SelectField
            label="Teaching subject"
            value={subject}
            options={subjects.map((x) => ({ value: x, label: x }))}
            onChange={setSubject}
          />
          <TextInput
            accessibilityLabel="Why you qualify"
            placeholder="Explain why you qualify"
            value={statement}
            onChangeText={setStatement}
            multiline
            style={{ padding: 12, borderWidth: 1, borderColor: "#b5c9bd" }}
          />
          {kind === "teacher" && (
            <FeatureButton
              label={idPath ? "ID attached - replace" : "Attach picture of ID"}
              disabled={task.busy}
              onPress={() =>
                void task.run(async () => {
                  const p = await uploadPrivate(
                    "verification",
                    userId,
                    ["image/jpeg", "image/png"],
                    5 * 1024 * 1024,
                  );
                  if (p) setIdPath(p);
                })
              }
            />
          )}
          <FeatureButton
            label={
              video
                ? "Application video attached - replace"
                : "Attach application video"
            }
            disabled={task.busy}
            onPress={() =>
              void task.run(async () => {
                const p = await uploadPrivate(
                  "verification",
                  userId,
                  ["video/mp4", "video/quicktime"],
                  50 * 1024 * 1024,
                );
                if (p) setVideo(p);
              })
            }
          />
          <FeatureButton
            label="Submit for verification"
            disabled={task.busy}
            onPress={() =>
              void task.run(async () => {
                if (
                  !video ||
                  (kind === "teacher" && !idPath) ||
                  statement.trim().length < 20
                )
                  throw new Error(
                    "Attach the required files and explain why you qualify (at least 20 characters).",
                  );
                const r = await backend!.from("staff_applications").insert({
                  user_id: userId,
                  kind,
                  subject,
                  statement: statement.trim(),
                  id_path: kind === "teacher" ? idPath : null,
                  video_path: video,
                });
                if (r.error) throw r.error;
                setStatement("");
                setVideo(null);
                setIdPath(null);
                await load();
                task.setNotice(
                  "Application submitted. It remains pending until reviewed.",
                );
              })
            }
          />
        </>
      )}
      {admin && (
        <TextInput
          accessibilityLabel="Verification decision reason"
          placeholder="Explain your decision"
          value={reason}
          onChangeText={setReason}
          style={{ padding: 12, borderWidth: 1, borderColor: "#b5c9bd" }}
        />
      )}
      {items.map((a) => (
        <View
          key={a.id}
          style={{
            gap: 8,
            padding: 12,
            borderWidth: 1,
            borderColor: "#b5c9bd",
          }}
        >
          <Text>
            {a.kind} · {a.status} · {a.subject}
          </Text>
          <Text>{a.statement}</Text>
          <Text>{a.reason}</Text>
          {a.id_path && (
            <FeatureButton
              label="View private ID"
              onPress={() => void task.run(() => open(a.id_path!))}
            />
          )}
          <FeatureButton
            label="View application video"
            onPress={() => void task.run(() => open(a.video_path))}
          />
          {admin &&
            a.status === "pending" &&
            [true, false].map((approve) => (
              <FeatureButton
                key={String(approve)}
                label={approve ? "Approve application" : "Reject application"}
                disabled={task.busy}
                onPress={() =>
                  void task.run(async () => {
                    const r = await backend!.rpc("review_staff", {
                      application: a.id,
                      approve,
                      reason,
                    });
                    if (r.error) throw r.error;
                    await load();
                  })
                }
              />
            ))}
        </View>
      ))}
    </View>
  );
}
