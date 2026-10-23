import { StudyAssistant, StudyAssistantSettings } from "./src/StudyAssistant";
import { AdminAccess } from "./src/AdminAccess";
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
  Share,
} from "./src/Theme";
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import { BillingProvider, PurchaseSettings } from "./src/Billing";
import {
  AdsProvider,
  BottomBanner,
  ReelAd,
  LessonAdOffer,
  AdPrivacy,
} from "./src/Ads";
import { PushSettings, disablePush } from "./src/PushSettings";
import { CreatorEarnings, ServiceAdministration } from "./src/CreatorEarnings";
import { useContentUsage } from "./src/useContentUsage";
import * as DeviceNotifications from "expo-notifications";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { validateAccountForm } from "./src/account-validation";
import {
  Quiz,
  Notifications,
  VideoSocial,
  EarningRates,
} from "./src/CommunityFeatures";
import { ThemeProvider, useTheme } from "./src/Theme";
import { useEducationCatalog } from "./src/education-catalog";
import { IdentitySettings, VerificationCenter } from "./src/IdentitySettings";
import { Chat, ChatModeration } from "./src/Chat";
import { SelectField, DateField } from "./src/FormControls";
import {
  educationSystems,
  levelsFor,
  canonicalGrade,
  subjects,
} from "./src/education";
import { TalentFeed } from "./src/TalentFeed";
import { TimedQuiz } from "./src/TimedQuiz";
import { QuizAdministration } from "./src/QuizAdministration";
import { VoiceAdministration } from "./src/VoiceAdministration";
import { contentLink, parseContentLink } from "./src/content-links";
import { Languages } from "./src/Languages";
import { GradePicker, SchoolFeatures } from "./src/SchoolFeatures";
import { LessonVideo } from "./src/LessonVideo";
import { grades, matchesHomeGrade } from "./src/discovery";
import { backend } from "./src/backend";
import { coreEducationRelease, isCorePage } from "./src/release";
import { authErrorMessage, validateNewPassword } from "./src/auth-errors";
import { emailRequest, getAuthRedirect } from "./src/auth-email";
import { parseAuthLink } from "./src/auth-links";
import {
  ProfileSettings,
  EducatorDirectory,
  TransactionHistory,
  SubmissionEditor,
  ReadingProgress,
  AccountRequestAdministration,
} from "./src/FeatureWorkflows";
import { CourseLibrary } from "./src/CourseLibrary";
import { FundingWorkflows } from "./src/FundingWorkflows";
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
  [
    "AI study assistant",
    "Languages",
    "Community",
    "Classrooms",
    "Safe Room",
    "Courses",
    "Educators",
    "Opportunities",
    "Language board",
  ].includes(page)
    ? "Learning"
    : [
          "Premier",
          "Earnings",
          "Community",
          "Admin",
          "Profile",
          "Settings",
          "Messages",
          "Transactions",
        ].includes(page)
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
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      accessibilityState={{ disabled }}
      style={[s.button, secondary && s.secondary, disabled && { opacity: 0.5 }]}
    >
      <Text style={[s.buttonText, secondary && { color: "#254c3f" }]}>
        {label}
      </Text>
    </Pressable>
  );
}
export default function App() {
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <LinearGradient
          colors={["#76e4ef", "#c4b5fd", "#f9a8d4"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.canvas}
        >
          <AppContent />
        </LinearGradient>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
function AppContent() {
  const theme = useTheme(),
    educationCatalog = useEducationCatalog();
  const [educationDisplay, setEducationDisplay] = useState("");
  const [moderator, setModerator] = useState(false);
  const [videoFormat, setVideoFormat] = useState<"lesson" | "talent">("lesson");
  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [country, setCountry] = useState("Zimbabwe");
  const [educationSystem, setEducationSystem] = useState("ZW"),
    [educationLevel, setEducationLevel] = useState(""),
    [username, setUsername] = useState("");
  const [invite, setInvite] = useState(""),
    [linkedVideo, setLinkedVideo] = useState(""),
    [safeResponder, setSafeResponder] = useState(false);
  const [accountType, setAccountType] = useState("student");
  const [languageStart, setLanguageStart] = useState("French");
  const [editingGrade, setEditingGrade] = useState(false);
  const [grade, setGrade] = useState<string | null>(null);
  const [signupGrade, setSignupGrade] = useState<string | null>(null);
  const [submissionGrade, setSubmissionGrade] = useState<string | null>(null);
  const [videoSearch, setVideoSearch] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const authRedirect = getAuthRedirect(
    Platform.OS,
    process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL,
    typeof window !== "undefined" ? window.location.origin : undefined,
  );
  const actionLock = useRef(false);
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
  useEffect(() => {
    const open = (url: string) => {
      const link = parseContentLink(url);
      if (link?.kind === "join") {
        setInvite(link.id);
        setPage("Classrooms");
      }
      if (link?.kind === "video") {
        setLinkedVideo(link.id);
        setPage("Community");
      }
    };
    if (Platform.OS === "web" && typeof window !== "undefined")
      open(window.location.href);
    void Linking.getInitialURL().then((url) => {
      if (url) open(url);
    });
    const sub = Linking.addEventListener("url", ({ url }) => open(url));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!linkedVideo) return;
    const entry = entries.find(
      (e) => e.id === linkedVideo && e.status === "approved",
    );
    if (entry) {
      setReader(entry);
      setLinkedVideo("");
    }
  }, [linkedVideo, entries]);
  useContentUsage(
    reader?.kind !== "reel" ? reader?.id : undefined,
    user?.id,
    !!reader,
  );
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = DeviceNotifications.addNotificationResponseReceivedListener(
      () => setPage("Notifications"),
    );
    return () => sub.remove();
  }, []);
  const admin = backend ? ["admin", "owner"].includes(role) : demoAdmin;
  function openAccount(create: boolean) {
    setSignup(create);
    setPendingConfirmation(false);
    setShowPassword(false);
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
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setNotice(authErrorMessage(e));
    } finally {
      actionLock.current = false;
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
        setPendingConfirmation(false);
        setConfirmation("");
        setEmail(session?.user.email || "");
        setPassword("");
        setAuth(true);
      }
      setUser(session?.user ?? null);
      setRole("student");
      setModerator(false);
      setSafeResponder(false);
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
            .select(
              "role,grade,moderator,safe_responder,education_level,education_ordinal",
            )
            .eq("id", session.user.id)
            .single()
            .then(({ data, error }) => {
              if (error && active && generation === authGeneration.current)
                setNotice(
                  "Could not load your grade. Refresh or choose your grade below.",
                );
              if (active && generation === authGeneration.current) {
                setRole(data?.role || "student");
                setModerator(!!data?.moderator);
                setSafeResponder(!!data?.safe_responder);
                setGrade(
                  data?.grade ||
                    (data?.education_ordinal
                      ? canonicalGrade(data.education_ordinal)
                      : null),
                );
                setEducationDisplay(data?.education_level || data?.grade || "");
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
        if (!active) return;
        setPendingConfirmation(false);
        setConfirmation("");
        setPassword("");
        if (credentials.recovery) {
          setRecovery(true);
          setAuth(true);
        } else {
          setRecovery(false);
          setAuth(false);
          setNotice("Email confirmed. You are signed in.");
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
    setVideoFormat("lesson");
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
        status:
          form === "reel" && videoFormat === "talent" ? "approved" : "pending",
        video_format: form === "reel" ? videoFormat : "lesson",
        created_at: new Date().toISOString(),
        target: 0,
        raised: 0,
        color: palette[entries.length % palette.length],
        file_path,
        media_type: attachment?.mimeType?.startsWith("video/")
          ? "video"
          : "document",
      };
      if (backend) {
        const { error } = await backend.from("entries").insert(entry);
        if (error) {
          if (file_path)
            await backend.storage.from("submissions").remove([file_path]);
          throw error;
        }
        // The submission is committed even if refreshing the list fails.
        setForm(null);
        setEntries((current) => [
          entry,
          ...current.filter((item) => item.id !== entry.id),
        ]);
        try {
          await refresh();
        } catch {
          setNotice(
            "Your submission was saved. Refresh the list to see its latest status.",
          );
          return;
        }
      } else setEntries((v) => [entry, ...v]);
      setForm(null);
      setNotice(
        form === "reel" && videoFormat === "talent"
          ? "Your talent reel is live."
          : "Submitted for review. Your submission is private until a reviewer approves it.",
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
          <Text style={s.tag}>
            {entry.video_format === "talent" ? "Community reel" : "Reviewed"}
          </Text>
        </View>
        <Text style={s.cardTitle}>{entry.title}</Text>
        <Button
          label="Share"
          secondary
          onPress={() =>
            void Share.share({
              message: entry.title + " " + contentLink("video", entry.id),
              url: contentLink("video", entry.id),
            }).catch(() => setNotice("Sharing was unavailable. Please retry."))
          }
        />
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
    <BillingProvider key={user?.id || "guest"} userId={user?.id}>
      <PushSettings userId={user?.id} promptOnly />
      <AdsProvider>
        <SafeAreaView
          edges={["top", "left", "right"]}
          style={[
            s.safe,
            Platform.OS === "web" && s.webApp,
            theme.dark && { backgroundColor: "#11241f" },
          ]}
        >
          <StatusBar style={theme.dark ? "light" : "dark"} />
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
                        <Text style={s.eyebrow}>
                          YOUR DAILY DOSE OF DISCOVERY
                        </Text>
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
                          name: "Quiz",
                          icon: "trophy-outline",
                          label: "Guru quiz",
                        },
                        {
                          name: "Notifications",
                          icon: "notifications-outline",
                          label: "Notifications",
                        },
                        {
                          name: "Reels",
                          icon: "play-circle-outline",
                          label: "Share my talent",
                        },
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
                        .filter(
                          (x) => !coreEducationRelease || isCorePage(x.name),
                        )
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
                        {grade
                          ? "Your home - " + (educationDisplay || grade)
                          : "Choose your education level in Settings"}
                      </Text>
                      <Text style={s.muted}>
                        Home shows your grade, one below and one above. Search
                        the library or videos to explore other grades.
                      </Text>
                      <Button
                        secondary
                        label="Open education settings"
                        onPress={() => go("Settings")}
                      />
                    </View>
                    <View style={s.card}>
                      <Text style={s.sectionHeading}>Video lessons</Text>
                      <Text style={s.muted}>
                        Discover videos for your grade, one below and one above.
                      </Text>
                      {homeEntries
                        .filter(
                          (e) =>
                            (e.kind === "reel" || e.media_type === "video") &&
                            e.video_format !== "talent",
                        )
                        .slice(0, 4)
                        .map((e) => (
                          <EntryCard key={e.id} entry={e} />
                        ))}
                      {!homeEntries.some(
                        (e) =>
                          (e.kind === "reel" || e.media_type === "video") &&
                          e.video_format !== "talent",
                      ) && (
                        <Text style={s.small}>
                          No videos for your grade yet. Search all video lessons
                          to explore other grades.
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
                        <Button
                          label="+ Upload"
                          onPress={() => openForm("book")}
                        />
                      }
                    />
                    <TextInput
                      placeholderTextColor="#526477"
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
                            style={{
                              color: category === c ? "white" : "#51665a",
                            }}
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
                          <Text style={[s.small, level === l && s.link]}>
                            {l}{" "}
                          </Text>
                        </Pressable>
                      ))}
                      <Pressable
                        onPress={() =>
                          setSort((v) =>
                            v === "Newest" ? "Title A–Z" : "Newest",
                          )
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
                        No books match your search. Try another subject or
                        title.
                      </Text>
                    )}
                  </>
                )}
                {page === "AI study assistant" && (
                  <StudyAssistant
                    key={user?.id || "guest"}
                    userId={user?.id}
                    onSignIn={() => setAuth(true)}
                  />
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
                    <Button
                      label="AI study assistant"
                      onPress={() => go("AI study assistant")}
                    />
                    <Button
                      label="Browse language courses"
                      onPress={() => go("Courses")}
                    />
                    <Button
                      label="Discover teachers and creators"
                      onPress={() => go("Educators")}
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
                {page === "Settings" && (
                  <IdentitySettings
                    key={user?.id || "guest"}
                    userId={user?.id}
                    onEducationChanged={(g, label) => {
                      setGrade(g);
                      setEducationDisplay(label || g);
                    }}
                  />
                )}
                {page === "Messages" && (
                  <Chat key={user?.id || "guest"} userId={user?.id} />
                )}
                {page === "Language board" && (
                  <Chat
                    key={user?.id || "guest"}
                    userId={user?.id}
                    languageBoard
                  />
                )}
                {page === "Profile" && (
                  <ProfileSettings
                    key={user?.id || "guest"}
                    userId={user?.id}
                  />
                )}
                {page === "Transactions" && (
                  <TransactionHistory
                    key={user?.id || "guest"}
                    userId={user?.id}
                  />
                )}
                {page === "Courses" && (
                  <CourseLibrary
                    key={user?.id || "guest"}
                    userId={user?.id}
                    admin={admin}
                  />
                )}
                {page === "Educators" && (
                  <EducatorDirectory
                    key={user?.id || "guest"}
                    userId={user?.id}
                  />
                )}
                {page === "Languages" && (
                  <View style={{ gap: 12 }}>
                    <Button
                      label="Language practice chat board"
                      onPress={() => go("Language board")}
                    />
                    <Languages
                      key={user?.id || "guest"}
                      userId={user?.id}
                      initialLanguage={languageStart}
                    />
                  </View>
                )}
                {["Classrooms", "Safe Room"].includes(page) && (
                  <SchoolFeatures
                    key={`${page}:${user?.id || "guest"}`}
                    page={page}
                    teacher={role === "teacher"}
                    responder={safeResponder}
                    invitation={invite}
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
                          Get support for tuition, books, and the essentials
                          that keep you learning.
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
                    <FundingWorkflows
                      key={user?.id || "guest"}
                      userId={user?.id}
                      admin={admin}
                      entries={entries}
                    />
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
                {page === "Quiz" && (
                  <TimedQuiz key={user?.id || "guest"} userId={user?.id} />
                )}
                {page === "Notifications" && (
                  <Notifications userId={user?.id} />
                )}
                {page === "Reels" && (
                  <>
                    <Heading
                      eyebrow="SHARE MY TALENT"
                      title="Student spotlight"
                      subtitle="Scroll through talent from our community."
                    />
                    <Button
                      label="Share my talent"
                      onPress={() => {
                        openForm("reel");
                        setVideoFormat("talent");
                      }}
                    />
                    <TalentFeed
                      entries={publicEntries}
                      userId={user?.id}
                      moderator={admin || moderator}
                    />
                  </>
                )}
                {page === "Community" && (
                  <>
                    <Heading
                      eyebrow="A LITTLE INSPIRATION"
                      title="Video lessons"
                      subtitle="Search video lessons across education levels, subjects and titles."
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
                        placeholderTextColor="#526477"
                        accessibilityLabel="Search video lessons"
                        placeholder="Search title, subject or grade"
                        style={s.input}
                        value={videoSearch}
                        onChangeText={setVideoSearch}
                      />
                      <Text style={s.muted}>
                        Educational video lessons appear here. Talent videos
                        have their own Share My Talent feed.
                      </Text>
                    </View>
                    {publicEntries
                      .filter(
                        (e) =>
                          (e.kind === "reel" || e.media_type === "video") &&
                          e.video_format !== "talent" &&
                          (videoSearch.trim()
                            ? `${e.title} ${e.category} ${e.level}`
                                .toLowerCase()
                                .includes(videoSearch.toLowerCase().trim())
                            : true),
                      )
                      .map((e) => (
                        <EntryCard key={e.id} entry={e} />
                      ))}
                  </>
                )}
                {page === "Earnings" && (
                  <>
                    <CreatorEarnings
                      key={user?.id || "guest"}
                      userId={user?.id}
                    />
                    <EarningRates />
                    <TransactionHistory userId={user?.id} />
                  </>
                )}
                {page === "Premier" && (
                  <Plans
                    key={user?.id || "guest"}
                    notify={setNotice}
                    userId={user?.id}
                  />
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
                          name: "Settings",
                          icon: "person-outline",
                          label: "Settings and profile",
                        },
                        {
                          name: "Messages",
                          icon: "chatbubbles-outline",
                          label: "Direct messages",
                        },
                        {
                          name: "Transactions",
                          icon: "receipt-outline",
                          label: "My transactions",
                        },
                        {
                          name: "Opportunities",
                          icon: "heart-outline",
                          label: "Helping and Supporting Hands",
                        },
                        {
                          name: "Educators",
                          icon: "school-outline",
                          label: "Discover educators",
                        },
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
                          (item) =>
                            !coreEducationRelease || isCorePage(item.name),
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
                                  await disablePush();
                                  const { error } =
                                    await backend!.auth.signOut();
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
                          this device. Sample administrator access only affects
                          this preview.
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
                    {(admin || moderator) && (
                      <Button
                        label={
                          admin
                            ? "Open admin dashboard"
                            : "Open moderator dashboard"
                        }
                        onPress={() => go("Admin")}
                      />
                    )}
                    <PurchaseSettings userId={user?.id} />
                    <AdPrivacy />
                    <PushSettings userId={user?.id} />

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
                          <Text style={s.tag}>
                            {e.status.replace("_", " ")}
                          </Text>
                          <Text style={s.cardTitle}>{e.title}</Text>
                          <Text style={s.small}>
                            {e.kind} ·{" "}
                            {new Date(e.created_at).toLocaleDateString()}
                          </Text>
                          <SubmissionEditor entry={e} refreshed={refresh} />
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
                {page === "Admin" && (admin || moderator) && (
                  <>
                    <Heading
                      eyebrow="ADMINISTRATION"
                      title="A thoughtful space needs care."
                      subtitle="Review submissions before they become public."
                    />
                    <TextInput
                      placeholderTextColor="#526477"
                      style={s.input}
                      accessibilityLabel="Review reason"
                      placeholder="Decision reason (required for audit history)"
                      value={reviewReason}
                      onChangeText={setReviewReason}
                    />
                    {entries.filter(
                      (e) =>
                        e.status === "pending" ||
                        e.status === "changes_requested",
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
                              onPress={() =>
                                void decide(e, "changes_requested")
                              }
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
                    {admin && (
                      <>
                        <Management notify={setNotice} />
                        <ServiceAdministration />
                        <VerificationCenter userId={user?.id} admin />
                        {role === "owner" && (
                          <>
                            <AdminAccess userId={user?.id} owner />
                            <StudyAssistantSettings />
                          </>
                        )}
                        <QuizAdministration />
                        <VoiceAdministration userId={user?.id} />
                        <ChatModeration />
                        <AccountRequestAdministration />
                        <TransactionHistory userId={user?.id} admin />
                        <Button
                          label="Manage language courses"
                          onPress={() => go("Courses")}
                        />
                        <Button
                          label="Manage support cases"
                          onPress={() => go("Opportunities")}
                        />
                      </>
                    )}
                    <Text style={s.sectionHeading}>
                      Preview decision history
                    </Text>
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
                          earnings policies, transactions, and funding
                          agreements. Verified purchase and payout endpoints are
                          deployed. Live payments require provider credentials
                          and settlement testing.
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </ScrollView>
              <Text style={{ fontSize: 10, textAlign: "center", padding: 4 }}>
                Powered by Xenus
              </Text>
              {!reader && !form && !auth && <BottomBanner />}
              <View
                accessibilityRole="tablist"
                style={[
                  s.bottomNav,
                  { paddingBottom: Math.max(insets.bottom, 8) },
                ]}
              >
                {tabs
                  .filter(
                    (tab) =>
                      tab.name !== "Opportunities" &&
                      (!coreEducationRelease || isCorePage(tab.name)),
                  )
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
                        <Text
                          style={[s.tabLabel, selected && s.tabLabelActive]}
                        >
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
                    <Button
                      label="Share"
                      secondary
                      onPress={() =>
                        void Share.share({
                          message: `${reader.title} ${contentLink("video", reader.id)}`,
                          url: contentLink("video", reader.id),
                        }).catch(() =>
                          setNotice("Sharing was unavailable. Please retry."),
                        )
                      }
                    />
                    <Text style={s.reading}>{reader.description}</Text>
                    {(reader.kind === "reel" ||
                      reader.media_type === "video") &&
                      reader.file_path && (
                        <>
                          {reader.video_format !== "talent" && (
                            <LessonAdOffer />
                          )}
                          <LessonVideo
                            entryId={reader.id}
                            path={reader.file_path}
                            userId={user?.id}
                          />
                          <VideoSocial
                            entryId={reader.id}
                            userId={user?.id}
                            moderator={admin || moderator}
                          />
                        </>
                      )}
                    {reader.file_path &&
                      reader.kind !== "reel" &&
                      reader.media_type !== "video" &&
                      backend && (
                        <ReadingProgress
                          key={`${user?.id}:${reader.id}`}
                          userId={user?.id}
                          entryId={reader.id}
                          open={async (page) => {
                            const r = await backend!.storage
                              .from("submissions")
                              .createSignedUrl(reader.file_path!, 60);
                            if (r.error) throw r.error;
                            await Linking.openURL(
                              r.data.signedUrl + "#page=" + page,
                            );
                          }}
                        />
                      )}
                    {reader.file_path &&
                      reader.kind !== "reel" &&
                      reader.media_type !== "video" && (
                        <Button
                          label="Open attached file"
                          onPress={() =>
                            void run(async () => {
                              if (!backend) {
                                await Linking.openURL(reader.file_path!);
                                return;
                              }
                              if (!user)
                                throw new Error(
                                  "Sign in to open attached files.",
                                );
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
                            const { error } = await backend
                              .from("reports")
                              .insert({
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
              <BottomBanner />
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
                <Button
                  secondary
                  label="← Cancel"
                  onPress={() => setForm(null)}
                />
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
                  Lessons and documents start privately. A reviewer checks them
                  before publication. Keep sensitive personal information out of
                  the public description.
                </Text>
                <Text style={s.label}>Resource grade</Text>
                {form === "reel" && (
                  <View style={s.card}>
                    <Text style={s.label}>Video type</Text>
                    <Button
                      label="Long video lesson ? review first"
                      secondary={videoFormat !== "lesson"}
                      onPress={() => setVideoFormat("lesson")}
                    />
                    <Button
                      label="Short talent reel ? publish instantly"
                      secondary={videoFormat !== "talent"}
                      onPress={() => setVideoFormat("talent")}
                    />
                  </View>
                )}
                <Text style={s.muted}>
                  Share original slides, answer sheets, question papers and
                  lessons. See published earning rates in your account.
                </Text>
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
                ].map((f) => (
                  <View key={f.label}>
                    <Text style={s.label}>{f.label}</Text>
                    <TextInput
                      placeholderTextColor="#526477"
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
                <SelectField
                  label="Subject"
                  value={subject}
                  options={subjects.map((x) => ({ value: x, label: x }))}
                  onChange={setSubject}
                />
                <Button
                  secondary
                  label={
                    attachment
                      ? `Attached: ${attachment.name}`
                      : form === "reel"
                        ? "Attach a video"
                        : form === "course"
                          ? "Attach a PDF or learning video"
                          : "Attach a PDF"
                  }
                  onPress={() =>
                    void run(async () => {
                      const r = await DocumentPicker.getDocumentAsync({
                        type:
                          form === "reel"
                            ? ["video/mp4", "video/quicktime"]
                            : form === "course"
                              ? [
                                  "application/pdf",
                                  "video/mp4",
                                  "video/quicktime",
                                ]
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
              <BottomBanner />
            </SafeAreaView>
          </Modal>
          <Modal
            visible={auth}
            animationType="slide"
            onRequestClose={() => {
              if (!busy) setAuth(false);
            }}
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
                <Button
                  secondary
                  label="← Back"
                  disabled={busy}
                  onPress={() => setAuth(false)}
                />
                <Text style={s.heading}>
                  {recovery
                    ? "Choose a new password"
                    : pendingConfirmation
                      ? "Check your email"
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
                {pendingConfirmation && (
                  <Text style={s.muted}>
                    Open the confirmation link sent to {email}. Check your spam
                    folder too. Then sign in below. If you already have an
                    account, use your existing password.
                  </Text>
                )}
                {!recovery && (
                  <TextInput
                    placeholderTextColor="#526477"
                    style={s.input}
                    placeholder="Email address"
                    accessibilityLabel="Email"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoCorrect={false}
                    autoComplete="email"
                    editable={!busy}
                    value={email}
                    onChangeText={(value) => {
                      setEmail(value);
                      setPendingConfirmation(false);
                    }}
                  />
                )}
                <TextInput
                  placeholderTextColor="#526477"
                  style={s.input}
                  placeholder="Password (at least 8 characters)"
                  accessibilityLabel="Password"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete={
                    signup || recovery ? "new-password" : "current-password"
                  }
                  editable={!busy}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <Button
                  secondary
                  disabled={busy}
                  label={showPassword ? "Hide password" : "Show password"}
                  onPress={() => setShowPassword(!showPassword)}
                />
                {(signup || recovery) && (
                  <TextInput
                    placeholderTextColor="#526477"
                    accessibilityLabel="Confirm password"
                    placeholder="Confirm password"
                    style={s.input}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="new-password"
                    editable={!busy}
                    value={confirmation}
                    onChangeText={setConfirmation}
                  />
                )}
                {signup && !recovery && (
                  <View style={{ gap: 12 }}>
                    {[
                      ["Name", firstName, setFirstName],
                      ["Surname", surname, setSurname],
                    ].map(([label, value, setter]) => (
                      <TextInput
                        key={label as string}
                        accessibilityLabel={label as string}
                        placeholder={label as string}
                        placeholderTextColor="#526477"
                        style={s.input}
                        value={value as string}
                        onChangeText={setter as (v: string) => void}
                      />
                    ))}
                    <TextInput
                      accessibilityLabel="Username"
                      placeholder="Choose a username (without ?)"
                      value={username}
                      onChangeText={setUsername}
                      autoCapitalize="none"
                      style={s.input}
                    />
                    <DateField value={birthDate} onChange={setBirthDate} />
                    <SelectField
                      label="Country"
                      value={educationSystem}
                      options={educationCatalog.systems.map((x) => ({
                        value: x.code,
                        label: x.name,
                      }))}
                      onChange={(v) => {
                        setEducationSystem(v);
                        setCountry(
                          educationCatalog.systems.find((x) => x.code === v)!
                            .name,
                        );
                        setEducationLevel("");
                        setSignupGrade(null);
                      }}
                    />
                    <Text style={s.label}>I am a {accountType}</Text>
                    <View style={s.row}>
                      {["student", "teacher", "admin"].map((type) => (
                        <Button
                          key={type}
                          label={
                            type === "admin"
                              ? "Admin"
                              : type === "teacher"
                                ? "Teacher"
                                : "Student"
                          }
                          secondary={accountType !== type}
                          onPress={() => setAccountType(type)}
                        />
                      ))}
                    </View>
                    <SelectField
                      label="Education level"
                      value={educationLevel}
                      options={educationCatalog
                        .levelsForSystem(educationSystem)
                        .map((x) => ({ value: x.label, label: x.label }))}
                      onChange={(v) => {
                        setEducationLevel(v);
                        setSignupGrade(
                          canonicalGrade(
                            educationCatalog
                              .levelsForSystem(educationSystem)
                              .find((x) => x.label === v)!.ordinal,
                          ),
                        );
                      }}
                    />
                    {accountType === "admin" && (
                      <Text>
                        Admin access requires owner approval. Confirm your
                        email, then track your request in Settings.
                      </Text>
                    )}
                    {accountType === "teacher" && (
                      <Text>
                        Your teacher status remains pending until your ID and
                        teaching video are reviewed. Submit them in Settings
                        after confirming your email.
                      </Text>
                    )}
                  </View>
                )}
                <Button
                  disabled={busy}
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
                        if (recovery)
                          validateNewPassword(password, confirmation);
                        if (signup && !recovery) {
                          if (!/^[a-z0-9_]{3,40}$/i.test(username.trim()))
                            throw new Error(
                              "Choose a username with 3-40 letters, numbers or underscores.",
                            );
                          if (
                            !firstName.trim() ||
                            !surname.trim() ||
                            !country.trim()
                          )
                            throw new Error(
                              "Enter your name, surname and country.",
                            );
                          const dob = new Date(birthDate);
                          if (
                            !/^\d{4}-\d{2}-\d{2}$/.test(birthDate) ||
                            !Number.isFinite(dob.getTime()) ||
                            dob.toISOString().slice(0, 10) !== birthDate ||
                            dob > new Date()
                          )
                            throw new Error(
                              "Enter a valid date of birth as YYYY-MM-DD.",
                            );
                        }
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
                          setConfirmation("");
                          setShowPassword(false);
                          setPassword("");
                          setAuth(false);
                          setNotice("Your password has been updated.");
                          return;
                        }
                        const { data, error } = signup
                          ? await emailRequest(normalizedEmail, () =>
                              backend!.auth.signUp({
                                email: normalizedEmail,
                                password,
                                options: {
                                  emailRedirectTo: authRedirect,
                                  data: {
                                    grade: signupGrade,
                                    first_name: firstName.trim(),
                                    surname: surname.trim(),
                                    date_of_birth: birthDate,
                                    country: country.trim(),
                                    account_type: accountType,
                                    username: username.trim().toLowerCase(),
                                    education_system: educationSystem,
                                    education_level: educationLevel,
                                  },
                                },
                              }),
                            )
                          : await backend!.auth.signInWithPassword({
                              email: normalizedEmail,
                              password,
                            });
                        if (error) throw error;
                        setPassword("");
                        setConfirmation("");
                        setShowPassword(false);
                        if (signup && !data.session) {
                          setSignup(false);
                          setPendingConfirmation(true);
                          setNotice(
                            "Check your inbox for a confirmation link. If your account is already confirmed, sign in below.",
                          );
                          return;
                        }
                        setPendingConfirmation(false);
                        setAuth(false);
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
                    disabled={busy}
                    label={
                      signup
                        ? "Already have an account? Sign in"
                        : "New here? Create an account"
                    }
                    onPress={() => {
                      setSignup(!signup);
                      setPendingConfirmation(false);
                      setShowPassword(false);
                      setPassword("");
                      setConfirmation("");
                      setNotice("");
                    }}
                  />
                )}
                {!recovery && !signup && (
                  <Button
                    secondary
                    disabled={busy}
                    label="Resend confirmation email"
                    onPress={() =>
                      void run(async () => {
                        if (!backend)
                          throw new Error(
                            "Account service is not connected yet.",
                          );
                        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
                          throw new Error("Enter a valid email address.");
                        const { error } = await emailRequest(email, () =>
                          backend!.auth.resend({
                            type: "signup",
                            email: email.trim(),
                            options: { emailRedirectTo: authRedirect },
                          }),
                        );
                        if (error) throw error;
                        setNotice(
                          "If your account needs confirmation, a link has been requested. Check your inbox and spam folder.",
                        );
                      })
                    }
                  />
                )}
                {!recovery && !signup && (
                  <Button
                    secondary
                    disabled={busy}
                    label="Send password reset email"
                    onPress={() =>
                      void run(async () => {
                        if (!backend)
                          throw new Error(
                            "Password reset is not available in this preview.",
                          );
                        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
                          throw new Error("Enter a valid email address.");
                        const { error } = await emailRequest(email, () =>
                          backend!.auth.resetPasswordForEmail(email.trim(), {
                            redirectTo: authRedirect,
                          }),
                        );
                        if (error) throw error;
                        setNotice(
                          "If an account exists for this email, a reset link has been requested. Check your inbox and spam folder before trying again.",
                        );
                      })
                    }
                  />
                )}
              </ScrollView>
              <BottomBanner />
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
      </AdsProvider>
    </BillingProvider>
  );
}
const s = StyleSheet.create({
  canvas: {
    flex: 1,
    backgroundColor: "#c5f5fa",
    alignItems: "center",
  },
  webApp: { maxWidth: 520, boxShadow: "0 0 60px #28412b12" },
  safe: {
    flex: 1,
    width: "100%",
    backgroundColor: "transparent",
  },
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
