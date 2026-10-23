import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Share } from "./Theme";
import { contentLink, parseContentLink } from "./content-links";
import * as Clipboard from "expo-clipboard";
import { backend } from "./backend";
import { useBilling } from "./Billing";
import { grades } from "./discovery";
import { canonicalGrade } from "./education";
import { useEducationCatalog } from "./education-catalog";
import { SelectField } from "./FormControls";
import type { Entry } from "./domain";

export function GradePicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (grade: string) => void;
}) {
  const catalog = useEducationCatalog(),
    [system, setSystem] = useState("ZW");
  useEffect(() => {
    let active = true;
    if (backend)
      void backend.auth.getUser().then(async (r) => {
        if (!r.data.user) return;
        const p = await backend!
          .from("profiles")
          .select("education_system")
          .eq("id", r.data.user.id)
          .single();
        if (active && p.data?.education_system)
          setSystem(p.data.education_system);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <SelectField
      label="Resource education level"
      value={value || ""}
      options={catalog
        .levelsForSystem(system)
        .map((x) => ({ value: canonicalGrade(x.ordinal), label: x.label }))}
      onChange={onChange}
    />
  );
}
type Room = {
  id: string;
  title: string;
  grade: string;
  join_code: string;
  owner_id: string;
  price_minor: number;
  currency: string;
};
type Request = {
  id: string;
  message: string;
  response: string;
  status: string;
  created_at: string;
};
export function SchoolFeatures({
  page,
  userId,
  admin,
  entries,
  openEntry,
  signIn,
  teacher = false,
  responder = false,
  invitation = "",
}: {
  page: string;
  userId?: string;
  admin: boolean;
  entries: Entry[];
  openEntry: (e: Entry) => void;
  signIn: () => void;
  teacher?: boolean;
  responder?: boolean;
  invitation?: string;
}) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const billing = useBilling();
  const [offer, setOffer] = useState<{
    id: string;
    title: string;
    product_id: string;
    storePrice: string;
    code: string;
  } | null>(null);
  const [links, setLinks] = useState<
    { classroom_id: string; entry_id: string }[]
  >([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [code, setCode] = useState("");
  const [price, setPrice] = useState("0");
  const [title, setTitle] = useState("");
  const [grade, setGrade] = useState("Form 1");
  const [message, setMessage] = useState("");
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [rosters, setRosters] = useState<
    Record<
      string,
      { user_id: string; username: string; display_name: string }[]
    >
  >({});
  useEffect(() => {
    if (invitation) setCode(contentLink("join", invitation));
  }, [invitation]);
  async function load() {
    if (!backend || !userId) return;
    if (page === "Classrooms") {
      const [r, l] = await Promise.all([
        backend.from("classrooms").select("*"),
        backend.from("classroom_lessons").select("*"),
      ]);
      if (r.error || l.error) throw r.error || l.error;
      setRooms(r.data || []);
      setLinks(l.data || []);
    } else {
      const [settings, r] = await Promise.all([
        backend.from("support_settings").select("enabled").single(),
        backend
          .from("support_requests")
          .select("id,message,response,status,created_at")
          .order("created_at", { ascending: false }),
      ]);
      if (settings.error || r.error) throw settings.error || r.error;
      setEnabled(settings.data.enabled);
      setRequests(r.data || []);
    }
  }
  async function act(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setNotice(
        e instanceof Error
          ? e.message
          : (e as { message?: string })?.message ||
              "Could not complete this action. Retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void act(load);
  }, [page, userId]);
  function Action({ label, onPress }: { label: string; onPress: () => void }) {
    return (
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        accessibilityState={{ disabled: busy }}
        style={s.button}
        onPress={onPress}
      >
        <Text>{label}</Text>
      </Pressable>
    );
  }
  if (!backend)
    return (
      <View style={s.card}>
        <Text style={s.title}>
          {page === "Classrooms" ? "Join a classroom" : "Safe Room"}
        </Text>
        <Text>
          This feature needs the school service to be connected. No requests or
          memberships are sent in demo mode.
        </Text>
      </View>
    );
  if (!userId)
    return (
      <View style={s.card}>
        <Text>
          Sign in to{" "}
          {page === "Classrooms"
            ? "join your classroom"
            : "access private support"}
          .
        </Text>
        <Action label="Sign in / Create account" onPress={signIn} />
      </View>
    );
  return (
    <View style={s.stack}>
      <Text style={s.title}>
        {page === "Classrooms" ? "Your classrooms" : "Safe Room"}
      </Text>
      {!!notice && <Text accessibilityRole="alert">{notice}</Text>}
      <Action
        label={busy ? "Loading…" : "Refresh"}
        onPress={() => void act(load)}
      />
      {page === "Classrooms" ? (
        <>
          <Text>
            Open the invitation link shared by your teacher. You can also paste
            the full invitation link here. Mobile links require the installed
            app.
          </Text>
          <TextInput
            placeholderTextColor="#526477"
            accessibilityLabel="Classroom invitation link"
            placeholder="Paste invitation link"
            autoCapitalize="none"
            value={code}
            onChangeText={setCode}
            style={s.input}
          />
          <Action
            label="Join classroom"
            onPress={() =>
              void act(async () => {
                const parsed = parseContentLink(code.trim());
                const inviteCode =
                  parsed?.kind === "join" ? parsed.id : invitation;
                if (!inviteCode)
                  throw new Error(
                    "Open or paste the full invitation link from your teacher.",
                  );
                setOffer(null);
                const lookup = await backend!.rpc("classroom_offer", {
                  invite_code: inviteCode,
                });
                if (lookup.error) throw lookup.error;
                const room = lookup.data?.[0];
                if (!room) throw new Error("Invitation code not found.");
                if (room.price_minor > 0) {
                  const access = await backend!.rpc("has_classroom_access", {
                    room_id: room.id,
                  });
                  if (access.error) throw access.error;
                  if (!access.data) {
                    if (!room.product_id)
                      throw new Error(
                        "This paid classroom's store product is not configured yet. Contact the teacher.",
                      );
                    const storePrice = await billing.price(room.product_id);
                    setOffer({ ...room, storePrice, code: inviteCode });
                    return;
                  }
                }
                const { error } = await backend!.rpc("join_classroom", {
                  invite_code: inviteCode,
                });
                if (error) throw error;
                setCode("");
                await load();
                setNotice("You joined the classroom.");
              })
            }
          />
          {offer && (
            <View style={s.card}>
              <Text style={s.title}>{offer.title}</Text>
              <Text>
                Store price: {offer.storePrice}. This purchase also removes ads.
              </Text>
              <Action
                label={`Buy & join · ${offer.storePrice}`}
                onPress={() =>
                  void act(async () => {
                    await billing.purchase(offer.product_id);
                    const r = await backend!.rpc("join_classroom", {
                      invite_code: offer.code,
                    });
                    if (r.error) throw r.error;
                    setOffer(null);
                    setCode("");
                    await load();
                    setNotice("Purchase verified. You joined the classroom.");
                  })
                }
              />
              <Action
                label="Restore existing purchase"
                onPress={() =>
                  void act(async () => {
                    await billing.restore();
                    const r = await backend!.rpc("join_classroom", {
                      invite_code: offer.code,
                    });
                    if (r.error) throw r.error;
                    setOffer(null);
                    await load();
                  })
                }
              />
              <Action label="Cancel" onPress={() => setOffer(null)} />
            </View>
          )}
          {!rooms.length && (
            <Text>No classrooms yet. Ask your teacher for an invitation.</Text>
          )}
          {rooms.map((room) => (
            <View key={room.id} style={s.card}>
              <Text style={s.title}>{room.title}</Text>
              <Text>{room.grade}</Text>
              <Text>
                {room.price_minor
                  ? `${room.currency} ${(room.price_minor / 100).toFixed(2)}`
                  : "Free classroom"}
              </Text>
              {(admin || room.owner_id === userId) && (
                <View style={{ gap: 8 }}>
                  <Text selectable>{contentLink("join", room.join_code)}</Text>
                  <Action
                    label="Copy classroom invitation"
                    onPress={() =>
                      void act(async () => {
                        await Clipboard.setStringAsync(
                          contentLink("join", room.join_code),
                        );
                        setNotice("Invitation link copied.");
                      })
                    }
                  />
                  <Action
                    label="Share classroom invitation"
                    onPress={() =>
                      void Share.share({
                        message: `Join ${room.title}: ${contentLink("join", room.join_code)}`,
                        url: contentLink("join", room.join_code),
                      })
                    }
                  />
                  <Action
                    label="View joined students"
                    onPress={() =>
                      void act(async () => {
                        const r = await backend!.rpc("classroom_roster", {
                          room: room.id,
                        });
                        if (r.error) throw r.error;
                        setRosters({ ...rosters, [room.id]: r.data || [] });
                      })
                    }
                  />
                  {rosters[room.id]?.map((p) => (
                    <Text key={p.user_id}>
                      ☆{p.username} · {p.display_name}
                    </Text>
                  ))}
                  {rosters[room.id]?.length === 0 && (
                    <Text>No students have joined yet.</Text>
                  )}
                </View>
              )}
              {links
                .filter((l) => l.classroom_id === room.id)
                .map((l) => {
                  const entry = entries.find(
                    (e) => e.id === l.entry_id && e.status === "approved",
                  );
                  return entry ? (
                    <View key={l.entry_id}>
                      <Action
                        label={entry.title}
                        onPress={() => openEntry(entry)}
                      />
                      {(admin || room.owner_id === userId) && (
                        <Action
                          label={`Remove ${entry.title} from classroom`}
                          onPress={() =>
                            void act(async () => {
                              const { error } = await backend!
                                .from("classroom_lessons")
                                .delete()
                                .eq("classroom_id", room.id)
                                .eq("entry_id", entry.id);
                              if (error) throw error;
                              await load();
                            })
                          }
                        />
                      )}
                    </View>
                  ) : null;
                })}
              {!links.some((l) => l.classroom_id === room.id) && (
                <Text>Your teacher has not shared resources yet.</Text>
              )}
              {admin || room.owner_id === userId ? (
                <Action
                  label="Choose resources"
                  onPress={() =>
                    setSelected(selected === room.id ? null : room.id)
                  }
                />
              ) : (
                <Action
                  label="Leave classroom"
                  onPress={() =>
                    void act(async () => {
                      const { error } = await backend!
                        .from("classroom_members")
                        .delete()
                        .eq("classroom_id", room.id)
                        .eq("user_id", userId);
                      if (error) throw error;
                      await load();
                    })
                  }
                />
              )}
              {(admin || room.owner_id === userId) &&
                selected === room.id &&
                entries
                  .filter(
                    (e) =>
                      e.status === "approved" &&
                      ["book", "course", "reel"].includes(e.kind) &&
                      !links.some(
                        (l) =>
                          l.classroom_id === room.id && l.entry_id === e.id,
                      ),
                  )
                  .map((e) => (
                    <Action
                      key={e.id}
                      label={`Add ${e.title}`}
                      onPress={() =>
                        void act(async () => {
                          const { error } = await backend!
                            .from("classroom_lessons")
                            .insert({ classroom_id: room.id, entry_id: e.id });
                          if (error) throw error;
                          await load();
                        })
                      }
                    />
                  ))}
            </View>
          ))}
          {userId && (admin || teacher) && (
            <View style={s.card}>
              <Text style={s.title}>Create classroom</Text>
              <TextInput
                placeholderTextColor="#526477"
                accessibilityLabel="Classroom title"
                placeholder="Classroom title"
                value={title}
                onChangeText={setTitle}
                style={s.input}
              />
              <TextInput
                accessibilityLabel="Classroom price in USD"
                placeholder="Price in USD (0 for free)"
                placeholderTextColor="#526477"
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
                style={s.input}
              />
              <Text>
                Price in USD. Paid enrolment requires payment setup before
                students can join.
              </Text>
              <GradePicker value={grade} onChange={setGrade} />
              <Action
                label="Create classroom"
                onPress={() =>
                  void act(async () => {
                    if (
                      !/^\d+(\.\d{1,2})?$/.test(price) ||
                      Number(price) > 100000
                    )
                      throw new Error(
                        "Enter a valid price with up to two decimal places.",
                      );
                    const { error } = await backend!.from("classrooms").insert({
                      title: title.trim(),
                      grade,
                      owner_id: userId,
                      price_minor: Math.round(Number(price) * 100),
                      currency: "USD",
                    });
                    if (error) throw error;
                    setTitle("");
                    await load();
                  })
                }
              />
            </View>
          )}
        </>
      ) : (
        <>
          <Text>
            A private request to the school’s authorised administrators. Other
            students cannot see it. This is not an emergency service and replies
            are not immediate. If you are in immediate danger, contact local
            emergency services or a trusted adult now.
          </Text>
          {admin && (
            <Action
              label={
                enabled
                  ? "Disable new support requests"
                  : "Enable staffed support requests"
              }
              onPress={() =>
                void act(async () => {
                  const { error } = await backend!
                    .from("support_settings")
                    .update({ enabled: !enabled })
                    .eq("id", true);
                  if (error) throw error;
                  await load();
                })
              }
            />
          )}
          {!enabled ? (
            <Text>
              School support requests are not currently available. Please speak
              to a trusted teacher or adult.
            </Text>
          ) : null}
          <>
            <TextInput
              placeholderTextColor="#526477"
              accessibilityLabel="Private support message"
              placeholder="What would you like support with?"
              multiline
              maxLength={4000}
              value={message}
              onChangeText={setMessage}
              style={[s.input, { minHeight: 120 }]}
            />
            <Action
              label={
                enabled ? "Send a message" : "Support currently unavailable"
              }
              onPress={() =>
                void act(async () => {
                  if (!enabled)
                    throw new Error(
                      "The school must enable staffed support before messages can be sent.",
                    );
                  if (message.trim().length < 10)
                    throw new Error("Please add at least 10 characters.");
                  const { error } = await backend!
                    .from("support_requests")
                    .insert({ user_id: userId, message: message.trim() });
                  if (error) throw error;
                  setMessage("");
                  await load();
                  setNotice(
                    "Request sent. Return here to check for a response.",
                  );
                })
              }
            />
          </>
          <Text style={s.title}>
            {admin || responder ? "Support inbox" : "Your requests"}
          </Text>
          {!requests.length && <Text>No requests yet.</Text>}
          {requests.map((r) => (
            <View key={r.id} style={s.card}>
              <Text>
                {new Date(r.created_at).toLocaleDateString()} · {r.status}
              </Text>
              <Text>{r.message}</Text>
              {!!r.response && <Text>Administrator: {r.response}</Text>}
              {(admin || responder) && (
                <>
                  <TextInput
                    placeholderTextColor="#526477"
                    accessibilityLabel={`Reply to request ${r.id}`}
                    placeholder="Private reply"
                    multiline
                    maxLength={4000}
                    value={replies[r.id] ?? r.response}
                    onChangeText={(v) =>
                      setReplies((p) => ({ ...p, [r.id]: v }))
                    }
                    style={s.input}
                  />
                  {["answered", "closed"].map((status) => (
                    <Action
                      key={status}
                      label={
                        status === "answered" ? "Send reply" : "Reply and close"
                      }
                      onPress={() =>
                        void act(async () => {
                          const { error } = await backend!.rpc(
                            "respond_to_support",
                            {
                              request_id: r.id,
                              reply: replies[r.id] ?? r.response,
                              new_status: status,
                            },
                          );
                          if (error) throw error;
                          await load();
                        })
                      }
                    />
                  ))}
                </>
              )}
            </View>
          ))}
        </>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  stack: { gap: 16 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  card: { padding: 20, gap: 12, backgroundColor: "white", borderRadius: 18 },
  title: { fontSize: 22, fontWeight: "700", color: "#244d41" },
  button: { padding: 14, borderRadius: 12, backgroundColor: "#e7eee3" },
  selected: { borderWidth: 2, borderColor: "#244d41" },
  input: {
    borderWidth: 1,
    borderColor: "#b3c2b7",
    padding: 14,
    borderRadius: 12,
  },
});
