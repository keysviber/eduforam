import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  Platform,
  BackHandler,
  RefreshControl,
  Linking,
  ActivityIndicator,
} from "react-native";
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { validateAccountForm } from "./src/account-validation";
import { Languages } from "./src/Languages";
import { GradePicker, SchoolFeatures } from "./src/SchoolFeatures";
import { LessonVideo } from "./src/LessonVideo";
import { grades, matchesHomeGrade } from "./src/discovery";
import { backend } from "./src/backend";
import { coreEducationRelease, isCorePage } from "./src/release";
import { parseAuthLink } from "./src/auth-links";
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
const tabs: {
  name: string;
  label: string;
  icon: IconName;
  selectedIcon: IconName;
}[] = [
  {
    name: "Overview",
    label: "Home",
    icon: "home-outline",
    selectedIcon: "home",
  },
  {
    name: "Library",
    label: "Library",
    icon: "book-outline",
    selectedIcon: "book",
  },
  {
    name: "Learning",
    label: "Learn",
    icon: "school-outline",
    selectedIcon: "school",
  },
  {
    name: "Opportunities",
    label: "Support",
    icon: "heart-outline",
    selectedIcon: "heart",
  },
  {
    name: "Account",
    label: "You",
    icon: "person-outline",
    selectedIcon: "person",
  },
];
const parentTab = (page: string) =>
  ["Languages", "Community", "Classrooms", "Safe Room"].includes(page)
    ? "Learning"
    : ["Premier", "Earnings", "Community", "Admin"].includes(page)
      ? "Account"
      : page;
function tactile() {
  if (Platform.OS !== "web") void Haptics.selectionAsync().catch(() => {});
}
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
  return (
    <SafeAreaProvider>
      <View style={s.canvas}>
        <AppContent />
      </View>
    </SafeAreaProvider>
  );
}
function AppContent() {
  const [languageStart, setLanguageStart] = useState("French");
  const [editingGrade, setEditingGrade] = useState(false);
  const [grade, setGrade] = useState<string | null>(null);
  const [signupGrade, setSignupGrade] = useState<string | null>(null);
  const [submissionGrade, setSubmissionGrade] = useState<string | null>(null);
  const [videoSearch, setVideoSearch] = useState("");
  const [recovery, setRecovery] = useState(false);
  const authRedirect =
    Platform.OS === "web" ? undefined : "educationforum://auth/callback";
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const authGeneration = useRef(0);
  const [routeHistory, setRouteHistory] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRead, setLastRead] = useState<string | null>(null);
  const [page, setPage] = useState("Overview"),
    [entries, setEntries] = useState<Entry[]>(backend ? [] : initialEntries),
    [saved, setSaved] = useState<string[]>([]),
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
    [confirmation, setConfirmation] = useState(""),
    [signup, setSignup] = useState(false),
    [reviewReason, setReviewReason] = useState("");
  const admin = backend ? ["admin", "owner"].includes(role) : demoAdmin;
  function openAccount(create: boolean) {
    setSignup(create);
    setRecovery(false);
    setNotice("");
    setPassword("");
    setConfirmation("");
    setAuth(true);
  }
  function AccountActions() {
    return (
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <Button label="Create account" onPress={() => openAccount(true)} />
        <Button secondary label="Log in" onPress={() => openAccount(false)} />
      </View>
    );
  }
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
    const generation = authGeneration.current;
    const { data, error } = await backend
      .from("entries")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    if (generation === authGeneration.current) setEntries(data || []);
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
            setHistory(v.history || []);
            setGrade(v.grade || null);
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
    const sub = backend?.auth.onAuthStateChange((_event, session) => {
      const generation = ++authGeneration.current;
      if (_event === "PASSWORD_RECOVERY") {
        setRecovery(true);
        setPassword("");
        setAuth(true);
      }
      setUser(session?.user ?? null);
      setRole("student");
      setGrade(null);
      if (!session) {
        setRecovery(false);
        setPassword("");
        setReader(null);
        setEntries((items) =>
          items.filter((item) => item.status === "approved"),
        );
      }
      setTimeout(() => {
        if (!active || generation !== authGeneration.current) return;
        if (session)
          backend
            ?.from("profiles")
            .select("role,grade")
            .eq("id", session.user.id)
            .single()
            .then(({ data, error }) => {
              if (error && active && generation === authGeneration.current)
                setNotice(
                  "Could not load your grade. Refresh or choose your grade below.",
                );
              if (active && generation === authGeneration.current) {
                setRole(data?.role || "student");
                setGrade(data?.grade || null);
              }
            });
        void refresh().catch(() =>
          setNotice("Could not refresh your data. Please retry."),
        );
      }, 0);
    });
    return () => {
      active = false;
      sub?.data.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!backend) return;
    let active = true;
    setSaved([]);
    if (user) {
      void backend
        .from("bookmarks")
        .select("entry_id")
        .eq("user_id", user.id)
        .then(({ data, error }) => {
          if (!active) return;
          if (error)
            setNotice("Could not load your saved books. Please try again.");
          else setSaved((data || []).map((item) => item.entry_id));
        });
    }
    return () => {
      active = false;
    };
  }, [user?.id]);
  useEffect(() => {
    if (!backend || Platform.OS === "web") return;
    let active = true;
    const handle = async (url: string) => {
      try {
        const credentials = parseAuthLink(url);
        if (!credentials) return;
        const { error } = await backend!.auth.setSession(credentials);
        if (error) throw error;
        if (active && credentials.recovery) {
          setRecovery(true);
          setPassword("");
          setAuth(true);
        }
      } catch {
        if (active)
          setNotice(
            "Unable to open the authentication link. Request a new email and try again.",
          );
      }
    };
    const listener = Linking.addEventListener("url", ({ url }) => {
      void handle(url);
    });
    void Linking.getInitialURL()
      .then((url) => {
        if (url && active) void handle(url);
      })
      .catch(() => {});
    return () => {
      active = false;
      listener.remove();
    };
  }, []);
  useEffect(() => {
    if (ready && !backend)
      void AsyncStorage.setItem(
        "education-forum-demo-v1",
        JSON.stringify({ entries, saved, history, grade }),
      ).catch(() => setNotice("Your device could not save these changes."));
  }, [entries, saved, history, grade, ready]);
  function go(p: string, root = false) {
    if (coreEducationRelease && !isCorePage(p)) return;
    tactile();
    setRouteHistory((v) => (root ? [] : p === page ? v : [...v, page]));
    setPage(p);
    setNotice("");
    setSearch("");
    setCategory("All subjects");
    setLevel("All levels");
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }
  const goBack = useCallback(() => {
    if (!routeHistory.length) return false;
    setPage(routeHistory[routeHistory.length - 1]);
    setRouteHistory((v) => v.slice(0, -1));
    setNotice("");
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    return true;
  }, [routeHistory]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (goBack()) return true;
        if (page !== "Overview") {
          setPage("Overview");
          return true;
        }
        return false;
      },
    );
    return () => subscription.remove();
  }, [goBack, page]);
  useEffect(() => {
    void AsyncStorage.getItem("ef-last-read")
      .then(setLastRead)
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (reader?.kind === "book") {
      setLastRead(reader.id);
      void AsyncStorage.setItem("ef-last-read", reader.id).catch(() => {});
    }
  }, [reader?.id]);
  async function pullToRefresh() {
    setRefreshing(true);
    try {
      if (backend) await refresh();
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : "Unable to refresh. Try again.",
      );
    } finally {
      setRefreshing(false);
    }
  }
  function openForm(kind: Kind) {
    if (coreEducationRelease && !["book", "course", "reel"].includes(kind))
      return;
    if (backend && !user) {
      setAuth(true);
      return;
    }
    setSubmissionGrade(grade);
    setForm(kind);
    setTitle("");
    setDescription("");
    setAttachment(null);
    setAuthor("");
  }
  async function submit() {
    await run(async () => {
      validateSubmission(title, description);
      if ((form === "book" || form === "reel") && !attachment)
        throw new Error(
          form === "reel"
            ? "Attach a video before submitting."
            : "Attach a PDF before submitting your book.",
        );
      if (!submissionGrade)
        throw new Error("Choose the grade for this resource.");
      if (attachment && (attachment.size || 0) > 20 * 1024 * 1024)
        throw new Error("Choose a file smaller than 20 MB.");
      if (
        form === "reel" &&
        attachment &&
        !["video/mp4", "video/quicktime"].includes(attachment.mimeType || "")
      )
        throw new Error("Choose an MP4 or QuickTime video.");
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
        level: submissionGrade,
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
  const publicEntries = entries.filter(
    (e) =>
      canPublish(e.status) &&
      (!coreEducationRelease || ["book", "course", "reel"].includes(e.kind)),
  );
  const homeEntries = publicEntries.filter((e) =>
    matchesHomeGrade(e.level, grade),
  );
  const homeBooks = homeEntries.filter((e) => e.kind === "book");
  const books = publicEntries
    .filter(
      (e) =>
        e.kind === "book" &&
        (category === "All subjects" || e.category === category) &&
        (level === "All levels" || e.level === level) &&
        `${e.title} ${e.author} ${e.category} ${e.level}`
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
  function BookCard({ book, shelf = false }: { book: Entry; shelf?: boolean }) {
    return (
      <View style={[s.bookCard, { width: shelf ? 154 : "47%" }]}>
        <Pressable
          onPress={() => setReader(book)}
          accessibilityRole="button"
          accessibilityLabel={`Read ${book.title}`}
          style={[s.cover, { backgroundColor: book.color }]}
        >
          <View style={s.coverTop}>
            <Text style={s.coverLabel}>FORUM / READ</Text>
            <Icon name="sparkles-outline" color="#fff" size={20} />
          </View>
          <View style={s.orbit} />
          <Text style={s.coverTitle}>{book.title}</Text>
          <Text style={s.coverAuthor}>{book.author.toUpperCase()}</Text>
        </Pressable>
        <View style={s.row}>
          <Text style={s.category}>{book.category}</Text>
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            style={s.bookmarkButton}
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
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[s.safe, Platform.OS === "web" && s.webApp]}
    >
      <StatusBar style="dark" />
      <View style={s.shell}>
        <View style={{ flex: 1 }}>
          <View style={s.topbar}>
            <View style={s.headerBrand}>
              {routeHistory.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                  hitSlop={8}
                  style={s.headerIcon}
                  onPress={goBack}
                >
                  <Icon name="chevron-back" size={25} />
                </Pressable>
              ) : (
                <View style={s.appLogo}>
                  <Icon name="book" color="#fff" size={21} />
                </View>
              )}
              <View>
                <Text style={s.topTitle}>
                  {page === "Overview"
                    ? "education forum"
                    : tabs.find((t) => t.name === page)?.label || page}
                </Text>
                {page === "Overview" && (
                  <Text style={s.brandCaption}>
                    A little learning. Every day.
                  </Text>
                )}
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open your profile"
              onPress={() => go("Account", true)}
              style={s.avatar}
            >
              <Text style={{ color: "#315542", fontWeight: "700" }}>
                {user?.email?.[0].toUpperCase() || "EF"}
              </Text>
            </Pressable>
          </View>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={s.main}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void pullToRefresh()}
                tintColor="#2c5744"
              />
            }
          >
            {page === "Overview" && (
              <>
                <View style={s.greetingRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.eyebrow}>YOUR DAILY DOSE OF DISCOVERY</Text>
                    <Text style={s.homeHeading}>
                      What will you learn today?
                    </Text>
                  </View>
                  {!backend && (
                    <View style={s.previewPill}>
                      <Text style={s.previewText}>DEMO</Text>
                    </View>
                  )}
                </View>
                {!user && <AccountActions />}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Search the library"
                  style={s.homeSearch}
                  onPress={() => go("Library", true)}
                >
                  <Icon name="search-outline" color="#7b887d" />
                  <Text style={s.searchHint}>
                    Books, subjects, something new…
                  </Text>
                  <Icon name="options-outline" size={18} />
                </Pressable>
                <View style={s.quickActions}>
                  {[
                    {
                      name: "Community",
                      icon: "videocam-outline",
                      label: "Video lessons",
                    },
                    {
                      name: "Classrooms",
                      icon: "people-outline",
                      label: "Join classroom",
                    },
                    {
                      name: "Safe Room",
                      icon: "shield-checkmark-outline",
                      label: "Safe Room",
                    },
                    {
                      name: "Languages",
                      icon: "globe-outline",
                      label: "Languages",
                    },
                    {
                      name: "Opportunities",
                      icon: "heart-outline",
                      label: "Student support",
                    },
                    {
                      name: "Account",
                      icon: "bookmark-outline",
                      label: "Saved books",
                    },
                    {
                      name: "Premier",
                      icon: "sparkles-outline",
                      label: "Premier",
                    },
                  ]
                    .filter((x) => !coreEducationRelease || isCorePage(x.name))
                    .map((x) => (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={x.label}
                        key={x.name}
                        onPress={() => go(x.name)}
                        style={s.quickAction}
                      >
                        <View style={s.quickIcon}>
                          <Icon name={x.icon as IconName} size={23} />
                        </View>
                        <Text style={s.quickLabel}>{x.label}</Text>
                      </Pressable>
                    ))}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    homeEntries.some((e) => e.id === lastRead)
                      ? "Continue reading"
                      : "Explore the library"
                  }
                  style={s.continueCard}
                  onPress={() => {
                    const book = homeEntries.find((e) => e.id === lastRead);
                    if (book) setReader(book);
                    else go("Library", true);
                  }}
                >
                  <View style={{ flex: 1, gap: 9 }}>
                    <Text style={s.continueEyebrow}>
                      {homeEntries.some((e) => e.id === lastRead)
                        ? "PICK UP WHERE YOU LEFT OFF"
                        : "YOUR NEXT CHAPTER"}
                    </Text>
                    <Text numberOfLines={3} style={s.continueTitle}>
                      {homeEntries.find((e) => e.id === lastRead)?.title ||
                        "Big ideas start with a little curiosity."}
                    </Text>
                    <View style={s.continueAction}>
                      <Text style={s.continueActionText}>
                        {homeEntries.some((e) => e.id === lastRead)
                          ? "Continue reading"
                          : "Find your next read"}
                      </Text>
                      <Icon name="arrow-forward" size={17} color="#fff" />
                    </View>
                  </View>
                  <View style={s.miniBook}>
                    <Text style={s.miniBookTop}>EDUCATION FORUM</Text>
                    <Icon name="leaf-outline" size={40} color="#3b5a3d" />
                    <Text style={s.miniBookBottom}>STAY CURIOUS.</Text>
                  </View>
                </Pressable>
                <View style={s.momentum}>
                  <Icon name="sparkles-outline" size={19} color="#8e7839" />
                  <Text style={s.momentumText}>
                    {"Make a little time for a new idea."}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Open learning"
                    onPress={() => go("Learning", true)}
                  >
                    <Icon name="chevron-forward" size={18} />
                  </Pressable>
                </View>
                <View style={s.card}>
                  <Text style={s.cardTitle}>
                    {grade ? "Your home - " + grade : "Choose your grade"}
                  </Text>
                  <Text style={s.muted}>
                    Home shows your grade, one below and one above. Search the
                    library or videos to explore other grades.
                  </Text>
                  {grade && (!backend || user) && (
                    <Button
                      secondary
                      label={
                        editingGrade ? "Cancel grade change" : "Change grade"
                      }
                      onPress={() => setEditingGrade((v) => !v)}
                    />
                  )}
                  {(!backend || user) && (!grade || editingGrade) && (
                    <GradePicker
                      value={grade}
                      onChange={(g) => {
                        if (!backend) {
                          setGrade(g);
                          setEditingGrade(false);
                          return;
                        }
                        if (busy) return;
                        const generation = authGeneration.current;
                        void run(async () => {
                          const { error } = await backend!.rpc("set_my_grade", {
                            new_grade: g,
                          });
                          if (error) throw error;
                          if (generation === authGeneration.current) {
                            setGrade(g);
                            setEditingGrade(false);
                          }
                        });
                      }}
                    />
                  )}
                </View>
                <View style={s.card}>
                  <Text style={s.sectionHeading}>Video lessons</Text>
                  <Text style={s.muted}>
                    Watch approved lessons for your grade and nearby grades.
                  </Text>
                  {homeEntries
                    .filter((e) => e.kind === "reel")
                    .slice(0, 3)
                    .map((e) => (
                      <EntryCard key={e.id} entry={e} />
                    ))}
                  {!homeEntries.some((e) => e.kind === "reel") && (
                    <Text style={s.small}>
                      {grade
                        ? "No approved videos for your grade yet."
                        : "Choose your grade to see recommended videos."}
                    </Text>
                  )}
                  <Button
                    label="Search all video lessons"
                    onPress={() => go("Community")}
                  />
                </View>
                <View style={s.sectionTitle}>
                  <Text style={s.sectionHeading}>Your next great read</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="See all books"
                    hitSlop={10}
                    onPress={() => go("Library", true)}
                  >
                    <Text style={s.link}>See all</Text>
                  </Pressable>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.bookShelf}
                >
                  {homeBooks.slice(0, 6).map((book) => (
                    <BookCard key={book.id} book={book} shelf />
                  ))}
                </ScrollView>
                <View style={s.sectionTitle}>
                  <Text style={s.sectionHeading}>
                    Say hello to a new language
                  </Text>
                </View>
                {languages.map((l) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Start ${l.name}`}
                    key={l.name}
                    style={s.languageRow}
                    onPress={() => {
                      setLanguageStart(l.name);
                      go("Languages");
                    }}
                  >
                    <View style={s.flagTile}>
                      <Text style={{ fontSize: 26 }}>{l.flag}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardTitle}>{l.name}</Text>
                      <Text style={s.small}>
                        Beginner: four categories, starting with greetings
                      </Text>
                    </View>
                    <Icon name="chevron-forward" color="#628158" />
                  </Pressable>
                ))}
                {!backend && (
                  <Text style={s.demoFootnote}>
                    Demo content · No real payments
                  </Text>
                )}
              </>
            )}
            {page === "Library" && (
              <>
                <Heading
                  eyebrow="THE EDUCATION LIBRARY"
                  title="Your library"
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
                  {[
                    "All levels",
                    ...grades,
                    "Beginner",
                    "Secondary",
                    "University",
                  ].map((l) => (
                    <Pressable key={l} onPress={() => setLevel(l)}>
                      <Text style={[s.small, level === l && s.link]}>{l} </Text>
                    </Pressable>
                  ))}
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
                  title="Keep growing."
                  subtitle="Practical lessons to help you find your rhythm."
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Explore language lessons"
                  style={s.languageRow}
                  onPress={() => go("Languages")}
                >
                  <View style={s.quickIcon}>
                    <Icon name="globe-outline" size={26} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardTitle}>Language learning</Text>
                    <Text style={s.small}>French, Dutch & Spanish</Text>
                  </View>
                  <Icon name="chevron-forward" />
                </Pressable>
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
                    Share your expertise. Submit educational lessons for
                    administrator review.
                  </Text>
                  <Button
                    label="Submit a lesson"
                    onPress={() => openForm("course")}
                  />
                </View>
              </>
            )}
            {page === "Languages" && (
              <Languages
                key={user?.id || "guest"}
                userId={user?.id}
                initialLanguage={languageStart}
              />
            )}
            {["Classrooms", "Safe Room"].includes(page) && (
              <SchoolFeatures
                key={`${page}:${user?.id || "guest"}`}
                page={page}
                userId={user?.id}
                admin={admin}
                entries={publicEntries}
                openEntry={setReader}
                signIn={() => setAuth(true)}
              />
            )}
            {page === "Opportunities" && (
              <>
                <Heading
                  eyebrow="GO FURTHER, TOGETHER"
                  title="Go further, together."
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
                  title="Video lessons"
                  subtitle="Search approved lessons across all grades, subjects and titles."
                  action={
                    <Button
                      label="Submit a video lesson"
                      onPress={() => openForm("reel")}
                    />
                  }
                />
                <View style={s.card}>
                  <Icon name="videocam-outline" size={35} />
                  <Text style={s.cardTitle}>Learn by watching</Text>
                  <TextInput
                    accessibilityLabel="Search video lessons"
                    placeholder="Search title, subject or grade"
                    style={s.input}
                    value={videoSearch}
                    onChangeText={setVideoSearch}
                  />
                  <Text style={s.muted}>
                    Approved student videos appear here. Keep it educational,
                    respectful, and short.
                  </Text>
                </View>
                {publicEntries
                  .filter(
                    (e) =>
                      e.kind === "reel" &&
                      (videoSearch.trim()
                        ? `${e.title} ${e.category} ${e.level}`
                            .toLowerCase()
                            .includes(videoSearch.toLowerCase().trim())
                        : matchesHomeGrade(e.level, grade)),
                  )
                  .map((e) => (
                    <EntryCard key={e.id} entry={e} />
                  ))}
              </>
            )}
            {page === "Earnings" && (
              <>
                <Heading
                  eyebrow="YOUR CONTRIBUTION MATTERS"
                  title="Your earnings"
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
                  title="Explore Premier"
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
                <View style={s.accountMenu}>
                  {[
                    {
                      name: "Earnings",
                      icon: "wallet-outline",
                      label: "Earnings & payouts",
                    },
                    {
                      name: "Premier",
                      icon: "sparkles-outline",
                      label: "Explore Premier",
                    },
                    {
                      name: "Community",
                      icon: "play-circle-outline",
                      label: "Video lessons",
                    },
                  ]
                    .filter(
                      (item) => !coreEducationRelease || isCorePage(item.name),
                    )
                    .map((item) => (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={item.label}
                        key={item.name}
                        onPress={() => go(item.name)}
                        style={s.accountMenuRow}
                      >
                        <Icon name={item.icon as IconName} />
                        <Text style={s.accountMenuLabel}>{item.label}</Text>
                        <Icon name="chevron-forward" size={18} />
                      </Pressable>
                    ))}
                </View>
                {!user && <AccountActions />}
                {backend ? (
                  user && (
                    <Button
                      label="Sign out"
                      onPress={() =>
                        user
                          ? void run(async () => {
                              const { error } = await backend!.auth.signOut();
                              if (error) throw error;
                            })
                          : setAuth(true)
                      }
                    />
                  )
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
                {[
                  {
                    label: "Privacy policy",
                    url: process.env.EXPO_PUBLIC_PRIVACY_URL,
                  },
                  {
                    label: "Terms of use",
                    url: process.env.EXPO_PUBLIC_TERMS_URL,
                  },
                  {
                    label: "Contact support",
                    url: process.env.EXPO_PUBLIC_SUPPORT_URL,
                  },
                  {
                    label: "Request account deletion",
                    url: process.env.EXPO_PUBLIC_ACCOUNT_DELETION_URL,
                  },
                ]
                  .filter((item) => !!item.url)
                  .map((item) => (
                    <Button
                      key={item.label}
                      secondary
                      label={item.label}
                      onPress={() =>
                        void run(async () => {
                          await Linking.openURL(item.url!);
                        })
                      }
                    />
                  ))}
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
                {!coreEducationRelease && (
                  <View style={s.card}>
                    <Text style={s.cardTitle}>Financial configuration</Text>
                    <Text style={s.muted}>
                      The database includes protected plans, feature rules,
                      earnings policies, transactions, and funding agreements.
                      Provider integrations, verified activity processing, and
                      financial disbursement workflows remain to be implemented.
                    </Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
          <View
            accessibilityRole="tablist"
            style={[s.bottomNav, { paddingBottom: Math.max(insets.bottom, 8) }]}
          >
            {tabs
              .filter((tab) => !coreEducationRelease || isCorePage(tab.name))
              .map((tab) => {
                const selected = parentTab(page) === tab.name;
                return (
                  <Pressable
                    accessibilityRole="tab"
                    accessibilityLabel={tab.label}
                    accessibilityState={{ selected }}
                    aria-selected={selected}
                    key={tab.name}
                    onPress={() => go(tab.name, true)}
                    style={s.mobileNav}
                  >
                    <View style={[s.tabIcon, selected && s.tabIconActive]}>
                      <Icon
                        name={selected ? tab.selectedIcon : tab.icon}
                        color={selected ? "#28513e" : "#89938a"}
                        size={22}
                      />
                    </View>
                    <Text style={[s.tabLabel, selected && s.tabLabelActive]}>
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
          </View>
        </View>
      </View>
      <Modal
        visible={!!reader}
        animationType="slide"
        onRequestClose={() => setReader(null)}
      >
        <SafeAreaView style={s.safe}>
          <ScrollView
            contentContainerStyle={s.modalContent}
            automaticallyAdjustKeyboardInsets
            keyboardShouldPersistTaps="handled"
          >
            <Button
              secondary
              label="← Back to discovery"
              onPress={() => setReader(null)}
            />
            {!!notice && !!reader && (
              <Text accessibilityRole="alert" style={s.inlineNotice}>
                {notice}
              </Text>
            )}
            {reader && (
              <>
                <Text style={s.eyebrow}>
                  {reader.category} / {reader.level}
                </Text>
                <Text style={s.heading}>{reader.title}</Text>
                <Text style={s.muted}>By {reader.author}</Text>
                <Text style={s.reading}>{reader.description}</Text>
                {reader.kind === "reel" && reader.file_path && (
                  <LessonVideo path={reader.file_path} userId={user?.id} />
                )}
                {reader.file_path && reader.kind !== "reel" && (
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
        presentationStyle="pageSheet"
        allowSwipeDismissal
        animationType="slide"
        onRequestClose={() => setForm(null)}
      >
        <SafeAreaView style={s.safe}>
          <ScrollView
            contentContainerStyle={s.modalContent}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
          >
            {!!notice && !!form && (
              <Text accessibilityRole="alert" style={s.inlineNotice}>
                {notice}
              </Text>
            )}
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
            <Text style={s.label}>Resource grade</Text>
            <GradePicker
              value={submissionGrade}
              onChange={setSubmissionGrade}
            />
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
                  : form === "reel"
                    ? "Attach a video"
                    : "Attach a PDF"
              }
              onPress={() =>
                void run(async () => {
                  const r = await DocumentPicker.getDocumentAsync({
                    type:
                      form === "reel"
                        ? ["video/mp4", "video/quicktime"]
                        : "application/pdf",
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
          <ScrollView
            contentContainerStyle={s.modalContent}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
          >
            {!!notice && auth && (
              <Text accessibilityRole="alert" style={s.inlineNotice}>
                {notice}
              </Text>
            )}
            <Button secondary label="← Back" onPress={() => setAuth(false)} />
            <Text style={s.heading}>
              {recovery
                ? "Choose a new password"
                : signup
                  ? "Create your account"
                  : "Welcome back."}
            </Text>
            {!backend && (
              <Text style={s.inlineNotice}>
                Account registration and login are not available in this
                preview. You can still explore learning and the library.
              </Text>
            )}
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
            {signup && !recovery && (
              <TextInput
                accessibilityLabel="Confirm password"
                placeholder="Confirm password"
                style={s.input}
                secureTextEntry
                value={confirmation}
                onChangeText={setConfirmation}
              />
            )}
            {signup && !recovery && (
              <View style={{ gap: 12 }}>
                <Text style={s.label}>Your grade</Text>
                <GradePicker value={signupGrade} onChange={setSignupGrade} />
              </View>
            )}
            <Button
              label={
                busy
                  ? "Please wait…"
                  : recovery
                    ? "Update password"
                    : signup
                      ? "Create account"
                      : "Sign in"
              }
              onPress={() => {
                if (!busy)
                  void run(async () => {
                    if (recovery && password.length < 8)
                      throw new Error(
                        "Use at least 8 characters for your password.",
                      );
                    const normalizedEmail = recovery
                      ? email.trim()
                      : validateAccountForm({
                          email,
                          password,
                          confirmation,
                          signup,
                          grade: signupGrade,
                        });
                    if (!backend)
                      throw new Error(
                        "Account service is not connected yet. No account has been created.",
                      );
                    if (recovery) {
                      const { error } = await backend!.auth.updateUser({
                        password,
                      });
                      if (error) throw error;
                      setRecovery(false);
                      setPassword("");
                      setAuth(false);
                      setNotice("Your password has been updated.");
                      return;
                    }
                    const { data, error } = signup
                      ? await backend!.auth.signUp({
                          email: normalizedEmail,
                          password,
                          options: {
                            emailRedirectTo: authRedirect,
                            data: { grade: signupGrade },
                          },
                        })
                      : await backend!.auth.signInWithPassword({
                          email: normalizedEmail,
                          password,
                        });
                    if (error) throw error;
                    setAuth(false);
                    setPassword("");
                    setNotice(
                      signup && !data.session
                        ? "Check your email to confirm your account, then log in."
                        : signup
                          ? "Your account is ready. Welcome!"
                          : "Welcome back.",
                    );
                  });
              }}
            />
            {!recovery && (
              <Button
                secondary
                label={
                  signup
                    ? "Already have an account? Sign in"
                    : "New here? Create an account"
                }
                onPress={() => {
                  setSignup(!signup);
                  setPassword("");
                  setConfirmation("");
                  setNotice("");
                }}
              />
            )}
            {!recovery && !signup && (
              <Button
                secondary
                label="Send password reset email"
                onPress={() =>
                  void run(async () => {
                    if (!backend)
                      throw new Error(
                        "Password reset is not available in this preview.",
                      );
                    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
                      throw new Error("Enter a valid email address.");
                    const { error } = await backend.auth.resetPasswordForEmail(
                      email.trim(),
                      { redirectTo: authRedirect },
                    );
                    if (error) throw error;
                    setNotice("Password reset email requested.");
                  })
                }
              />
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
      {!!notice && !form && !auth && !reader && (
        <View accessibilityRole="alert" style={s.toast}>
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
  canvas: { flex: 1, backgroundColor: "#e6ebe3", alignItems: "center" },
  webApp: { maxWidth: 520, boxShadow: "0 0 60px #28412b12" },
  safe: { flex: 1, width: "100%", backgroundColor: "#fafbf7" },
  shell: { flex: 1, flexDirection: "row" },
  eyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    color: "#7c8a74",
    marginBottom: 12,
  },
  topbar: {
    height: 68,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#e6eae3",
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topTitle: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.5,
    color: "#2c4936",
  },
  avatar: {
    width: 44,
    height: 44,
    backgroundColor: "#edf0e2",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  main: {
    padding: 20,
    width: "100%",
    alignSelf: "center",
    paddingBottom: 35,
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  heading: {
    fontSize: 28,
    fontWeight: "600",
    letterSpacing: -1.3,
    color: "#263f31",
    marginBottom: 12,
  },
  muted: { fontSize: 14, lineHeight: 23, color: "#7a8479" },
  button: {
    backgroundColor: "#2c5744",
    paddingVertical: 13,
    paddingHorizontal: 19,
    borderRadius: 12,
    minHeight: 46,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 5,
  },
  secondary: {
    backgroundColor: "#edf1e8",
    borderWidth: 1,
    borderColor: "#dce4d6",
  },
  buttonText: { color: "white", fontSize: 13, fontWeight: "600" },
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
  small: { fontSize: 11, color: "#899081", lineHeight: 18 },
  sectionTitle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 14,
    marginBottom: 19,
  },
  sectionHeading: {
    fontSize: 19,
    fontWeight: "600",
    color: "#2f4938",
    letterSpacing: -0.5,
    marginVertical: 8,
  },
  link: { fontSize: 12, fontWeight: "600", color: "#50734e" },
  books: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    justifyContent: "space-between",
    marginBottom: 20,
  },
  bookCard: { marginBottom: 8 },
  cover: {
    height: 190,
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
    fontSize: 20,
    lineHeight: 24,
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
  card: {
    padding: 24,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e3e8dc",
    borderRadius: 12,
    marginVertical: 10,
    gap: 12,
    flexGrow: 1,
    flexBasis: "auto",
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
  bottomNav: {
    flexDirection: "row",
    flexShrink: 0,
    paddingTop: 8,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: "#e6eadf",
  },
  mobileNav: {
    flex: 1,
    minHeight: 52,
    gap: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  tabIcon: {
    width: 52,
    height: 29,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  tabIconActive: { backgroundColor: "#e9efdf" },
  tabLabel: { fontSize: 10, fontWeight: "500", color: "#89938a" },
  tabLabelActive: { color: "#28513e", fontWeight: "700" },
  headerBrand: { flexDirection: "row", alignItems: "center", gap: 10 },
  appLogo: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#2c5744",
    alignItems: "center",
    justifyContent: "center",
  },
  headerIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -10,
  },
  brandCaption: { fontSize: 9, color: "#8a9485", marginTop: 3 },
  greetingRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 18,
  },
  homeHeading: {
    fontSize: 27,
    lineHeight: 33,
    letterSpacing: -1,
    fontWeight: "700",
    color: "#2b4332",
    maxWidth: 290,
  },
  previewPill: {
    backgroundColor: "#efeede",
    borderRadius: 7,
    padding: 6,
    marginLeft: "auto",
  },
  previewText: { fontSize: 8, fontWeight: "600", color: "#928963" },
  homeSearch: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    padding: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e7eadf",
    borderRadius: 14,
    marginBottom: 20,
  },
  searchHint: { flex: 1, fontSize: 12, color: "#91988a" },
  continueCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    padding: 22,
    borderRadius: 22,
    backgroundColor: "#2c5542",
    overflow: "hidden",
  },
  continueEyebrow: {
    fontSize: 8,
    letterSpacing: 1.3,
    fontWeight: "600",
    color: "#b9cbb1",
  },
  continueTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "600",
    letterSpacing: -0.6,
    color: "#fffaf0",
  },
  continueAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 8,
    minHeight: 32,
  },
  continueActionText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  miniBook: {
    width: 85,
    height: 130,
    borderRadius: 5,
    padding: 12,
    backgroundColor: "#e3c491",
    justifyContent: "space-between",
    transform: [{ rotate: "10deg" }],
    boxShadow: "-5px 7px 0px #18372955",
  },
  miniBookTop: {
    fontSize: 6,
    fontWeight: "700",
    letterSpacing: 1,
    color: "#3b5a3d",
  },
  miniBookBottom: { fontSize: 13, fontWeight: "800", color: "#3b5a3d" },
  momentum: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingVertical: 15,
  },
  momentumText: { flex: 1, color: "#7a806b", fontSize: 11 },
  quickActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingVertical: 8,
    marginBottom: 10,
  },
  quickAction: {
    alignItems: "center",
    gap: 9,
    width: "30%",
    paddingVertical: 8,
  },
  quickIcon: {
    width: 49,
    height: 49,
    borderRadius: 17,
    backgroundColor: "#edf0e5",
    justifyContent: "center",
    alignItems: "center",
  },
  quickLabel: {
    fontSize: 10,
    fontWeight: "500",
    color: "#56694f",
    textAlign: "center",
  },
  bookShelf: { gap: 16, paddingBottom: 8 },
  bookmarkButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  languageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e6eadf",
    borderRadius: 16,
    padding: 15,
    marginBottom: 10,
  },
  flagTile: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#f4f4ed",
    alignItems: "center",
    justifyContent: "center",
  },
  accountMenu: {
    borderWidth: 1,
    borderColor: "#e6eadf",
    borderRadius: 16,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    marginBottom: 18,
  },
  accountMenuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 60,
  },
  accountMenuLabel: { flex: 1, fontSize: 14, color: "#40583e" },
  demoFootnote: {
    fontSize: 10,
    color: "#909580",
    textAlign: "center",
    marginTop: 22,
  },
  inlineNotice: {
    backgroundColor: "#eaf0e3",
    color: "#36593c",
    padding: 14,
    borderRadius: 10,
    lineHeight: 22,
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
