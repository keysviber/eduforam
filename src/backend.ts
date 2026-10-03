import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, processLock } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (process.env.EXPO_PUBLIC_APP_ENV === "production" && (!url || !key)) {
  throw new Error("Production backend configuration is missing.");
}
export const backend =
  url && key
    ? createClient(url, key, {
        auth: {
          storage: AsyncStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: Platform.OS === "web",
          lock: processLock,
        },
      })
    : null;

// Native token refresh follows the application lifecycle, not a browser tab.
if (backend && Platform.OS !== "web") {
  if (AppState.currentState === "active") backend.auth.startAutoRefresh();
  AppState.addEventListener("change", (state) => {
    if (state === "active") backend.auth.startAutoRefresh();
    else backend.auth.stopAutoRefresh();
  });
}
