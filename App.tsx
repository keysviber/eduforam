import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  useWindowDimensions,
  SafeAreaView,
  Linking,
  ActivityIndicator,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { backend } from "./src/backend";
import { Management, Plans } from "./src/Management";
import {
  Entry,
  Kind,
  Status,
  Decision,
  initialEntries,
  languages,
  validateSubmission,
  canPublish,
  palette,
} from "./src/domain";

type IconName = React.ComponentProps<typeof Ionicons>["name"];
const nav: { name: string; icon: IconName }[] = [
  { name: "Overview", icon: "grid-outline" },
  { name: "Library", icon: "book-outline" },
  { name: "Learning", icon: "school-outline" },
  { name: "Languages", icon: "globe-outline" },
  { name: "Opportunities", icon: "heart-outline" },
  { name: "Community", icon: "people-outline" },
  { name: "Earnings", icon: "wallet-outline" },
];
function Icon({
  name,
  color = "#52665c",
  size = 21,
}: {
  name: IconName;
  color?: string;
  size?: number;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}
function Button({
  label,
  onPress,
  secondary = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[s.button, secondary && s.secondary]}
    >
      <Text style={[s.buttonText, secondary && { color: "#254c3f" }]}>
        {label}
      </Text>
    </Pressable>
  );
}
export default function App() {
  const { width } = useWindowDimensions();
  const desktop = width > 950;
  const [page, setPage] = useState("Overview"),
    [entries, setEntries] = useState<Entry[]>(backend ? [] : initialEntries),
    [saved, setSaved] = useState<string[]>([]),
    [progress, setProgress] = useState<Record<string, number>>({}),
    [history, setHistory] = useState<Decision[]>([]),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null),
    [role, setRole] = useState("student"),
    [demoAdmin, setDemoAdmin] = useState(false);
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState("All subjects"),
    [level, setLevel] = useState("All levels"),
    [sort, setSort] = useState("Title A–Z");
  const [reader, setReader] = useState<Entry | null>(null),
    [form, setForm] = useState<Kind | null>(null),
    [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [subject, setSubject] = useState("Science"),
    [author, setAuthor] = useState(""),
    [attachment, setAttachment] =
      useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [auth, setAuth] = useState(false),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [signup, setSignup] = useState(false),
    [lesson, setLesson] = useState<(typeof languages)[number] | null>(null),
    [answer, setAnswer] = useState(""),
    [reviewReason, setReviewReason] = useState("");
  const admin = backend ? ["admin", "owner"].includes(role) : demoAdmin;
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setNotice(
        e instanceof Error
          ? e.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    if (!backend) return;
    const { data, error } = await backend
      .from("entries")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    setEntries(data || []);
  }
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (!backend) {
          const raw = await AsyncStorage.getItem("education-forum-demo-v1");
          if (raw && active) {
            const v = JSON.parse(raw);
            setEntries(v.entries || initialEntries);
            setSaved(v.saved || []);
            setProgress(v.progress || {});
            setHistory(v.history || []);
          }
        } else {
          await refresh();
        }
      } catch {
        setNotice("Could not load your data. Check your connection.");
      } finally {
        if (active) setReady(true);
      }
    })();
    if (backend)
      void backend.auth.getSession().then(({ data }) => {
        if (active) setUser(data.session?.user ?? null);
      });
    const sub = backend?.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setRole("student");
      if (session)
        setTimeout(() => {
          backend
            ?.from("profiles")
            .select("role")
            .eq("id", session.user.id)
            .single()
            .then(({ data }) => {
              if (active) setRole(data?.role || "student");
            });
          void refresh();
        }, 0);
    });
    return () => {
      active = false;
      sub?.data.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (ready && !backend)
      void AsyncStorage.setItem(
        "education-forum-demo-v1",
        JSON.stringify({ entries, saved, progress, history }),
      ).catch(() => setNotice("Your device could not save these changes."));
  }, [entries, saved, progress, history, ready]);
  function go(p: string) {
    setPage(p);
    setSearch("");
    setCategory("All subjects");
  }
  function openForm(kind: Kind) {
    if (backend && !user) {
      setAuth(true);
      return;
    }
    setForm(kind);
    setTitle("");
    setDescription("");
    setAttachment(null);
    setAuthor("");
  }
  async function submit() {
    await run(async () => {
      validateSubmission(title, description);
      if (form === "book" && !attachment)
        throw new Error("Attach a PDF before submitting your book.");
      const id =
        globalThis.crypto?.randomUUID?.() ||
        "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          return (c === "x" ? r : (r & 3) | 8).toString(16);
        });
      let file_path: string | undefined = !backend
        ? attachment?.uri
        : undefined;
      if (backend && attachment) {
        if (!user) throw new Error("Please sign in.");
        file_path = `${user.id}/${id}/${attachment.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const bytes = attachment.file
          ? await attachment.file.arrayBuffer()
          : await new File(attachment.uri).arrayBuffer();
        const { error } = await backend.storage
          .from("submissions")
          .upload(file_path, bytes, {
            contentType: attachment.mimeType || "application/pdf",
          });
        if (error) throw error;
      }
      const entry: Entry = {
        id,
        owner_id: user?.id || "demo",
        kind: form!,
        title: title.trim(),
        description: description.trim(),
        category: subject,
        author: author.trim() || "Community member",
        level: "All levels",
        status: "pending",
        created_at: new Date().toISOString(),
        target: 0,
        raised: 0,
        color: palette[entries.length % palette.length],
        file_path,
      };
      if (backend) {
        const { error } = await backend.from("entries").insert(entry);
        if (error) throw error;
        await refresh();
      } else setEntries((v) => [entry, ...v]);
      setForm(null);
      setNotice(
        "Submitted for review. Your submission is private until an administrator approves it.",
      );
    });
  }
  async function decide(entry: Entry, status: Status) {
    await run(async () => {
      if (!reviewReason.trim())
        throw new Error("Add a review reason for the audit history.");
      if (backend) {
        const { error } = await backend.rpc("review_entry", {
          entry_id: entry.id,
          decision: status,
          reason: reviewReason,
        });
        if (error) throw error;
        await refresh();
      } else {
        setEntries((v) =>
          v.map((e) => (e.id === entry.id ? { ...e, status } : e)),
        );
        setHistory((v) => [
          {
            id: `${Date.now()}`,
            entry_id: entry.id,
            action: status,
            reason: reviewReason,
            created_at: new Date().toISOString(),
          },
          ...v,
        ]);
      }
      setReviewReason("");
      setNotice(`Submission ${status.replace("_", " ")}.`);
    });
  }
  const publicEntries = entries.filter((e) => canPublish(e.status));
  const books = publicEntries
    .filter(
      (e) =>
        e.kind === "book" &&
        (category === "All subjects" || e.category === category) &&
        (level === "All levels" || e.level === level) &&
        `${e.title} ${e.author} ${e.category}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "Newest"
        ? b.created_at.localeCompare(a.created_at)
        : a.title.localeCompare(b.title),
    );
  function toggleSaved(id: string) {
    if (!backend) {
      setSaved((v) =>
        v.includes(id) ? v.filter((x) => x !== id) : [...v, id],
      );
      return;
    }
    if (!user) {
      setNotice("Sign in to save books.");
      return;
    }
    void run(async () => {
      const removing = saved.includes(id);
      const result = removing
        ? await backend!
            .from("bookmarks")
            .delete()
            .eq("user_id", user.id)
            .eq("entry_id", id)
        : await backend!
            .from("bookmarks")
            .insert({ user_id: user.id, entry_id: id });
      if (result.error) throw result.error;
      setSaved((v) => (removing ? v.filter((x) => x !== id) : [...v, id]));
    });
  }
  useEffect(() => {
    if (!backend) return;
    setSaved([]);
    if (user)
      void backend
        .from("bookmarks")
        .select("entry_id")
        .eq("user_id", user.id)
        .then(({ data, error }) => {
          if (error) setNotice(error.message);
          else setSaved((data || []).map((x) => x.entry_id));
        });
  }, [user?.id]);
  function Heading({
    eyebrow,
    title: heading,
    subtitle,
    action,
  }: {
    eyebrow: string;
    title: string;
    subtitle: string;
    action?: React.ReactNode;
  }) {
    return (
      <View style={s.headingRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>{eyebrow}</Text>
          <Text style={s.heading}>{heading}</Text>
          <Text style={s.muted}>{subtitle}</Text>
        </View>
        {action}
      </View>
    );
  }
  function BookCard({ book }: { book: Entry }) {
    return (
      <View
        style={[
          s.bookCard,
          { width: desktop ? "23%" : width > 600 ? "47%" : "100%" },
        ]}
      >
        <Pressable
          onPress={() => setReader(book)}
          accessibilityRole="button"
          accessibilityLabel={`Read ${book.title}`}
          style={[s.cover, { backgroundColor: book.color }]}
        >
          <View style={s.coverTop}>
            <Text style={s.coverLabel}>EDUCATION FORUM / READ</Text>
            <Icon name="sparkles-outline" color="#fff" size={20} />
          </View>
          <View style={s.orbit} />
          <Text style={s.coverTitle}>{book.title}</Text>
          <Text style={s.coverAuthor}>{book.author.toUpperCase()}</Text>
        </Pressable>
        <View style={s.row}>
          <Text style={s.category}>{book.category}</Text>
          <Pressable
            accessibilityLabel={
              saved.includes(book.id) ? "Remove bookmark" : "Save book"
            }
            onPress={() => toggleSaved(book.id)}
          >
            <Icon
              name={saved.includes(book.id) ? "bookmark" : "bookmark-outline"}
              size={19}
            />
          </Pressable>
        </View>
        <Pressable onPress={() => setReader(book)}>
          <Text style={s.cardTitle}>{book.title}</Text>
        </Pressable>
        <Text style={s.small}>
          {book.author} · {book.level}
        </Text>
      </View>
    );
  }
  function EntryCard({ entry }: { entry: Entry }) {
    return (
      <View style={s.card}>
        <View style={s.row}>
          <Text style={s.category}>{entry.category}</Text>
          <Text style={s.tag}>Reviewed</Text>
        </View>
        <Text style={s.cardTitle}>{entry.title}</Text>
        <Text style={s.muted}>{entry.description.slice(0, 170)}</Text>
        {entry.target > 0 && (
          <>
            <View style={s.track}>
              <View
                style={[
                  s.fill,
                  {
                    width: `${Math.min(100, (entry.raised / entry.target) * 100)}%`,
                  },
                ]}
              />
            </View>
            <Text style={s.small}>
              ${entry.raised} of ${entry.target} goal
            </Text>
          </>
        )}
        <Button
          label={entry.kind === "course" ? "Start learning" : "View details"}
          secondary
          onPress={() => setReader(entry)}
        />
      </View>
    );
  }
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="dark" />
      <View style={s.shell}>
        {desktop && (
          <View style={s.sidebar}>
            <View style={s.brand}>
              <View style={s.logo}>
                <Icon name="book" color="white" size={24} />
              </View>
              <Text style={s.brandText}>
                education<Text style={{ color: "#9eaf9e" }}>.</Text>
                {"\n"}
                <Text
                  style={{ fontSize: 13, fontWeight: "400", letterSpacing: 3 }}
                >
                  FORUM
                </Text>
              </Text>
            </View>
            <Text style={[s.eyebrow, { marginTop: 37, marginBottom: 15 }]}>
              YOUR LEARNING SPACE
            </Text>
            {nav.map((n) => (
              <Pressable
                key={n.name}
                onPress={() => go(n.name)}
                style={[s.nav, page === n.name && s.navActive]}
              >
                <Icon
                  name={n.icon}
                  color={page === n.name ? "#245642" : "#738078"}
                />
                <Text
                  style={[
                    s.navText,
                    page === n.name && { color: "#245642", fontWeight: "700" },
                  ]}
                >
                  {n.name}
                </Text>
                {n.name === "Opportunities" && <View style={s.dot} />}
              </Pressable>
            ))}
            <View style={{ flex: 1 }} />
            <View style={s.premierCard}>
              <Icon name="sparkles-outline" />
              <Text style={s.cardTitle}>A little more possibility.</Text>
              <Text style={s.small}>
                Discover your next chapter with Premier.
              </Text>
              <Button
                label="Explore Premier ↗"
                secondary
                onPress={() => go("Premier")}
              />
            </View>
            <Pressable onPress={() => go("Account")} style={s.nav}>
              <Icon name="settings-outline" />
              <Text style={s.navText}>Account & settings</Text>
            </Pressable>
            {admin && (
              <Pressable style={s.nav} onPress={() => go("Admin")}>
                <Icon name="shield-checkmark-outline" />
                <Text style={s.navText}>Admin dashboard</Text>
              </Pressable>
            )}
            <Text style={s.sidebarFoot}>Made for curious minds.</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View style={s.topbar}>
            <View style={s.row}>
              <Text style={s.topTitle}>
                {desktop
                  ? "Your next chapter starts here."
                  : "education. forum"}
              </Text>
              {desktop && <Text style={s.topBadge}>LEARN SOMETHING NEW</Text>}
            </View>
            <Pressable onPress={() => go("Account")} style={s.avatar}>
              <Text style={{ color: "#315542", fontWeight: "700" }}>
                {user?.email?.[0].toUpperCase() || "EF"}
              </Text>
            </Pressable>
          </View>
          {!backend && (
            <View style={s.demoBar}>
              <Text style={s.demoText}>
                Interactive preview · sample content · no real payments
              </Text>
            </View>
          )}
          <ScrollView
            contentContainerStyle={[s.main, { padding: desktop ? 36 : 20 }]}
            keyboardShouldPersistTaps="handled"
          >
            {page === "Overview" && (
              <>
                <Heading
                  eyebrow="A GOOD DAY TO GROW"
                  title="Make room for discovery."
                  subtitle="A book, a new skill, a brighter future. It all starts here."
                />
                <View
                  style={[
                    s.hero,
                    { flexDirection: desktop ? "row" : "column" },
                  ]}
                >
                  <View style={{ flex: 1, zIndex: 1 }}>
                    <Text style={s.heroLabel}>
                      BIG IDEAS. OPEN POSSIBILITIES.
                    </Text>
                    <Text style={s.heroTitle}>
                      Your world is bigger{"\n"}with every page.
                    </Text>
                    <Text style={s.heroText}>
                      Explore a library built for curious minds.{"\n"}Learn at
                      your pace. Go further, together.
                    </Text>
                    <View style={{ alignSelf: "flex-start", marginTop: 24 }}>
                      <Button
                        label="Explore the library   →"
                        onPress={() => go("Library")}
                      />
                    </View>
                  </View>
                  <View style={s.heroArt}>
                    <View style={s.sun} />
                    <View
                      style={[
                        s.artBook,
                        {
                          backgroundColor: "#dba56b",
                          transform: [{ rotate: "-15deg" }],
                          left: 20,
                          top: 44,
                        },
                      ]}
                    >
                      <Text style={s.artBookText}>STAY{"\n"}CURIOUS.</Text>
                      <View style={s.bookLine} />
                    </View>
                    <View
                      style={[
                        s.artBook,
                        {
                          backgroundColor: "#faf4df",
                          transform: [{ rotate: "12deg" }],
                          left: 105,
                          top: 65,
                        },
                      ]}
                    >
                      <Text style={[s.artBookText, { color: "#315743" }]}>
                        A WORLD{"\n"}OF IDEAS.
                      </Text>
                      <Icon name="leaf-outline" size={60} color="#688369" />
                    </View>
                  </View>
                </View>
                <View style={s.stats}>
                  {[
                    {
                      icon: "book-outline",
                      label: "Your reading list",
                      value: `${saved.length} saved books`,
                      page: "Library",
                    },
                    {
                      icon: "flame-outline",
                      label: "Keep your momentum",
                      value: `${Object.keys(progress).length} lessons explored`,
                      page: "Languages",
                    },
                    {
                      icon: "heart-outline",
                      label: "Grow together",
                      value: "Discover opportunities",
                      page: "Opportunities",
                    },
                  ].map((x) => (
                    <Pressable
                      key={x.label}
                      onPress={() => go(x.page)}
                      style={s.stat}
                    >
                      <View style={s.iconTile}>
                        <Icon name={x.icon as IconName} />
                      </View>
                      <View>
                        <Text style={s.small}>{x.label}</Text>
                        <Text style={s.statValue}>{x.value}</Text>
                      </View>
                      <Text style={{ marginLeft: "auto", color: "#789080" }}>
                        ↗
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={s.sectionTitle}>
                  <Text style={s.sectionHeading}>
                    Find your next great read
                  </Text>
                  <Pressable onPress={() => go("Library")}>
                    <Text style={s.link}>View library →</Text>
                  </Pressable>
                </View>
                <View style={s.books}>
                  {books.slice(0, 4).map((book) => (
                    <BookCard key={book.id} book={book} />
                  ))}
                </View>
                <View style={s.sectionTitle}>
                  <Text style={s.sectionHeading}>
                    A new language. A new perspective.
                  </Text>
                  <Pressable onPress={() => go("Languages")}>
                    <Text style={s.link}>Explore →</Text>
                  </Pressable>
                </View>
                <View style={s.tiles}>
                  {languages.map((l) => (
                    <Pressable
                      key={l.name}
                      style={s.languageCard}
                      onPress={() => {
                        setLesson(l);
                        setAnswer("");
                      }}
                    >
                      <Text style={{ fontSize: 31 }}>{l.flag}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={s.cardTitle}>{l.name}</Text>
                        <Text style={s.small}>Start with a simple hello</Text>
                      </View>
                      <Icon name="arrow-forward" />
                    </Pressable>
                  ))}
                </View>
              </>
            )}
            {page === "Library" && (
              <>
                <Heading
                  eyebrow="THE EDUCATION LIBRARY"
                  title="A good book changes things."
                  subtitle="Discover ideas worth spending time with."
                  action={
                    <Button label="+ Upload" onPress={() => openForm("book")} />
                  }
                />
                <TextInput
                  accessibilityLabel="Search library"
                  placeholder="Search books, subjects, or authors…"
                  value={search}
                  onChangeText={setSearch}
                  style={s.search}
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginBottom: 18 }}
                >
                  {[
                    "All subjects",
                    "Science",
                    "Mathematics",
                    "Literature",
                    "Technology",
                  ].map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => setCategory(c)}
                      style={[s.chip, category === c && s.chipActive]}
                    >
                      <Text
                        style={{ color: category === c ? "white" : "#51665a" }}
                      >
                        {c}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <View
                  style={[
                    s.row,
                    {
                      justifyContent: "flex-start",
                      gap: 8,
                      flexWrap: "wrap",
                      marginBottom: 20,
                    },
                  ]}
                >
                  {["All levels", "Beginner", "Secondary", "University"].map(
                    (l) => (
                      <Pressable key={l} onPress={() => setLevel(l)}>
                        <Text style={[s.small, level === l && s.link]}>
                          {l}{" "}
                        </Text>
                      </Pressable>
                    ),
                  )}
                  <Pressable
                    onPress={() =>
                      setSort((v) => (v === "Newest" ? "Title A–Z" : "Newest"))
                    }
                  >
                    <Text style={s.link}>{sort} ↕</Text>
                  </Pressable>
                </View>
                <View style={s.books}>
                  {books.map((book) => (
                    <BookCard key={book.id} book={book} />
                  ))}
                </View>
                {books.length === 0 && (
                  <Text style={s.empty}>
                    No books match your search. Try another subject or title.
                  </Text>
                )}
              </>
            )}
            {page === "Learning" && (
              <>
                <Heading
                  eyebrow="LEARN WITH PURPOSE"
                  title="Small steps. Lasting knowledge."
                  subtitle="Practical lessons to help you find your rhythm."
                />
                <View style={s.tiles}>
                  {publicEntries
                    .filter((e) => e.kind === "course")
                    .map((e) => (
                      <EntryCard key={e.id} entry={e} />
                    ))}
                </View>
                <View style={s.card}>
                  <Text style={s.cardTitle}>Teachers & tutors</Text>
                  <Text style={s.muted}>
                    Share your expertise. Verified educators can submit lessons
                    for review.
                  </Text>
                  <Button
                    label="Submit a lesson"
                    onPress={() => openForm("course")}
                  />
                </View>
              </>
            )}
            {page === "Languages" && (
              <>
                <Heading
                  eyebrow="HELLO, WORLD"
                  title="Open a new conversation."
                  subtitle="Start your journey in French, Dutch, or Spanish."
                />
                {languages.map((l) => (
                  <View key={l.name} style={s.card}>
                    <View style={s.row}>
                      <Text style={{ fontSize: 36 }}>{l.flag}</Text>
                      <Text style={s.tag}>Beginner · Vocabulary</Text>
                    </View>
                    <Text style={s.sectionHeading}>{l.name}</Text>
                    <Text style={s.muted}>
                      Greetings, everyday words, and a quick knowledge check.
                    </Text>
                    <View style={s.track}>
                      <View
                        style={[s.fill, { width: `${progress[l.name] || 0}%` }]}
                      />
                    </View>
                    <Text style={s.small}>
                      {progress[l.name] || 0}% complete
                    </Text>
                    <Button
                      label={
                        progress[l.name] ? "Review lesson" : "Begin lesson →"
                      }
                      onPress={() => {
                        setLesson(l);
                        setAnswer("");
                      }}
                    />
                  </View>
                ))}
              </>
            )}
            {page === "Opportunities" && (
              <>
                <Heading
                  eyebrow="GO FURTHER, TOGETHER"
                  title="Good ideas deserve a chance."
                  subtitle="Student support and possibilities for a brighter future."
                />
                <View style={s.tiles}>
                  <View style={[s.card, { backgroundColor: "#e9eee5" }]}>
                    <Icon name="heart-outline" size={28} />
                    <Text style={s.sectionHeading}>Helping Hands</Text>
                    <Text style={s.muted}>
                      Get support for tuition, books, and the essentials that
                      keep you learning.
                    </Text>
                    <Button
                      label="Apply for assistance"
                      onPress={() => openForm("assistance")}
                    />
                  </View>
                  <View style={[s.card, { backgroundColor: "#f4ecdc" }]}>
                    <Icon name="bulb-outline" size={28} />
                    <Text style={s.sectionHeading}>Supporting Hands</Text>
                    <Text style={s.muted}>
                      Bring a student-led project to life with guidance and
                      funding.
                    </Text>
                    <Button
                      label="Submit your idea"
                      onPress={() => openForm("idea")}
                    />
                  </View>
                </View>
                <Text style={s.sectionHeading}>Meet the possibilities</Text>
                <View style={s.tiles}>
                  {publicEntries
                    .filter((e) => ["assistance", "idea"].includes(e.kind))
                    .map((e) => (
                      <EntryCard key={e.id} entry={e} />
                    ))}
                </View>
              </>
            )}
            {page === "Community" && (
              <>
                <Heading
                  eyebrow="A LITTLE INSPIRATION"
                  title="Share what you’re learning."
                  subtitle="Short educational moments. Then, back to your next chapter."
                  action={
                    <Button
                      label="Submit a reel"
                      onPress={() => openForm("reel")}
                    />
                  }
                />
                <View style={s.card}>
                  <Icon name="videocam-outline" size={35} />
                  <Text style={s.cardTitle}>Space for student stories</Text>
                  <Text style={s.muted}>
                    Approved student videos appear here. Keep it educational,
                    respectful, and short.
                  </Text>
                </View>
                {publicEntries
                  .filter((e) => e.kind === "reel")
                  .map((e) => (
                    <EntryCard key={e.id} entry={e} />
                  ))}
              </>
            )}
            {page === "Earnings" && (
              <>
                <Heading
                  eyebrow="YOUR CONTRIBUTION MATTERS"
                  title="Create. Teach. Grow."
                  subtitle="A clear view of your earnings and payouts."
                />
                <View style={s.stats}>
                  {[
                    "Pending earnings",
                    "Approved earnings",
                    "Available to withdraw",
                  ].map((t) => (
                    <View style={s.stat} key={t}>
                      <View>
                        <Text style={s.small}>{t}</Text>
                        <Text style={s.heading}>—</Text>
                      </View>
                    </View>
                  ))}
                </View>
                <View style={s.card}>
                  <Text style={s.cardTitle}>
                    Monetization requires approval
                  </Text>
                  <Text style={s.muted}>
                    Earnings are calculated from verified activity using
                    administrator-managed rates. Live earnings and payouts are
                    not connected in this build.
                  </Text>
                  <Button label="View account" onPress={() => go("Account")} />
                </View>
                <Text style={s.sectionHeading}>Transaction history</Text>
                <Text style={s.empty}>No transactions to display.</Text>
              </>
            )}
            {page === "Premier" && (
              <>
                <Plans notify={setNotice} />
                <Heading
                  eyebrow="EDUCATION FORUM PREMIER"
                  title="Invest in your next chapter."
                  subtitle="More ways to learn, with benefits managed by the platform."
                />
                <View style={s.card}>
                  <Icon name="sparkles-outline" size={32} />
                  <Text style={s.sectionHeading}>
                    Good things are taking shape.
                  </Text>
                  <Text style={s.muted}>
                    Premier plans and prices will appear after the owner
                    configures and activates them. No subscription is charged in
                    this preview.
                  </Text>
                  <Button
                    label="Explore free learning"
                    onPress={() => go("Learning")}
                  />
                </View>
              </>
            )}
            {page === "Account" && (
              <>
                <Heading
                  eyebrow="YOUR SPACE"
                  title={user?.email || "Welcome, curious mind."}
                  subtitle={
                    backend
                      ? "Manage your account and submissions."
                      : "Explore the app with a local demo profile."
                  }
                />
                {backend ? (
                  <Button
                    label={user ? "Sign out" : "Sign in / Create account"}
                    onPress={() =>
                      user
                        ? void run(async () => {
                            const { error } = await backend!.auth.signOut();
                            if (error) throw error;
                          })
                        : setAuth(true)
                    }
                  />
                ) : (
                  <View style={s.card}>
                    <Text style={s.cardTitle}>Preview mode</Text>
                    <Text style={s.muted}>
                      Your submissions, bookmarks, and progress are saved on
                      this device. Sample administrator access only affects this
                      preview.
                    </Text>
                    <Button
                      label={
                        demoAdmin
                          ? "Leave admin preview"
                          : "Explore admin preview"
                      }
                      onPress={() => {
                        setDemoAdmin(!demoAdmin);
                        if (!demoAdmin) go("Admin");
                      }}
                    />
                  </View>
                )}
                {admin && (
                  <Button
                    label="Open admin dashboard"
                    onPress={() => go("Admin")}
                  />
                )}
                <Text style={s.sectionHeading}>My submissions</Text>
                {entries
                  .filter(
                    (e) =>
                      e.owner_id === (user?.id || "demo") &&
                      !initialEntries.some((x) => x.id === e.id),
                  )
                  .map((e) => (
                    <View style={s.card} key={e.id}>
                      <Text style={s.tag}>{e.status.replace("_", " ")}</Text>
                      <Text style={s.cardTitle}>{e.title}</Text>
                      <Text style={s.small}>
                        {e.kind} · {new Date(e.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                  ))}
                <Text style={s.sectionHeading}>Saved for later</Text>
                {saved.length === 0 && (
                  <Text style={s.empty}>
                    Tap the bookmark on a book to keep it here.
                  </Text>
                )}
                {entries
                  .filter(
                    (e) => saved.includes(e.id) && e.status === "approved",
                  )
                  .map((e) => (
                    <Pressable
                      key={e.id}
                      style={s.card}
                      onPress={() => setReader(e)}
                    >
                      <Text style={s.cardTitle}>{e.title}</Text>
                      <Text style={s.link}>Continue reading →</Text>
                    </Pressable>
                  ))}
              </>
            )}
            {page === "Admin" && admin && (
              <>
                <Heading
                  eyebrow="ADMINISTRATION"
                  title="A thoughtful space needs care."
                  subtitle="Review submissions before they become public."
                />
                <TextInput
                  style={s.input}
                  accessibilityLabel="Review reason"
                  placeholder="Decision reason (required for audit history)"
                  value={reviewReason}
                  onChangeText={setReviewReason}
                />
                {entries.filter(
                  (e) =>
                    e.status === "pending" || e.status === "changes_requested",
                ).length === 0 && (
                  <Text style={s.empty}>Your review queue is clear.</Text>
                )}
                {entries
                  .filter(
                    (e) =>
                      e.status === "pending" ||
                      e.status === "changes_requested",
                  )
                  .map((e) => (
                    <View style={s.card} key={e.id}>
                      <Text style={s.tag}>
                        {e.kind} · {e.status}
                      </Text>
                      <Text style={s.cardTitle}>{e.title}</Text>
                      <Text style={s.muted}>{e.description}</Text>
                      <Text style={s.small}>
                        Submitted by {e.author} ·{" "}
                        {new Date(e.created_at).toLocaleDateString()}
                      </Text>
                      <Button
                        secondary
                        label="Preview submission"
                        onPress={() => setReader(e)}
                      />
                      <View style={[s.row, { flexWrap: "wrap", gap: 8 }]}>
                        <Button
                          label="Approve"
                          onPress={() => void decide(e, "approved")}
                        />
                        <Button
                          secondary
                          label="Request changes"
                          onPress={() => void decide(e, "changes_requested")}
                        />
                        <Button
                          secondary
                          label="Reject"
                          onPress={() => void decide(e, "rejected")}
                        />
                      </View>
                    </View>
                  ))}
                <Text style={s.sectionHeading}>Published content</Text>
                {publicEntries.map((e) => (
                  <View style={s.card} key={e.id}>
                    <Text style={s.cardTitle}>{e.title}</Text>
                    <Button
                      secondary
                      label="Remove from public view"
                      onPress={() => void decide(e, "removed")}
                    />
                  </View>
                ))}
                <Management notify={setNotice} />
                <Text style={s.sectionHeading}>Preview decision history</Text>
                {history.map((h) => (
                  <Text style={s.muted} key={h.id}>
                    {h.action} · {h.reason} ·{" "}
                    {new Date(h.created_at).toLocaleString()}
                  </Text>
                ))}
                <View style={s.card}>
                  <Text style={s.cardTitle}>Financial configuration</Text>
                  <Text style={s.muted}>
                    The database includes protected plans, feature rules,
                    earnings policies, transactions, and funding agreements.
                    Provider integrations, verified activity processing, and
                    financial disbursement workflows remain to be implemented.
                  </Text>
                </View>
              </>
            )}
            <View style={s.footer}>
              <View style={s.row}>
                <Icon name="leaf-outline" size={16} />
                <Text style={s.small}> A little learning, every day.</Text>
              </View>
              <Text style={s.small}>Education Forum © 2026</Text>
            </View>
          </ScrollView>
          {!desktop && (
            <ScrollView
              horizontal
              style={s.bottomNav}
              contentContainerStyle={{ alignItems: "center" }}
              showsHorizontalScrollIndicator={false}
            >
              {[
                ...nav,
                { name: "Account", icon: "person-outline" as IconName },
                ...(admin
                  ? [
                      {
                        name: "Admin",
                        icon: "shield-checkmark-outline" as IconName,
                      },
                    ]
                  : []),
              ].map((n) => (
                <Pressable
                  key={n.name}
                  onPress={() => go(n.name)}
                  style={s.mobileNav}
                >
                  <Icon
                    name={n.icon}
                    color={page === n.name ? "#245642" : "#909b92"}
                  />
                  <Text
                    style={{
                      fontSize: 10,
                      color: page === n.name ? "#245642" : "#78867c",
                    }}
                  >
                    {n.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
      <Modal
        visible={!!reader}
        animationType="slide"
        onRequestClose={() => setReader(null)}
      >
        <SafeAreaView style={s.safe}>
          <ScrollView contentContainerStyle={s.modalContent}>
            <Button
              secondary
              label="← Back to discovery"
              onPress={() => setReader(null)}
            />
            {reader && (
              <>
                <Text style={s.eyebrow}>
                  {reader.category} / {reader.level}
                </Text>
                <Text style={s.heading}>{reader.title}</Text>
                <Text style={s.muted}>By {reader.author}</Text>
                <Text style={s.reading}>{reader.description}</Text>
                {reader.file_path && (
                  <Button
                    label="Open attached file"
                    onPress={() =>
                      void run(async () => {
                        if (!backend) {
                          await Linking.openURL(reader.file_path!);
                          return;
                        }
                        if (!user)
                          throw new Error("Sign in to open attached files.");
                        const { data, error } = await backend.storage
                          .from("submissions")
                          .createSignedUrl(reader.file_path!, 60);
                        if (error) throw error;
                        await Linking.openURL(data.signedUrl);
                      })
                    }
                  />
                )}
                <Button
                  secondary
                  label={
                    saved.includes(reader.id)
                      ? "Remove bookmark"
                      : "Save for later"
                  }
                  onPress={() => toggleSaved(reader.id)}
                />
                {["assistance", "idea"].includes(reader.kind) && (
                  <Button
                    label="Support this initiative"
                    onPress={() =>
                      setNotice(
                        "Donations are not enabled yet. No money has been charged.",
                      )
                    }
                  />
                )}
                <Button
                  secondary
                  label="Report this content"
                  onPress={() =>
                    void run(async () => {
                      if (backend) {
                        if (!user)
                          throw new Error("Sign in to submit a report.");
                        const { error } = await backend.from("reports").insert({
                          entry_id: reader.id,
                          reporter_id: user.id,
                          reason: "User requested a content review",
                        });
                        if (error) throw error;
                      }
                      setNotice(
                        backend
                          ? "Report submitted to the moderation team."
                          : "Demo report recorded. No live moderation team is connected.",
                      );
                    })
                  }
                />
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
      <Modal
        visible={!!form}
        animationType="slide"
        onRequestClose={() => setForm(null)}
      >
        <SafeAreaView style={s.safe}>
          <ScrollView
            contentContainerStyle={s.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            <Button secondary label="← Cancel" onPress={() => setForm(null)} />
            <Text style={s.heading}>
              {form === "book"
                ? "Share a good read."
                : form === "idea"
                  ? "Start something meaningful."
                  : form === "assistance"
                    ? "Let’s take the next step."
                    : "Share your knowledge."}
            </Text>
            <Text style={s.muted}>
              Every submission starts privately. An administrator reviews it
              before publication. Keep sensitive personal information out of the
              public description.
            </Text>
            {[
              { label: "Title", value: title, set: setTitle },
              {
                label: "Public description / purpose",
                value: description,
                set: setDescription,
              },
              { label: "Subject or category", value: subject, set: setSubject },
              {
                label: "Author / public display name",
                value: author,
                set: setAuthor,
              },
            ].map((f) => (
              <View key={f.label}>
                <Text style={s.label}>{f.label}</Text>
                <TextInput
                  accessibilityLabel={f.label}
                  style={[
                    s.input,
                    f.label.includes("description") && {
                      height: 140,
                      textAlignVertical: "top",
                    },
                  ]}
                  value={f.value}
                  onChangeText={f.set}
                  multiline={f.label.includes("description")}
                />
              </View>
            ))}
            <Button
              secondary
              label={
                attachment
                  ? `Attached: ${attachment.name}`
                  : "Attach a document or video"
              }
              onPress={() =>
                void run(async () => {
                  const r = await DocumentPicker.getDocumentAsync({
                    type: form === "reel" ? "video/*" : "application/pdf",
                    copyToCacheDirectory: true,
                  });
                  if (!r.canceled) {
                    if ((r.assets[0].size || 0) > 20 * 1024 * 1024)
                      throw new Error(
                        "Please choose a file smaller than 20 MB.",
                      );
                    setAttachment(r.assets[0]);
                  }
                })
              }
            />
            <Button
              label={busy ? "Submitting…" : "Submit for review"}
              onPress={() => {
                if (!busy) void submit();
              }}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
      <Modal
        visible={auth}
        animationType="slide"
        onRequestClose={() => setAuth(false)}
      >
        <SafeAreaView style={s.safe}>
          <View style={s.modalContent}>
            <Button secondary label="← Back" onPress={() => setAuth(false)} />
            <Text style={s.heading}>
              {signup ? "Your next chapter starts here." : "Welcome back."}
            </Text>
            <TextInput
              style={s.input}
              placeholder="Email address"
              accessibilityLabel="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={s.input}
              placeholder="Password (at least 8 characters)"
              accessibilityLabel="Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <Button
              label={signup ? "Create account" : "Sign in"}
              onPress={() => {
                if (!busy)
                  void run(async () => {
                    if (password.length < 8)
                      throw new Error(
                        "Use at least 8 characters for your password.",
                      );
                    const { error } = signup
                      ? await backend!.auth.signUp({ email, password })
                      : await backend!.auth.signInWithPassword({
                          email,
                          password,
                        });
                    if (error) throw error;
                    setAuth(false);
                    setNotice(
                      signup
                        ? "Check your email to confirm your account."
                        : "Welcome back.",
                    );
                  });
              }}
            />
            <Button
              secondary
              label={
                signup
                  ? "Already have an account? Sign in"
                  : "New here? Create an account"
              }
              onPress={() => setSignup(!signup)}
            />
            <Button
              secondary
              label="Send password reset email"
              onPress={() =>
                void run(async () => {
                  const { error } =
                    await backend!.auth.resetPasswordForEmail(email);
                  if (error) throw error;
                  setNotice("Password reset email requested.");
                })
              }
            />
          </View>
        </SafeAreaView>
      </Modal>
      <Modal
        visible={!!lesson}
        animationType="slide"
        onRequestClose={() => setLesson(null)}
      >
        <SafeAreaView style={s.safe}>
          <ScrollView contentContainerStyle={s.modalContent}>
            <Button
              secondary
              label="← Back to learning"
              onPress={() => setLesson(null)}
            />
            {lesson && (
              <>
                <Text style={{ fontSize: 48 }}>{lesson.flag}</Text>
                <Text style={s.heading}>{lesson.name}: a simple hello.</Text>
                <Text style={s.reading}>
                  {lesson.greeting} = {lesson.answer}
                  {"\n\n"}
                  {lesson.phrase} = {lesson.meaning}
                </Text>
                <Text style={s.sectionHeading}>
                  What does “{lesson.greeting}” mean?
                </Text>
                {lesson.options.map((o) => (
                  <Button
                    key={o}
                    secondary
                    label={o}
                    onPress={() => {
                      setAnswer(o);
                      if (o === lesson.answer)
                        setProgress((p) => ({ ...p, [lesson.name]: 100 }));
                    }}
                  />
                ))}
                {answer && (
                  <Text style={s.cardTitle}>
                    {answer === lesson.answer
                      ? "Correct! You completed this introductory lesson."
                      : "Not quite. Take another look and try again."}
                  </Text>
                )}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
      {!!notice && (
        <View style={s.toast}>
          <Text style={{ flex: 1, color: "white", lineHeight: 21 }}>
            {notice}
          </Text>
          <Pressable
            accessibilityLabel="Dismiss message"
            onPress={() => setNotice("")}
          >
            <Icon name="close" color="white" />
          </Pressable>
        </View>
      )}
      {busy && (
        <View style={s.loading}>
          <ActivityIndicator color="#245642" />
        </View>
      )}
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fafbf7" },
  shell: { flex: 1, flexDirection: "row" },
  sidebar: {
    width: 246,
    padding: 25,
    backgroundColor: "#fff",
    borderRightWidth: 1,
    borderColor: "#e5e9e1",
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 12 },
  logo: {
    width: 43,
    height: 47,
    backgroundColor: "#2c5845",
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  brandText: {
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 25,
    color: "#294e3f",
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    color: "#7c8a74",
    marginBottom: 12,
  },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 13,
    marginVertical: 3,
    borderRadius: 8,
  },
  navActive: { backgroundColor: "#eaf0e7" },
  navText: { fontSize: 14, color: "#6d7970" },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 5,
    backgroundColor: "#ca9556",
    marginLeft: "auto",
  },
  premierCard: {
    backgroundColor: "#f3f4e9",
    padding: 16,
    borderRadius: 12,
    gap: 10,
    marginVertical: 20,
  },
  sidebarFoot: { fontSize: 11, color: "#99a094", marginTop: 17 },
  topbar: {
    height: 78,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#e6eae3",
    paddingHorizontal: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topTitle: { fontSize: 13, color: "#637168" },
  topBadge: {
    fontSize: 8,
    letterSpacing: 1.5,
    color: "#84937d",
    marginLeft: 18,
  },
  avatar: {
    width: 38,
    height: 38,
    backgroundColor: "#edf0e2",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  demoBar: {
    paddingVertical: 6,
    backgroundColor: "#f1f0e6",
    alignItems: "center",
  },
  demoText: { fontSize: 10, color: "#7c7a60" },
  main: {
    maxWidth: 1500,
    width: "100%",
    alignSelf: "center",
    paddingBottom: 35,
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 27,
  },
  heading: {
    fontSize: 34,
    fontWeight: "600",
    letterSpacing: -1.3,
    color: "#263f31",
    marginBottom: 12,
  },
  muted: { fontSize: 14, lineHeight: 23, color: "#7a8479" },
  hero: {
    backgroundColor: "#e9eedf",
    borderRadius: 16,
    padding: 34,
    minHeight: 300,
    overflow: "hidden",
  },
  heroLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
    color: "#6e8061",
    marginBottom: 18,
  },
  heroTitle: {
    fontSize: 38,
    lineHeight: 45,
    fontWeight: "600",
    letterSpacing: -1.3,
    color: "#2a4b35",
  },
  heroText: { fontSize: 14, lineHeight: 23, color: "#78846e", marginTop: 14 },
  heroArt: { width: 270, height: 260, alignSelf: "center" },
  sun: {
    position: "absolute",
    width: 225,
    height: 225,
    borderRadius: 130,
    backgroundColor: "#dbe3cc",
    left: 38,
    top: 9,
  },
  artBook: {
    position: "absolute",
    width: 140,
    height: 200,
    borderRadius: 5,
    padding: 17,
    boxShadow: "5px 9px 15px #00000018",
    justifyContent: "space-between",
  },
  artBookText: {
    fontSize: 23,
    fontWeight: "800",
    letterSpacing: -1,
    color: "#fff7e9",
  },
  bookLine: {
    height: 3,
    backgroundColor: "#efc993",
    width: 75,
    marginBottom: 16,
  },
  button: {
    backgroundColor: "#2c5744",
    paddingVertical: 13,
    paddingHorizontal: 19,
    borderRadius: 7,
    alignItems: "center",
    marginVertical: 5,
  },
  secondary: {
    backgroundColor: "#edf1e8",
    borderWidth: 1,
    borderColor: "#dce4d6",
  },
  buttonText: { color: "white", fontSize: 12, fontWeight: "600" },
  stats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginVertical: 24,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e9df",
    padding: 18,
    borderRadius: 10,
    flex: 1,
    minWidth: 205,
  },
  iconTile: {
    width: 39,
    height: 39,
    borderRadius: 10,
    backgroundColor: "#f2f4eb",
    alignItems: "center",
    justifyContent: "center",
  },
  small: { fontSize: 11, color: "#899081", lineHeight: 18 },
  statValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#3b5141",
    marginTop: 3,
  },
  sectionTitle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 14,
    marginBottom: 19,
  },
  sectionHeading: {
    fontSize: 21,
    fontWeight: "600",
    color: "#2f4938",
    letterSpacing: -0.5,
    marginVertical: 8,
  },
  link: { fontSize: 12, fontWeight: "600", color: "#50734e" },
  books: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 20,
    justifyContent: "space-between",
    marginBottom: 20,
  },
  bookCard: { marginBottom: 8 },
  cover: {
    height: 225,
    borderRadius: 8,
    padding: 20,
    overflow: "hidden",
    justifyContent: "space-between",
  },
  coverTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  coverLabel: { fontSize: 6, color: "#ffffffc0", letterSpacing: 1 },
  coverTitle: {
    fontSize: 26,
    lineHeight: 29,
    fontWeight: "600",
    color: "#fffaf0",
    letterSpacing: -0.7,
    zIndex: 1,
  },
  coverAuthor: { fontSize: 7, letterSpacing: 1.8, color: "#ffffffd0" },
  orbit: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 110,
    borderWidth: 1,
    borderColor: "#ffffff35",
    right: -60,
    top: 20,
    transform: [{ scaleX: 0.7 }, { rotate: "35deg" }],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  category: { fontSize: 10, color: "#6a8457", marginVertical: 12 },
  cardTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
    color: "#304536",
    marginBottom: 8,
  },
  tiles: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginVertical: 12,
  },
  languageCard: {
    flex: 1,
    minWidth: 220,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e9df",
    borderRadius: 10,
    padding: 20,
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
  },
  card: {
    padding: 24,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e3e8dc",
    borderRadius: 12,
    marginVertical: 10,
    gap: 12,
    flexGrow: 1,
    flexBasis: 270,
  },
  track: {
    height: 5,
    backgroundColor: "#e9eee4",
    borderRadius: 5,
    marginTop: 12,
  },
  fill: { height: 5, backgroundColor: "#628158", borderRadius: 5 },
  tag: {
    fontSize: 10,
    color: "#648057",
    backgroundColor: "#edf3e8",
    padding: 7,
    borderRadius: 5,
    alignSelf: "flex-start",
  },
  search: {
    padding: 17,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#dfe5d7",
    borderRadius: 10,
    marginBottom: 20,
    fontSize: 14,
    color: "#2c4936",
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 17,
    backgroundColor: "#edf0e8",
    borderRadius: 20,
    marginRight: 9,
  },
  chipActive: { backgroundColor: "#315c46" },
  empty: {
    paddingVertical: 35,
    fontSize: 14,
    lineHeight: 23,
    color: "#839078",
  },
  footer: {
    marginTop: 40,
    paddingTop: 22,
    borderTopWidth: 1,
    borderColor: "#e4e9dc",
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
  },
  bottomNav: {
    height: 74,
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderColor: "#e3e8dc",
  },
  mobileNav: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 5,
    alignItems: "center",
  },
  modalContent: {
    padding: 28,
    paddingTop: 40,
    gap: 20,
    maxWidth: 760,
    width: "100%",
    alignSelf: "center",
  },
  reading: {
    fontSize: 19,
    lineHeight: 34,
    color: "#405041",
    marginVertical: 24,
  },
  input: {
    padding: 15,
    borderWidth: 1,
    borderColor: "#d7dfd0",
    backgroundColor: "#fff",
    borderRadius: 8,
    fontSize: 15,
    color: "#2c4936",
    marginVertical: 8,
  },
  label: { fontSize: 12, fontWeight: "600", color: "#4d654d" },
  toast: {
    position: "absolute",
    bottom: 85,
    left: 20,
    right: 20,
    maxWidth: 650,
    alignSelf: "center",
    backgroundColor: "#2c4f3e",
    padding: 20,
    borderRadius: 10,
    flexDirection: "row",
    gap: 15,
    boxShadow: "0px 5px 20px #00000022",
  },
  loading: {
    position: "absolute",
    top: 90,
    right: 20,
    backgroundColor: "white",
    padding: 12,
    borderRadius: 25,
  },
});
