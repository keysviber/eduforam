import React, { useEffect, useState } from "react";
import { View, Text, Pressable, TextInput, StyleSheet } from "react-native";
import { backend } from "./backend";

function Action({
  title,
  onPress,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[s.button, disabled && { opacity: 0.5 }]}
    >
      <Text style={{ color: "white" }}>{title}</Text>
    </Pressable>
  );
}
function useAction() {
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setNotice(
        (e as { message?: string }).message || "Could not load. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  return { notice, setNotice, busy, run };
}
export function Notifications({ userId }: { userId?: string }) {
  const [items, setItems] = useState<
    { id: string; message: string; read: boolean }[]
  >([]);
  const { notice, busy, run } = useAction();
  async function load() {
    if (!backend || !userId) return;
    const { data, error } = await backend
      .from("notifications")
      .select("id,message,read")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    setItems(data || []);
  }
  useEffect(() => {
    setItems([]);
    void run(load);
  }, [userId]);
  return (
    <View style={s.card}>
      <Text style={s.title}>Notifications</Text>
      <Text>Submission decisions and private support replies.</Text>
      {!userId && <Text>Sign in to see your notifications.</Text>}
      <Text accessibilityRole="alert">{notice}</Text>
      <Action
        title="Refresh notifications"
        disabled={busy || !userId}
        onPress={() => void run(load)}
      />
      {userId && !items.length && <Text>No notifications yet.</Text>}
      {items.map((n) => (
        <View key={n.id} style={s.card}>
          <Text>
            {n.read ? "" : "New · "}
            {n.message}
          </Text>
          {!n.read && (
            <Action
              title="Mark as read"
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  const { error } = await backend!
                    .from("notifications")
                    .update({ read: true })
                    .eq("id", n.id);
                  if (error) throw error;
                  await load();
                })
              }
            />
          )}
        </View>
      ))}
    </View>
  );
}
export function Quiz({ userId }: { userId?: string }) {
  const [questions, setQuestions] = useState<
    { id: number; subject: string; prompt: string; choices: string[] }[]
  >([]);
  const [answered, setAnswered] = useState<number[]>([]);
  const [leaders, setLeaders] = useState<{ learner: string; points: number }[]>(
    [],
  );
  const [subject, setSubject] = useState("All");
  const { notice, setNotice, busy, run } = useAction();
  async function load() {
    if (!backend) return;
    const q = await backend
      .from("quiz_questions")
      .select("id,subject,prompt,choices")
      .order("id");
    if (q.error) throw q.error;
    setQuestions(q.data || []);
    if (userId) {
      const a = await backend.from("quiz_answers").select("question_id");
      if (a.error) throw a.error;
      setAnswered((a.data || []).map((x) => x.question_id));
      const l = await backend.rpc("quiz_leaderboard");
      if (l.error) throw l.error;
      setLeaders(l.data || []);
    }
  }
  useEffect(() => {
    setAnswered([]);
    setLeaders([]);
    void run(load);
  }, [userId]);
  const question = questions.find(
    (q) =>
      !answered.includes(q.id) && (subject === "All" || q.subject === subject),
  );
  return (
    <View style={s.card}>
      <Text style={s.title}>Guru Student quiz</Text>
      <Text>
        Earn 10 points for each correct answer. Each question scores once.
        Points are for the leaderboard, not cash.
      </Text>
      {!backend && (
        <Text>Connect the school service to play and record scores.</Text>
      )}
      {!userId && <Text>Sign in to play and join the leaderboard.</Text>}
      {["All", "General knowledge", "Science", "Maths"].map((x) => (
        <Action
          key={x}
          title={(x === subject ? "✓ " : "") + x}
          onPress={() => setSubject(x)}
        />
      ))}
      <Text accessibilityRole="alert">{notice}</Text>
      <Action
        title="Refresh quiz"
        disabled={busy}
        onPress={() => void run(load)}
      />
      {question ? (
        <View style={s.card}>
          <Text style={s.title}>{question.prompt}</Text>
          {question.choices.map((c, i) => (
            <Action
              key={c}
              title={c}
              disabled={busy || !userId}
              onPress={() =>
                void run(async () => {
                  const { data, error } = await backend!.rpc("answer_quiz", {
                    question: question.id,
                    selected: i,
                  });
                  if (error) throw error;
                  await load();
                  setNotice(`${data.points} points. ${data.explanation}`);
                })
              }
            />
          ))}
        </View>
      ) : (
        backend && (
          <Text>
            All available questions completed in this category. More questions
            can be added by the school.
          </Text>
        )
      )}
      <Text style={s.title}>Leaderboard · all players</Text>
      {leaders.map((p, i) => (
        <Text key={p.learner}>
          {i + 1}. {p.learner} — {p.points} points
        </Text>
      ))}
    </View>
  );
}
export function VideoSocial({
  entryId,
  userId,
  moderator,
}: {
  entryId: string;
  userId?: string;
  moderator: boolean;
}) {
  const [comments, setComments] = useState<
    { id: string; user_id: string; body: string }[]
  >([]);
  const [likes, setLikes] = useState(0);
  const [liked, setLiked] = useState(false);
  const [body, setBody] = useState("");
  const { notice, busy, run } = useAction();
  async function load() {
    if (!backend || !userId) return;
    const c = await backend
      .from("video_comments")
      .select("id,user_id,body")
      .eq("entry_id", entryId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (c.error) throw c.error;
    setComments(c.data || []);
    const count = await backend
      .from("video_likes")
      .select("user_id", { count: "exact", head: true })
      .eq("entry_id", entryId);
    if (count.error) throw count.error;
    setLikes(count.count || 0);
    const own = await backend
      .from("video_likes")
      .select("user_id")
      .eq("entry_id", entryId)
      .eq("user_id", userId);
    if (own.error) throw own.error;
    setLiked(!!own.data?.length);
  }
  useEffect(() => {
    setComments([]);
    setBody("");
    setLikes(0);
    setLiked(false);
    void run(load);
  }, [entryId, userId]);
  return (
    <View style={s.card}>
      <Text style={s.title}>Conversation</Text>
      {!userId && <Text>Sign in to like videos and comment.</Text>}
      <Text accessibilityRole="alert">{notice}</Text>
      <Action
        title={`${liked ? "Unlike" : "Like"} · ${likes}`}
        disabled={busy || !userId || !backend}
        onPress={() =>
          void run(async () => {
            const r = liked
              ? await backend!
                  .from("video_likes")
                  .delete()
                  .eq("entry_id", entryId)
                  .eq("user_id", userId!)
              : await backend!
                  .from("video_likes")
                  .insert({ entry_id: entryId, user_id: userId });
            if (r.error) throw r.error;
            await load();
          })
        }
      />
      <TextInput
        accessibilityLabel="Video comment"
        placeholder="Add a respectful comment"
        placeholderTextColor="#526477"
        maxLength={1000}
        multiline
        value={body}
        onChangeText={setBody}
        style={s.input}
      />
      <Action
        title="Post comment"
        disabled={busy || !userId || !body.trim() || !backend}
        onPress={() =>
          void run(async () => {
            const { error } = await backend!.from("video_comments").insert({
              entry_id: entryId,
              user_id: userId,
              body: body.trim(),
            });
            if (error) throw error;
            setBody("");
            await load();
          })
        }
      />
      {comments.map((c) => (
        <View key={c.id} style={s.card}>
          <Text>{c.body}</Text>
          {(moderator || c.user_id === userId) && (
            <Action
              title="Delete comment"
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  const { error } = await backend!
                    .from("video_comments")
                    .delete()
                    .eq("id", c.id);
                  if (error) throw error;
                  await load();
                })
              }
            />
          )}
        </View>
      ))}
    </View>
  );
}
export function EarningRates() {
  const [rates, setRates] = useState<
    { id: string; role: string; currency: string; view_rate: number }[]
  >([]);
  const { notice, run, busy } = useAction();
  async function load() {
    if (!backend) return;
    const r = await backend
      .from("earnings_policies")
      .select("id,role,currency,view_rate")
      .eq("active", true);
    if (r.error) throw r.error;
    setRates(r.data || []);
  }
  useEffect(() => {
    void run(load);
  }, []);
  return (
    <View style={s.card}>
      <Text style={s.title}>Share knowledge. Earn from learning.</Text>
      <Text>
        Upload original slides, answer sheets, question papers, books and
        videos. Eligible uploads earn from reviewed usage at the published rate
        per 1,000 views.
      </Text>
      <Text>
        Usage is pending until reviewed. Approved earnings can be requested for
        payout once your provider account is ready.
      </Text>
      <Text accessibilityRole="alert">{notice}</Text>
      {rates.map((r) => (
        <Text key={r.id}>
          {r.role}: {r.currency} {(Number(r.view_rate) * 1000).toFixed(2)} per
          1,000 verified views
        </Text>
      ))}
      {!rates.length && (
        <Text>
          No active earning rate has been published yet. Earnings and payouts
          are not active.
        </Text>
      )}
      <Action
        title="Refresh rates"
        disabled={busy}
        onPress={() => void run(load)}
      />
    </View>
  );
}
const s = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    gap: 12,
    marginVertical: 8,
  },
  title: { fontSize: 21, fontWeight: "700", color: "#263f51" },
  button: { backgroundColor: "#5b49bd", padding: 13, borderRadius: 12 },
  input: {
    color: "#20364b",
    backgroundColor: "#eff6ff",
    padding: 14,
    borderRadius: 12,
  },
});
