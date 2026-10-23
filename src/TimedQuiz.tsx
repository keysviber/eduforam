import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, AppState } from "./Theme";
import { backend } from "./backend";
import { FeatureButton, useTask } from "./FeatureWorkflows";
import { useVideoPlayer } from "expo-video";
type Question = {
  status: string;
  position: number;
  prompt: string;
  choices: (string | number)[];
  score: number;
  deadline: string;
  server_time: string;
  elapsed_ms?: number;
};
type Feedback = {
  correct: boolean;
  correct_choice: number;
  selected: number | null;
  points: number;
  explanation: string;
  score: number;
  completed: boolean;
  elapsed_ms: number;
};
export function TimedQuiz({ userId }: { userId?: string }) {
  const task = useTask(),
    [kind, setKind] = useState("speed"),
    [setId, setSetId] = useState(""),
    [question, setQuestion] = useState<Question | null>(null),
    [feedback, setFeedback] = useState<Feedback | null>(null),
    [remaining, setRemaining] = useState(30),
    [leaders, setLeaders] = useState<any[]>([]),
    [sound, setSound] = useState(true);
  const [foreground, setForeground] = useState(
    AppState.currentState === "active",
  );
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) =>
      setForeground(state === "active"),
    );
    return () => subscription.remove();
  }, []);
  const deadline = useRef(0),
    timedOut = useRef(false);
  const beat = useVideoPlayer(require("../assets/audio/quiz-beat.wav"), (p) => {
      p.loop = true;
      p.volume = 0.12;
    }),
    right = useVideoPlayer(require("../assets/audio/quiz-correct.wav")),
    wrong = useVideoPlayer(require("../assets/audio/quiz-wrong.wav"));
  useEffect(() => {
    if (sound && foreground && setId && !feedback?.completed) beat.play();
    else beat.pause();
    return () => beat.pause();
  }, [sound, foreground, setId, feedback?.completed, beat]);
  async function loadLeaders() {
    if (!backend || !userId) return;
    const r =
      kind === "speed"
        ? await backend.rpc("speed_quiz_leaderboard")
        : await backend.rpc("timed_quiz_leaderboard", { kind: "hard" });
    if (r.error) throw r.error;
    setLeaders(r.data || []);
  }
  useEffect(() => {
    void task.run(loadLeaders);
  }, [kind, userId]);
  async function next(id = setId) {
    const r = await backend!.rpc("quiz_next", { set_id: id });
    if (r.error) throw r.error;
    setQuestion(r.data);
    setFeedback(null);
    timedOut.current = false;
    if (r.data.status === "playing") {
      deadline.current =
        Date.now() +
        Math.max(
          0,
          Date.parse(r.data.deadline) - Date.parse(r.data.server_time),
        );
      setRemaining(
        Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)),
      );
    } else {
      setSetId("");
      await loadLeaders();
    }
  }
  async function answer(choice: number | null) {
    if (!question || feedback) return;
    const r = await backend!.rpc("submit_quiz_answer", {
      set_id: setId,
      question_index: question.position,
      choice,
    });
    if (r.error) throw r.error;
    setFeedback(r.data);
    if (sound) {
      const p = r.data.correct ? right : wrong;
      p.currentTime = 0;
      p.play();
    }
    if (r.data.completed) await loadLeaders();
  }
  useEffect(() => {
    if (!setId || !question || question.status !== "playing" || feedback)
      return;
    const timer = setInterval(() => {
      const left = Math.max(
        0,
        Math.ceil((deadline.current - Date.now()) / 1000),
      );
      setRemaining(left);
      if (left === 0 && !timedOut.current) {
        timedOut.current = true;
        void task.run(() => answer(null));
      }
    }, 200);
    return () => clearInterval(timer);
  }, [setId, question, feedback]);
  return (
    <View style={{ gap: 14 }}>
      <Text style={{ fontSize: 26, fontWeight: "700" }}>Guru Student quiz</Text>
      <Text>
        Ten questions per set. Each question has 30 seconds. A wrong or
        timed-out answer deducts 3 points. Timing and scoring are checked by the
        server.
      </Text>
      <Text accessibilityRole="alert">{task.notice}</Text>
      <FeatureButton
        label={sound ? "Quiz sound: on" : "Quiz sound: off"}
        onPress={() => setSound(!sound)}
      />
      {!setId && (
        <>
          {["speed", "hard"].map((x) => (
            <FeatureButton
              key={x}
              label={x === "speed" ? "Speed quiz" : "Hard questions"}
              onPress={() => {
                setKind(x);
                setFeedback(null);
                setQuestion(null);
              }}
            />
          ))}
          <Text>
            {kind === "speed"
              ? "Fastest completion wins. Only sets with all 10 answers correct enter the speed leaderboard."
              : "Points count after you finish all ten questions. The monthly board starts fresh at 00:00 UTC on the first day. Monthly prizes: 1st $15, 2nd $10, 3rd $5; reviewed rewards appear in Earnings. Actual withdrawal requires payout setup."}
          </Text>
          <FeatureButton
            label={`Start or resume ${kind} quiz`}
            disabled={!userId || !backend || task.busy}
            onPress={() =>
              void task.run(async () => {
                const r = await backend!.rpc("start_quiz", { kind });
                if (r.error) throw r.error;
                setSetId(r.data);
                await next(r.data);
              })
            }
          />
          {!userId && <Text>Sign in to play.</Text>}
        </>
      )}
      {setId && question && (
        <View
          style={{
            gap: 12,
            padding: 18,
            backgroundColor: "white",
            borderRadius: 16,
          }}
        >
          <Text>
            Question {question.position + 1} / 10 · {remaining}s ·{" "}
            {feedback?.score ?? question.score} points
          </Text>
          <Text style={{ fontSize: 23, fontWeight: "700" }}>
            {question.prompt}
          </Text>
          {question.choices?.map((choice, i) => (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityState={{ disabled: !!feedback || task.busy }}
              disabled={!!feedback || task.busy || remaining === 0}
              onPress={() => void task.run(() => answer(i))}
              style={{
                padding: 16,
                borderRadius: 10,
                borderWidth: 2,
                borderColor: feedback
                  ? i === feedback.correct_choice
                    ? "#168347"
                    : i === feedback.selected
                      ? "#bc2338"
                      : "#b8c8bf"
                  : "#b8c8bf",
                backgroundColor: feedback
                  ? i === feedback.correct_choice
                    ? "#d8f5e1"
                    : i === feedback.selected
                      ? "#ffe0e6"
                      : "white"
                  : "white",
              }}
            >
              <Text>
                {String(choice)}
                {feedback && i === feedback.correct_choice
                  ? " ✓ Correct answer"
                  : feedback && i === feedback.selected
                    ? " ✕ Your answer"
                    : ""}
              </Text>
            </Pressable>
          ))}
          {feedback ? (
            <>
              <Text accessibilityRole="alert">
                {feedback.correct ? "Correct" : "Incorrect or timed out"}:{" "}
                {feedback.points} points. {feedback.explanation}
              </Text>
              {feedback.completed && (
                <Text>
                  Set complete: {feedback.score} points in{" "}
                  {(feedback.elapsed_ms / 1000).toFixed(1)} seconds. Your result
                  is recorded.
                </Text>
              )}
              <FeatureButton
                label={
                  feedback.completed ? "Return to leaderboard" : "Next question"
                }
                disabled={task.busy}
                onPress={() =>
                  void task.run(async () => {
                    if (feedback.completed) {
                      setSetId("");
                      setQuestion(null);
                      setFeedback(null);
                      await loadLeaders();
                    } else await next();
                  })
                }
              />
            </>
          ) : (
            remaining === 0 && (
              <FeatureButton
                label="Retry timed-out answer"
                disabled={task.busy}
                onPress={() => void task.run(() => answer(null))}
              />
            )
          )}
        </View>
      )}
      <Text style={{ fontSize: 22, fontWeight: "700" }}>
        {kind === "hard"
          ? "This month's points leaderboard"
          : "Fastest perfect sets"}
      </Text>
      <FeatureButton
        label="Refresh leaderboard"
        disabled={task.busy || !userId}
        onPress={() => void task.run(loadLeaders)}
      />
      {leaders.map((p, i) => (
        <Text key={p.learner}>
          {i + 1}. {p.learner} ·{" "}
          {kind === "speed"
            ? `${(p.elapsed_ms / 1000).toFixed(2)}s`
            : `${p.points} points`}
        </Text>
      ))}
    </View>
  );
}
