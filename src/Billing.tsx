import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Platform, View, Text, Pressable } from "react-native";
import Purchases from "react-native-purchases";
import { backend } from "./backend";
const key =
  Platform.OS === "ios"
    ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
    : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
let configured = false;
let currentUser: string | undefined;
let queue = Promise.resolve();
async function withIdentity<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const task = queue.then(async () => {
    if (!key || Platform.OS === "web")
      throw new Error("Store purchases are not configured on this device.");
    if (!configured) {
      Purchases.configure({ apiKey: key, appUserID: id });
      configured = true;
      currentUser = id;
    } else if (currentUser !== id) {
      await Purchases.logIn(id);
      currentUser = id;
    }
    return fn();
  });
  queue = task.then(
    () => {},
    () => {},
  );
  return task;
}
type Billing = {
  ready: boolean;
  noAds: boolean;
  refresh: () => Promise<void>;
  purchase: (product: string) => Promise<void>;
  restore: () => Promise<void>;
  price: (product: string) => Promise<string>;
};
const Context = createContext<Billing>({
  ready: false,
  noAds: false,
  refresh: async () => {},
  purchase: async () => {
    throw new Error("Sign in first");
  },
  restore: async () => {},
  price: async () => "",
});
export const useBilling = () => useContext(Context);
export function BillingProvider({
  userId,
  children,
}: {
  userId?: string;
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [noAds, setNoAds] = useState(false);
  const generation = useRef(0);
  async function refresh() {
    const version = generation.current;
    if (!backend || !userId) {
      setNoAds(false);
      setReady(true);
      return;
    }
    const r = await backend
      .from("purchase_access")
      .select("product_id,expires_at")
      .eq("user_id", userId);
    if (r.error)
      throw new Error(
        "Could not verify purchase access. Retry from your account.",
      );
    if (version === generation.current) {
      setNoAds(
        (r.data || []).some(
          (x) => !x.expires_at || Date.parse(x.expires_at) > Date.now(),
        ),
      );
      setReady(true);
    }
  }
  async function sync() {
    if (!backend) throw new Error("Account service unavailable");
    const r = await backend.functions.invoke("purchase-sync");
    if (r.error || r.data?.error)
      throw new Error(
        "Payment verification is pending. Use Restore purchases to retry; do not purchase again.",
      );
    await refresh();
  }
  useEffect(() => {
    generation.current++;
    setReady(false);
    setNoAds(false);
    void refresh().catch(() => {});
    return () => {
      generation.current++;
    };
  }, [userId]);
  const value: Billing = {
    ready,
    noAds,
    refresh,
    price: async (product) => {
      if (!userId) throw new Error("Sign in to see store pricing.");
      return withIdentity(userId, async () => {
        const list = await Purchases.getProducts([product]);
        if (!list[0])
          throw new Error("This product is not available in your store yet.");
        return list[0].priceString;
      });
    },
    purchase: async (product) => {
      if (!userId) throw new Error("Sign in before purchasing.");
      await withIdentity(userId, async () => {
        const list = await Purchases.getProducts([product]);
        if (!list[0])
          throw new Error("This product is not available in your store yet.");
        await Purchases.purchaseStoreProduct(list[0]);
        await sync();
      });
    },
    restore: async () => {
      if (!userId) throw new Error("Sign in before restoring.");
      await withIdentity(userId, async () => {
        await Purchases.restorePurchases();
        await sync();
      });
    },
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function PurchaseSettings({ userId }: { userId?: string }) {
  const billing = useBilling();
  const [price, setPrice] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function act(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setNotice((e as Error).message || "Purchase cancelled or unavailable.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let active = true;
    setPrice("");
    if (userId && key && Platform.OS !== "web")
      void billing
        .price(process.env.EXPO_PUBLIC_REMOVE_ADS_PRODUCT || "remove_ads")
        .then((v) => {
          if (active) setPrice(v);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [userId]);
  return (
    <View
      style={{
        padding: 18,
        gap: 12,
        backgroundColor: "white",
        borderRadius: 16,
      }}
    >
      <Text style={{ fontSize: 20, fontWeight: "700" }}>Purchases & ads</Text>
      <Text>
        {billing.noAds
          ? "Ads removed by your verified purchase."
          : "Any verified app purchase removes ads. Remove-ads target price: US$1; your store sets the local price."}
      </Text>
      {!userId && <Text>Sign in to purchase or restore.</Text>}
      {!price && !billing.noAds && (
        <Text>Store pricing is not available yet.</Text>
      )}
      {!!price && !billing.noAds && (
        <Pressable
          disabled={busy}
          accessibilityRole="button"
          onPress={() =>
            void act(async () => {
              await billing.purchase(
                process.env.EXPO_PUBLIC_REMOVE_ADS_PRODUCT || "remove_ads",
              );
              setNotice("Purchase verified. Ads removed.");
            })
          }
        >
          <Text>Remove ads · {price}</Text>
        </Pressable>
      )}
      <Pressable
        disabled={busy || !userId}
        accessibilityRole="button"
        onPress={() =>
          void act(async () => {
            await billing.restore();
            setNotice("Store purchases checked and access refreshed.");
          })
        }
      >
        <Text>{busy ? "Please wait…" : "Restore purchases"}</Text>
      </Pressable>
      <Text accessibilityRole="alert">{notice}</Text>
    </View>
  );
}
