import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Platform,
  Linking,
  AppState,
} from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { backend } from "./backend";
const timeout = <T,>(promise: PromiseLike<T>, ms = 20000) =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new Error(
            "Notification setup timed out. Check your connection and retry.",
          ),
        ),
      ms,
    );
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
export async function disablePush() {
  const token = await AsyncStorage.getItem("ef-push-token");
  if (token && backend) {
    const r = await backend.rpc("unregister_push", { device_token: token });
    if (r.error) {
      if (Platform.OS !== "web")
        await Notifications.unregisterForNotificationsAsync();
      else throw r.error;
    }
  }
  await AsyncStorage.removeItem("ef-push-token");
}
export function PushSettings({ userId }: { userId?: string }) {
  const [status, setStatus] = useState(
    "Enable notifications for review decisions and private support updates.",
  );
  const [busy, setBusy] = useState(false);
  async function enable() {
    if (busy) return;
    setBusy(true);
    try {
      if (!userId || !backend) throw new Error("Sign in first.");
      if (Platform.OS === "web" || !Device.isDevice)
        throw new Error(
          "Push notifications require the installed app on a physical device.",
        );
      const projectId =
        Constants.easConfig?.projectId ||
        Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId)
        throw new Error(
          "The app's Expo project must be linked before push notifications can be enabled.",
        );
      if (Platform.OS === "android")
        await Notifications.setNotificationChannelAsync("updates", {
          name: "Education updates",
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      let permission = await Notifications.getPermissionsAsync();
      if (!permission.granted && permission.canAskAgain)
        permission = await Notifications.requestPermissionsAsync();
      if (!permission.granted)
        throw new Error(
          "Notifications are disabled. Open device settings, allow notifications, then retry.",
        );
      const token = (
        await timeout(Notifications.getExpoPushTokenAsync({ projectId }))
      ).data;
      const r = await timeout(
        backend.rpc("register_push", { device_token: token }).then((x) => x),
      );
      if (r.error)
        throw new Error(
          "Permission granted, but registration failed. Please retry.",
        );
      await AsyncStorage.setItem("ef-push-token", token);
      setStatus(
        "Device registered for notifications. Delivery depends on your connection and device settings.",
      );
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active" && Platform.OS !== "web")
        void Notifications.getPermissionsAsync()
          .then((p) => {
            if (!p.granted)
              setStatus("Notifications are disabled in device settings.");
          })
          .catch(() => {});
    });
    return () => listener.remove();
  }, []);
  return (
    <View
      style={{
        backgroundColor: "white",
        padding: 18,
        borderRadius: 16,
        gap: 12,
      }}
    >
      <Text style={{ fontSize: 20, fontWeight: "700" }}>
        Device notifications
      </Text>
      <Text accessibilityRole="alert">{status}</Text>
      <Pressable
        disabled={busy}
        accessibilityRole="button"
        onPress={() => void enable()}
      >
        <Text>{busy ? "Connecting…" : "Enable / retry notifications"}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          void Linking.openSettings().catch(() =>
            setStatus("Open this app's notification settings manually."),
          )
        }
      >
        <Text>Open device settings</Text>
      </Pressable>
      <Pressable
        disabled={busy}
        accessibilityRole="button"
        onPress={() => {
          setBusy(true);
          void disablePush()
            .then(() => setStatus("Notifications disabled for this device."))
            .catch(() =>
              setStatus("Could not unregister. Retry when connected."),
            )
            .finally(() => setBusy(false));
        }}
      >
        <Text>Disable on this device</Text>
      </Pressable>
    </View>
  );
}
