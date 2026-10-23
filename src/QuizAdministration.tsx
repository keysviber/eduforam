import React, { useEffect, useState } from "react";
import { View, Text, TextInput } from "./Theme";
import { backend } from "./backend";
import { FeatureButton, useTask } from "./FeatureWorkflows";
import { SelectField } from "./FormControls";
import { subjects, canonicalGrade } from "./education";
export function QuizAdministration() {
  const task = useTask(),
    [groups, setGroups] = useState<any[]>([]),
    [group, setGroup] = useState(""),
    [kind, setKind] = useState("speed"),
    [questions, setQuestions] = useState<any[]>([]),
    [search, setSearch] = useState(""),
    [id, setId] = useState<string | null>(null),
    [prompt, setPrompt] = useState(""),
    [options, setOptions] = useState(["", "", "", ""]),
    [answer, setAnswer] = useState("0"),
    [points, setPoints] = useState("10"),
    [subject, setSubject] = useState("Maths"),
    [explanation, setExplanation] = useState(""),
    [groupName, setGroupName] = useState(""),
    [groupLevels, setGroupLevels] = useState(["1", "2", "3"]),
    [groupId, setGroupId] = useState<string | null>(null),
    [rewards, setRewards] = useState<any[]>([]),
    [reason, setReason] = useState("");
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i - 1, 1))
      .toISOString()
      .slice(0, 10);
  });
  const [month, setMonth] = useState(months[0]);
  async function load() {
    const g = await backend!.from("quiz_groups").select("*").order("name");
    if (g.error) throw g.error;
    setGroups(g.data || []);
    const chosen = group || g.data?.[0]?.id;
    if (!group && chosen) setGroup(chosen);
    if (chosen) {
      let q = backend!
        .from("quiz_bank")
        .select("*")
        .eq("group_id", chosen)
        .eq("category", kind)
        .order("prompt")
        .limit(200);
      if (search.trim()) q = q.ilike("prompt", `%${search.trim()}%`);
      const r = await q;
      if (r.error) throw r.error;
      setQuestions(r.data || []);
    }
    const r = await backend!
      .from("quiz_monthly_rewards")
      .select("*")
      .order("month", { ascending: false })
      .limit(100);
    if (r.error) throw r.error;
    setRewards(r.data || []);
  }
  useEffect(() => {
    void task.run(load);
  }, [group, kind]);
  const field = (label: string, value: string, change: (v: string) => void) => (
    <TextInput
      accessibilityLabel={label}
      placeholder={label}
      value={value}
      onChangeText={change}
      multiline
      style={{
        padding: 12,
        borderWidth: 1,
        borderColor: "#b5c9bd",
        borderRadius: 10,
      }}
    />
  );
  return (
    <View
      style={{
        gap: 14,
        padding: 16,
        backgroundColor: "white",
        borderRadius: 16,
      }}
    >
      <Text style={{ fontSize: 24, fontWeight: "700" }}>
        Quiz question bank
      </Text>
      <Text accessibilityRole="alert">{task.notice}</Text>
      <SelectField
        label="Quiz group"
        value={group}
        options={groups.map((g) => ({
          value: g.id,
          label: `${g.name} (${g.levels.join(", ")})`,
        }))}
        onChange={(v) => {
          setGroup(v);
          setId(null);
        }}
      />
      <SelectField
        label="Quiz category"
        value={kind}
        options={[
          { value: "speed", label: "Speed quiz" },
          { value: "hard", label: "Hard questions" },
        ]}
        onChange={setKind}
      />
      {field("Search question bank", search, setSearch)}
      <FeatureButton
        label="Search / refresh question bank"
        disabled={task.busy}
        onPress={() => void task.run(load)}
      />
      <Text>
        {questions.length} questions shown. Use search to find older questions.
        A playable set needs at least ten active questions.
      </Text>
      {field("Question prompt", prompt, setPrompt)}
      <SelectField
        label="Question subject"
        value={subject}
        options={subjects.map((x) => ({ value: x, label: x }))}
        onChange={setSubject}
      />
      {options.map((v, i) =>
        field(`Answer option ${i + 1}`, v, (n) =>
          setOptions(options.map((x, k) => (k === i ? n : x))),
        ),
      )}
      <SelectField
        label="Correct answer option"
        value={answer}
        options={options.map((_, i) => ({
          label: `Option ${i + 1}`,
          value: String(i),
        }))}
        onChange={setAnswer}
      />
      {field("Correct answer points", points, setPoints)}
      {field("Answer explanation", explanation, setExplanation)}
      <FeatureButton
        label={id ? "Save question changes" : "Create question"}
        disabled={task.busy}
        onPress={() =>
          void task.run(async () => {
            if (
              !group ||
              prompt.trim().length < 3 ||
              options.some((x) => !x.trim()) ||
              new Set(options.map((x) => x.trim().toLowerCase())).size !==
                options.length ||
              !Number.isInteger(Number(points)) ||
              Number(points) < 1 ||
              Number(points) > 100
            )
              throw new Error(
                "Complete the question, distinct options and points (1-100).",
              );
            const values = {
              group_id: group,
              category: kind,
              subject,
              prompt: prompt.trim(),
              choices: options.map((x) => x.trim()),
              correct: Number(answer),
              points: Number(points),
              explanation: explanation.trim(),
              active: true,
            };
            const r = id
              ? await backend!.from("quiz_bank").update(values).eq("id", id)
              : await backend!.from("quiz_bank").insert(values);
            if (r.error) throw r.error;
            setId(null);
            setPrompt("");
            setOptions(["", "", "", ""]);
            setExplanation("");
            await load();
            task.setNotice(
              "Question saved. Existing attempts keep their original questions.",
            );
          })
        }
      />
      {id && (
        <FeatureButton
          label="Cancel question edit"
          onPress={() => {
            setId(null);
            setPrompt("");
            setOptions(["", "", "", ""]);
          }}
        />
      )}
      {questions.map((q) => (
        <View
          key={q.id}
          style={{
            padding: 12,
            gap: 8,
            borderWidth: 1,
            borderColor: "#b5c9bd",
          }}
        >
          <Text>
            {q.prompt} · {q.points} points · {q.active ? "Active" : "Inactive"}
          </Text>
          <FeatureButton
            label={`Edit: ${q.prompt}`}
            onPress={() => {
              setId(q.id);
              setPrompt(q.prompt);
              setOptions(q.choices.map(String));
              setAnswer(String(q.correct));
              setPoints(String(q.points));
              setExplanation(q.explanation);
              setSubject(q.subject);
            }}
          />
          <FeatureButton
            label={q.active ? "Deactivate question" : "Activate question"}
            onPress={() =>
              void task.run(async () => {
                const r = await backend!
                  .from("quiz_bank")
                  .update({ active: !q.active })
                  .eq("id", q.id);
                if (r.error) throw r.error;
                await load();
              })
            }
          />
          <FeatureButton
            label="Delete question"
            onPress={() =>
              void task.run(async () => {
                const r = await backend!
                  .from("quiz_bank")
                  .delete()
                  .eq("id", q.id);
                if (r.error) throw r.error;
                await load();
              })
            }
          />
        </View>
      ))}
      <Text style={{ fontSize: 22, fontWeight: "700" }}>
        Three-level groups
      </Text>
      <Text>
        Each active group must contain three distinct levels. A level can belong
        to only one active group.
      </Text>
      {field("Group name", groupName, setGroupName)}
      {groupLevels.map((v, i) => (
        <SelectField
          key={i}
          label={`Group level ${i + 1}`}
          value={v}
          options={Array.from({ length: 21 }, (_, n) => ({
            value: String(n + 1),
            label: `Level ${n + 1} · ${canonicalGrade(n + 1)}`,
          }))}
          onChange={(x) =>
            setGroupLevels(groupLevels.map((y, k) => (i === k ? x : y)))
          }
        />
      ))}
      <FeatureButton
        label={groupId ? "Save group changes" : "Create three-level group"}
        onPress={() =>
          void task.run(async () => {
            if (!groupName.trim()) throw new Error("Enter a group name.");
            const values = {
              name: groupName.trim(),
              levels: groupLevels.map(Number),
              active: true,
            };
            const r = groupId
              ? await backend!
                  .from("quiz_groups")
                  .update(values)
                  .eq("id", groupId)
              : await backend!.from("quiz_groups").insert(values);
            if (r.error) throw r.error;
            setGroupId(null);
            setGroupName("");
            await load();
          })
        }
      />
      {groups.map((g) => (
        <View key={g.id}>
          <Text>
            {g.name}: {g.levels.join(", ")} · {g.active ? "Active" : "Inactive"}
          </Text>
          <FeatureButton
            label={`Edit group ${g.name}`}
            onPress={() => {
              setGroupId(g.id);
              setGroupName(g.name);
              setGroupLevels(g.levels.map(String));
            }}
          />
          <FeatureButton
            label={g.active ? `Deactivate ${g.name}` : `Activate ${g.name}`}
            onPress={() =>
              void task.run(async () => {
                const r = await backend!
                  .from("quiz_groups")
                  .update({ active: !g.active })
                  .eq("id", g.id);
                if (r.error) throw r.error;
                await load();
              })
            }
          />
        </View>
      ))}
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Monthly rewards</Text>
      <Text>
        The leaderboard resets automatically each month. Close a completed month
        to freeze its top three rewards. Review before crediting earnings; this
        does not send money to a bank.
      </Text>
      <SelectField
        label="Completed quiz month"
        value={month}
        options={months.map((x) => ({ value: x, label: x.slice(0, 7) }))}
        onChange={setMonth}
      />
      <FeatureButton
        label="Calculate monthly winners"
        onPress={() =>
          void task.run(async () => {
            const r = await backend!.rpc("close_quiz_month", { period: month });
            if (r.error) throw r.error;
            await load();
          })
        }
      />
      {field("Reward review reason", reason, setReason)}
      {rewards.map((r) => (
        <View key={r.id}>
          <Text>
            {r.month} · Rank {r.rank} · ${(r.amount_minor / 100).toFixed(2)} ·{" "}
            {r.status}
          </Text>
          {r.status === "pending_review" &&
            [true, false].map((approve) => (
              <FeatureButton
                key={String(approve)}
                label={approve ? "Credit reward to earnings" : "Reject reward"}
                onPress={() =>
                  void task.run(async () => {
                    const response = await backend!.rpc("review_quiz_reward", {
                      reward: r.id,
                      approve,
                      reason,
                    });
                    if (response.error) throw response.error;
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
