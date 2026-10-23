import { test } from "node:test";
import assert from "node:assert/strict";
import { runRewardAd } from "../src/ad-reward.ts";
const events = {
  loaded: "loaded",
  earned: "earned",
  closed: "closed",
  error: "error",
};
function fake() {
  const listeners = new Map<string, () => void>();
  return {
    destroyed: 0,
    shown: 0,
    addAdEventListener: (event: string, fn: () => void) =>
      listeners.set(event, fn),
    load() {},
    async show() {
      this.shown++;
    },
    destroy() {
      this.destroyed++;
    },
    emit(event: string) {
      listeners.get(event)?.();
    },
  };
}
test("reward requires earned event, not just closing an ad", async () => {
  for (const earned of [true, false]) {
    const ad = fake();
    const task = runRewardAd(ad, events, new AbortController().signal);
    ad.emit("loaded");
    if (earned) ad.emit("earned");
    ad.emit("closed");
    ad.emit("error");
    assert.equal(await task, earned);
    assert.equal(ad.shown, 1);
    assert.equal(ad.destroyed, 1);
  }
});
test("unmount cancellation destroys ad and prevents late display", async () => {
  const ad = fake(),
    controller = new AbortController();
  const task = runRewardAd(ad, events, controller.signal);
  controller.abort();
  ad.emit("loaded");
  assert.equal(await task, false);
  assert.equal(ad.shown, 0);
  assert.equal(ad.destroyed, 1);
});
test("load timeout cleans up", async () => {
  const ad = fake();
  await assert.rejects(
    runRewardAd(ad, events, new AbortController().signal, 5),
    /timed out/,
  );
  assert.equal(ad.destroyed, 1);
});
test("synchronous load and asynchronous show errors clean up", async () => {
  const ad = fake();
  ad.load = () => {
    throw new Error("offline");
  };
  await assert.rejects(
    runRewardAd(ad, events, new AbortController().signal),
    /unavailable/,
  );
  assert.equal(ad.destroyed, 1);
  const second = fake();
  second.show = async () => {
    throw new Error("not ready");
  };
  const task = runRewardAd(second, events, new AbortController().signal);
  second.emit("loaded");
  await assert.rejects(task, /unavailable/);
  assert.equal(second.destroyed, 1);
});

// Duplicate SDK load callbacks must never present the same ad twice.
test("duplicate load events show only once", async () => {
  const ad = fake();
  const task = runRewardAd(ad, events, new AbortController().signal);
  ad.emit("loaded");
  ad.emit("loaded");
  ad.emit("closed");
  assert.equal(await task, false);
  assert.equal(ad.shown, 1);
});
test("interstitial closes without granting a reward", async () => {
  const ad = fake();
  const task = runRewardAd(
    ad,
    { loaded: "loaded", closed: "closed", error: "error" },
    new AbortController().signal,
  );
  ad.emit("loaded");
  ad.emit("closed");
  assert.equal(await task, false);
  assert.equal(ad.destroyed, 1);
});
test("reward event before presentation does not grant credit", async () => {
  const ad = fake();
  const task = runRewardAd(ad, events, new AbortController().signal);
  ad.emit("earned");
  ad.emit("loaded");
  ad.emit("closed");
  assert.equal(await task, false);
});
