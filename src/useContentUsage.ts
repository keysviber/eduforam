import { useEffect } from "react";
import { AppState } from "react-native";
import { backend } from "./backend";
// Activity is pending evidence. Only server-side review can credit the ledger.
export function useContentUsage(
  entryId?: string,
  userId?: string,
  active = true,
) {
  useEffect(() => {
    if (!backend || !entryId || !userId || !active) return;
    let alive = true;
    let usage: string | null = null;
    let pending = false;
    void backend
      .rpc("begin_content_usage", { content_id: entryId })
      .then(({ data, error }) => {
        if (alive && !error) usage = data;
      });
    const timer = setInterval(() => {
      if (
        !alive ||
        !usage ||
        pending ||
        AppState.currentState !== "active" ||
        (typeof document !== "undefined" &&
          document.visibilityState !== "visible")
      )
        return;
      pending = true;
      void backend!
        .rpc("heartbeat_content_usage", { usage_id: usage })
        .then(() => {
          pending = false;
        });
    }, 10000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [entryId, userId, active]);
}
