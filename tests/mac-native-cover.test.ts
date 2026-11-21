// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

import {
  nativeChromeCovered,
  setNativeChromeCovered,
  subscribeNativeChromeCovered,
} from "../src/chrome/mac/native-chrome-cover";

test("native chrome is covered while any full-window layer says so", () => {
  assert.equal(nativeChromeCovered(), false);
  setNativeChromeCovered("onboarding", true);
  setNativeChromeCovered("other", true);
  assert.equal(nativeChromeCovered(), true);
  setNativeChromeCovered("onboarding", false);
  assert.equal(nativeChromeCovered(), true);
  setNativeChromeCovered("other", false);
  assert.equal(nativeChromeCovered(), false);
});

test("listeners hear only real changes, until they unsubscribe", () => {
  let calls = 0;
  const stop = subscribeNativeChromeCovered(() => calls++);
  setNativeChromeCovered("onboarding", true);
  setNativeChromeCovered("onboarding", true);
  setNativeChromeCovered("other", true);
  setNativeChromeCovered("onboarding", false);
  setNativeChromeCovered("other", false);
  stop();
  setNativeChromeCovered("onboarding", true);
  setNativeChromeCovered("onboarding", false);
  assert.equal(calls, 2);
});
