import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { View, Text, Pressable, Platform, AppState } from "./Theme";
import { runRewardAd } from "./ad-reward";
import mobileAds, {
  AdsConsent,
  BannerAd,
  BannerAdSize,
  MaxAdContentRating,
  TestIds,
  NativeAd,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  NativeMediaView,
  InterstitialAd,
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
} from "react-native-google-mobile-ads";
import { useBilling } from "./Billing";
const enabled = process.env.EXPO_PUBLIC_ADS_ENABLED === "true";
const testAds =
  __DEV__ ||
  (process.env.EXPO_PUBLIC_ADS_TEST_MODE === "true" &&
    process.env.EXPO_PUBLIC_APP_ENV !== "production");
const units = {
  interstitial:
    Platform.OS === "ios"
      ? process.env.EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL
      : process.env.EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL,
  banner:
    Platform.OS === "ios"
      ? process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER
      : process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER,
  native:
    Platform.OS === "ios"
      ? process.env.EXPO_PUBLIC_ADMOB_IOS_NATIVE
      : process.env.EXPO_PUBLIC_ADMOB_ANDROID_NATIVE,
  rewarded:
    Platform.OS === "ios"
      ? process.env.EXPO_PUBLIC_ADMOB_IOS_REWARDED
      : process.env.EXPO_PUBLIC_ADMOB_ANDROID_REWARDED,
};
const AdContext = createContext({
  allowed: false,
  reward: () => {},
  privacyRequired: false,
  privacy: async () => {},
});
export function AdsProvider({ children }: { children: React.ReactNode }) {
  const billing = useBilling();
  const [initialized, setInitialized] = useState(false);
  const [until, setUntil] = useState(0);
  const [privacyRequired, setPrivacyRequired] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  const [foreground, setForeground] = useState(
    AppState.currentState === "active",
  );
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      setForeground(state === "active");
    });
    return () => subscription.remove();
  }, []);
  async function privacy() {
    const version = ++generation.current;
    setInitialized(false);
    const consent = await AdsConsent.showPrivacyOptionsForm();
    if (version !== generation.current) return;
    setPrivacyRequired(consent.privacyOptionsRequirementStatus === "REQUIRED");
    if (consent.canRequestAds) {
      await mobileAds().initialize();
      if (version === generation.current) setInitialized(true);
    }
  }
  useEffect(() => {
    const version = ++generation.current;
    setInitialized(false);
    if (!enabled || !billing.ready || billing.noAds) return;
    let active = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    void (async () => {
      await mobileAds().setRequestConfiguration({
        maxAdContentRating: MaxAdContentRating.G,
        tagForChildDirectedTreatment: true,
        tagForUnderAgeOfConsent: true,
      });
      const consent = await AdsConsent.gatherConsent({
        tagForUnderAgeOfConsent: true,
      }).catch(() => AdsConsent.getConsentInfo());
      if (!active || version !== generation.current) return;
      setPrivacyRequired(
        consent.privacyOptionsRequirementStatus === "REQUIRED",
      );
      if (!consent.canRequestAds) return;
      await mobileAds().initialize();
      if (active && version === generation.current) setInitialized(true);
    })().catch(() => {
      if (active) retry = setTimeout(() => setAttempt((n) => n + 1), 60000);
    });
    return () => {
      active = false;
      generation.current++;
      clearTimeout(retry);
    };
  }, [billing.ready, billing.noAds, attempt]);
  useEffect(() => {
    if (!until) return;
    const timer = setTimeout(
      () => setUntil(0),
      Math.max(0, until - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [until]);
  return (
    <AdContext.Provider
      value={{
        allowed:
          enabled &&
          initialized &&
          foreground &&
          billing.ready &&
          !billing.noAds &&
          until <= Date.now(),
        reward: () => setUntil(Date.now() + 30 * 60000),
        privacyRequired,
        privacy,
      }}
    >
      {children}
    </AdContext.Provider>
  );
}
export function BottomBanner() {
  const { allowed } = useContext(AdContext);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!allowed) {
      setFailed(false);
      return;
    }
    if (!failed) return;
    const timer = setTimeout(() => setFailed(false), 60000);
    return () => clearTimeout(timer);
  }, [allowed, failed]);
  if (!allowed || failed || (!testAds && !units.banner)) return null;
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: "white",
        paddingVertical: 4,
      }}
      accessibilityLabel="Advertisement"
    >
      <Text style={{ fontSize: 10 }}>Advertisement</Text>
      <BannerAd
        unitId={testAds ? TestIds.BANNER : units.banner!}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdFailedToLoad={() => setFailed(true)}
      />
    </View>
  );
}
export function ReelAd() {
  const { allowed } = useContext(AdContext);
  const [ad, setAd] = useState<NativeAd | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!allowed || (!testAds && !units.native)) return;
    let active = true;
    let loaded: NativeAd | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    void NativeAd.createForAdRequest(testAds ? TestIds.NATIVE : units.native!, {
      requestNonPersonalizedAdsOnly: true,
    })
      .then((value) => {
        loaded = value;
        if (active) setAd(value);
        else {
          value.destroy();
          loaded = undefined;
        }
      })
      .catch(() => {
        if (active) retry = setTimeout(() => setAttempt((n) => n + 1), 60000);
      });
    return () => {
      active = false;
      clearTimeout(retry);
      loaded?.destroy();
      setAd(null);
    };
  }, [allowed, attempt]);
  if (!allowed || !ad) return null;
  return (
    <NativeAdView
      nativeAd={ad}
      style={{
        padding: 16,
        backgroundColor: "white",
        marginVertical: 12,
        borderRadius: 16,
      }}
    >
      <Text>Advertisement</Text>
      <NativeAsset assetType={NativeAssetType.HEADLINE}>
        <Text style={{ fontSize: 20, fontWeight: "700" }}>{ad.headline}</Text>
      </NativeAsset>
      <NativeMediaView style={{ height: 280 }} resizeMode="contain" />
      {!!ad.callToAction && (
        <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
          <Text style={{ padding: 12, color: "#5141a6" }}>
            {ad.callToAction}
          </Text>
        </NativeAsset>
      )}
    </NativeAdView>
  );
}
let fullscreenPending = false;
async function withFullscreen<T>(show: () => Promise<T>): Promise<T> {
  if (fullscreenPending) throw new Error("Another ad is loading. Please wait.");
  if (AppState.currentState !== "active")
    throw new Error("Return to the app to watch an ad.");
  fullscreenPending = true;
  try {
    return await show();
  } finally {
    fullscreenPending = false;
  }
}
function watchRewarded(signal: AbortSignal) {
  return runRewardAd(
    RewardedAd.createForAdRequest(
      testAds ? TestIds.REWARDED : units.rewarded!,
      { requestNonPersonalizedAdsOnly: true },
    ),
    {
      loaded: RewardedAdEventType.LOADED,
      earned: RewardedAdEventType.EARNED_REWARD,
      closed: AdEventType.CLOSED,
      error: AdEventType.ERROR,
    },
    signal,
  );
}
export function LessonAdOffer() {
  const { allowed, reward } = useContext(AdContext);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const controller = useRef<AbortController | null>(null);
  const progress = useRef(0);
  useEffect(() => () => controller.current?.abort(), []);
  if (!allowed || dismissed || (!testAds && !units.rewarded)) return null;
  return (
    <View
      style={{
        padding: 16,
        gap: 10,
        backgroundColor: "#edf4ff",
        borderRadius: 14,
      }}
    >
      <Text>
        Optional: watch 2 ads for 30 minutes without ads in this session. You
        can skip and watch your lesson normally.
      </Text>
      <Pressable
        disabled={busy}
        accessibilityRole="button"
        onPress={() => {
          if (controller.current) return;
          const request = new AbortController();
          controller.current = request;
          setBusy(true);
          void (async () => {
            while (progress.current < 2) {
              setNotice(`Ad ${progress.current + 1} of 2`);
              const earned = await withFullscreen(() =>
                watchRewarded(request.signal),
              );
              if (request.signal.aborted) return;
              if (!earned) {
                setNotice(
                  "Ad closed before completion. You can retry or continue your lesson.",
                );
                return;
              }
              progress.current++;
            }
            reward();
            setDismissed(true);
          })()
            .catch((e) => {
              if (!request.signal.aborted) setNotice(e.message);
            })
            .finally(() => {
              controller.current = null;
              if (!request.signal.aborted) setBusy(false);
            });
        }}
      >
        <Text>
          {busy
            ? "Watching…"
            : progress.current === 1
              ? "Watch remaining ad"
              : "Watch 2 ads"}
        </Text>
      </Pressable>
      <Pressable
        disabled={busy}
        accessibilityRole="button"
        onPress={() => setDismissed(true)}
      >
        <Text>Skip · continue lesson</Text>
      </Pressable>
      <Text accessibilityRole="alert">{notice}</Text>
    </View>
  );
}

export function OptionalInterstitial() {
  const { allowed } = useContext(AdContext);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [completed, setCompleted] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  if (!allowed || completed || (!testAds && !units.interstitial)) return null;
  return (
    <View style={{ padding: 16, gap: 10 }}>
      <Text>Optional: support Education Forum by watching an ad.</Text>
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => {
          if (controller.current) return;
          const request = new AbortController();
          controller.current = request;
          setBusy(true);
          setNotice("Loading ad...");
          void withFullscreen(async () => {
            const ad = InterstitialAd.createForAdRequest(
              testAds ? TestIds.INTERSTITIAL : units.interstitial!,
              { requestNonPersonalizedAdsOnly: true },
            );
            await runRewardAd(
              ad,
              {
                loaded: AdEventType.LOADED,
                closed: AdEventType.CLOSED,
                error: AdEventType.ERROR,
              },
              request.signal,
            );
            if (!request.signal.aborted) setCompleted(true);
          })
            .catch(() => {
              if (!request.signal.aborted)
                setNotice("Ad unavailable. You can continue or try again.");
            })
            .finally(() => {
              controller.current = null;
              if (!request.signal.aborted) setBusy(false);
            });
        }}
      >
        <Text>{busy ? "Loading ad..." : "Watch an ad"}</Text>
      </Pressable>
      <Text accessibilityRole="alert">{notice}</Text>
    </View>
  );
}

export function AdPrivacy() {
  const { privacyRequired, privacy } = useContext(AdContext);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  if (!enabled || !privacyRequired) return null;
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => {
          setBusy(true);
          setNotice("");
          void privacy()
            .catch(() =>
              setNotice("Privacy choices could not load. Please try again."),
            )
            .finally(() => setBusy(false));
        }}
      >
        <Text>
          {busy ? "Loading privacy choices..." : "Ad privacy choices"}
        </Text>
      </Pressable>
      {!!notice && <Text accessibilityRole="alert">{notice}</Text>}
    </View>
  );
}
