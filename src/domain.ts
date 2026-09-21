export type Kind = "book" | "assistance" | "idea" | "reel" | "course";
export type Status =
  "pending" | "approved" | "rejected" | "changes_requested" | "removed";
export type Entry = {
  id: string;
  owner_id: string;
  kind: Kind;
  title: string;
  description: string;
  category: string;
  author: string;
  level: string;
  status: Status;
  file_path?: string;
  created_at: string;
  target: number;
  raised: number;
  color: string;
};
export type Decision = {
  id: string;
  entry_id: string;
  action: Status;
  reason: string;
  created_at: string;
};
export function canPublish(status: Status) {
  return status === "approved";
}
export function validateSubmission(title: string, description: string) {
  if (title.trim().length < 4)
    throw new Error("Please enter a title of at least 4 characters.");
  if (description.trim().length < 20)
    throw new Error("Please add at least 20 characters of detail.");
}
export function calculateEarnings(
  views: number,
  subscribers: number,
  viewRate: number,
  subscriberRate: number,
) {
  if (
    [views, subscribers, viewRate, subscriberRate].some(
      (n) => !Number.isFinite(n) || n < 0,
    )
  )
    throw new Error("Invalid earnings inputs");
  return (
    Math.round((views * viewRate + subscribers * subscriberRate) * 100) / 100
  );
}
export const palette = ["#244d41", "#d9a55c", "#8b9da1", "#a36b59", "#5b688e"];
export const initialEntries: Entry[] = [
  [
    "b1",
    "book",
    "A little curiosity. A world of possibility.",
    "Explore the principles that connect the natural world, from living cells to thriving ecosystems.\n\nChapter 1 · Learning to observe\n\nScience begins with a question. Look closely at a leaf: its veins transport water, its surface captures light, and its cells turn that energy into food. Every observation can become a testable question.\n\nTry it yourself\n\nPlace two similar plants in different light conditions. Keep water and soil consistent. Record their growth each day. What changes, and what stays the same? A fair experiment changes one variable at a time.",
    "Science",
    "Education Forum",
    "Secondary",
  ],
  [
    "b2",
    "book",
    "The beauty of mathematics",
    "A friendly introduction to patterns, equations, and the ideas behind everyday problem-solving.\n\nChapter 1 · Finding patterns\n\nA sequence is an ordered list of numbers. In 2, 4, 6, 8, each term increases by two. The nth term is 2n. Recognising the rule lets us predict any term without writing all those before it.\n\nPractice\n\nWhat is the tenth term of 3, 6, 9, 12? The rule is 3n, so the tenth term is 30.",
    "Mathematics",
    "Education Forum",
    "Secondary",
  ],
  [
    "b3",
    "book",
    "Think clearly. Write boldly.",
    "Develop your voice through thoughtful reading and purposeful writing.\n\nChapter 1 · One clear idea\n\nA good paragraph begins with a central idea. Supporting sentences explain it, illustrate it, or offer evidence. Revise by asking whether every sentence helps your reader understand that idea.",
    "Literature",
    "Education Forum",
    "University",
  ],
  [
    "b4",
    "book",
    "A practical guide to Python",
    "Learn the foundations of programming, one small experiment at a time.\n\nChapter 1 · Variables\n\nA variable gives a name to a value. In Python, score = 10 stores the number ten. You can change the value with score = score + 1.\n\nExercise\n\nCreate variables for the length and width of a rectangle. Multiply them to find its area.",
    "Technology",
    "Education Forum",
    "Beginner",
  ],
  [
    "h1",
    "assistance",
    "Help a future engineer stay in school",
    "This sample case illustrates how an approved student request appears. Support covers learning materials and tuition for the next semester.",
    "Tuition",
    "Student support team",
    "University",
  ],
  [
    "i1",
    "idea",
    "A solar-powered study space",
    "A student-led proposal for a shared, solar-powered reading room. Funding supports panels, desks, and a small community library.",
    "Community",
    "Student innovation team",
    "University",
  ],
  [
    "c1",
    "course",
    "Study smarter, one session at a time",
    "Build a repeatable study routine.\n\n1. Choose one clear goal.\n2. Study for 25 minutes without distractions.\n3. Recall what you learned without looking at your notes.\n4. Check gaps and repeat tomorrow.",
    "Study skills",
    "Education Forum",
    "All levels",
  ],
].map((r, i) => ({
  id: r[0],
  owner_id: "demo",
  kind: r[1] as Kind,
  title: r[2],
  description: r[3],
  category: r[4],
  author: r[5],
  level: r[6],
  status: "approved",
  created_at: "2026-09-01",
  target: 1200,
  raised: 740,
  color: palette[i % palette.length],
}));
export const languages = [
  {
    name: "French",
    flag: "🇫🇷",
    greeting: "Bonjour",
    answer: "Hello",
    options: ["Goodbye", "Hello", "Thank you"],
    phrase: "Merci",
    meaning: "Thank you",
  },
  {
    name: "Dutch",
    flag: "🇳🇱",
    greeting: "Goedemorgen",
    answer: "Good morning",
    options: ["Good evening", "Please", "Good morning"],
    phrase: "Dank je",
    meaning: "Thank you",
  },
  {
    name: "Spanish",
    flag: "🇪🇸",
    greeting: "Hola",
    answer: "Hello",
    options: ["Hello", "Good night", "Sorry"],
    phrase: "Gracias",
    meaning: "Thank you",
  },
];
