import React, { createContext, useContext, useEffect, useState } from "react";
import { View, Text, Pressable, Platform } from "react-native";
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
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
} from "react-native-google-mobile-ads";
import { useBilling } from "./Billing";
const enabled = process.env.EXPO_PUBLIC_ADS_ENABLED === "true";
const units = {
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
const AdContext = createContext({ allowed: false, reward: () => {} });
export function AdsProvider({ children }: { children: React.ReactNode }) {
  const billing = useBilling();
  const [initialized, setInitialized] = useState(false);
  const [until, setUntil] = useState(0);
  useEffect(() => {
    if (!enabled || !billing.ready || billing.noAds) return;
    let active = true;
    void (async () => {
      await mobileAds().setRequestConfiguration({
        maxAdContentRating: MaxAdContentRating.G,
        tagForChildDirectedTreatment: true,
        tagForUnderAgeOfConsent: true,
      });
      const consent = await AdsConsent.gatherConsent({
        tagForUnderAgeOfConsent: true,
      });
      if (!consent.canRequestAds) return;
      await mobileAds().initialize();
      if (active) setInitialized(true);
    })().catch(() => {});
    return () => {
      active = false;
    };
  }, [billing.ready, billing.noAds]);
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
          billing.ready &&
          !billing.noAds &&
          until <= Date.now(),
        reward: () => setUntil(Date.now() + 30 * 60000),
      }}
    >
      {children}
    </AdContext.Provider>
  );
}
export function BottomBanner() {
  const { allowed } = useContext(AdContext);
  const [failed, setFailed] = useState(false);
  if (!allowed || failed || (!__DEV__ && !units.banner)) return null;
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
        unitId={__DEV__ ? TestIds.BANNER : units.banner!}
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
  useEffect(() => {
    if (!allowed || (!__DEV__ && !units.native)) return;
    let active = true;
    let loaded: NativeAd | undefined;
    void NativeAd.createForAdRequest(__DEV__ ? TestIds.NATIVE : units.native!, {
      requestNonPersonalizedAdsOnly: true,
    })
      .then((value) => {
        loaded = value;
        if (active && value.mediaContent?.hasVideoContent) setAd(value);
        else value.destroy();
      })
      .catch(() => {});
    return () => {
      active = false;
      loaded?.destroy();
      setAd(null);
    };
  }, [allowed]);
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
      <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
        <Text style={{ padding: 12, color: "#5141a6" }}>{ad.callToAction}</Text>
      </NativeAsset>
    </NativeAdView>
  );
}
async function watchRewarded() {
  return new Promise<boolean>((resolve, reject) => {
    const ad = RewardedAd.createForAdRequest(
      __DEV__ ? TestIds.REWARDED : units.rewarded!,
      { requestNonPersonalizedAdsOnly: true },
    );
    let earned = false;
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      ad.removeAllListeners();
      ad.destroy();
    };
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve(earned);
    };
    const timer = setTimeout(
      () =>
        finish(new Error("Ad loading timed out. You can continue the lesson.")),
      30000,
    );
    ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      clearTimeout(timer);
      void ad
        .show()
        .catch(() => finish(new Error("Ad unavailable. Continue the lesson.")));
    });
    ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      earned = true;
    });
    ad.addAdEventListener(AdEventType.CLOSED, () => finish());
    ad.addAdEventListener(AdEventType.ERROR, () =>
      finish(new Error("Ad unavailable. Continue the lesson.")),
    );
    ad.load();
  });
}
export function LessonAdOffer() {
  const { allowed, reward } = useContext(AdContext);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  if (!allowed || dismissed || (!__DEV__ && !units.rewarded)) return null;
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
          if (busy) return;
          setBusy(true);
          void (async () => {
            setNotice("Ad 1 of 2");
            if (!(await watchRewarded())) return;
            setNotice("Ad 2 of 2");
            if (!(await watchRewarded())) return;
            reward();
            setDismissed(true);
          })()
            .catch((e) => setNotice(e.message))
            .finally(() => setBusy(false));
        }}
      >
        <Text>{busy ? "Watching…" : "Watch 2 ads"}</Text>
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
export function AdPrivacy() {
  return enabled ? (
    <Pressable
      accessibilityRole="button"
      onPress={() => void AdsConsent.showPrivacyOptionsForm().catch(() => {})}
    >
      <Text>Ad privacy choices</Text>
    </Pressable>
  ) : null;
}
