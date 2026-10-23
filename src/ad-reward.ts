// SDK-independent lifecycle so cancellation and reward delivery can be tested.
export type RewardAd = {
  addAdEventListener: (event: any, listener: () => void) => unknown;
  load: () => void;
  show: () => Promise<unknown>;
  destroy: () => void;
};
export function runRewardAd(
  ad: RewardAd,
  events: { loaded: string; earned: string; closed: string; error: string },
  signal: AbortSignal,
  timeoutMs = 30000,
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    let earned = false,
      settled = false;
    let timer: ReturnType<typeof setTimeout>;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      ad.destroy();
      if (error) reject(error);
      else resolve(earned);
    };
    const cancel = () => finish();
    if (signal.aborted) {
      finish();
      return;
    }
    signal.addEventListener("abort", cancel, { once: true });
    timer = setTimeout(
      () =>
        finish(new Error("Ad loading timed out. You can continue the lesson.")),
      timeoutMs,
    );
    try {
      ad.addAdEventListener(events.loaded, () => {
        if (settled) return;
        clearTimeout(timer);
        try {
          void ad
            .show()
            .catch(() =>
              finish(new Error("Ad unavailable. Continue the lesson.")),
            );
        } catch {
          finish(new Error("Ad unavailable. Continue the lesson."));
        }
      });
      ad.addAdEventListener(events.earned, () => {
        earned = true;
      });
      ad.addAdEventListener(events.closed, () => finish());
      ad.addAdEventListener(events.error, () =>
        finish(new Error("Ad unavailable. Continue the lesson.")),
      );
      ad.load();
    } catch {
      finish(new Error("Ad unavailable. Continue the lesson."));
    }
  });
}
