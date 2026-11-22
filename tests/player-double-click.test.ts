import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement } from "react";
import { JSDOM } from "jsdom";
import { CLICK_WAIT_MS, DragClickStage } from "../src/views/player/drag-click-stage.tsx";

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function mountStage() {
  const dom = new JSDOM("<!doctype html><div id='root'></div>");
  const win = dom.window as unknown as Window & typeof globalThis;
  Object.assign(globalThis, {
    window: win,
    document: win.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const did: string[] = [];
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(win.document.getElementById("root")!);
  await act(() =>
    root.render(
      createElement(DragClickStage, {
        drawMode: false,
        pipMode: false,
        onClick: () => did.push("play-pause"),
        onDoubleClick: () => did.push("full-screen"),
      }),
    ),
  );
  const stage = win.document.querySelector("[data-player-click-stage]") as HTMLElement;
  // One press and release, numbered the way the browser numbers the clicks of a double click.
  const click = async (count: number) => {
    await act(() => {
      stage.dispatchEvent(
        new win.MouseEvent("mousedown", { bubbles: true, button: 0, detail: count }),
      );
      stage.dispatchEvent(
        new win.MouseEvent("mouseup", { bubbles: true, button: 0, detail: count }),
      );
      if (count === 2)
        stage.dispatchEvent(
          new win.MouseEvent("dblclick", { bubbles: true, button: 0, detail: 2 }),
        );
    });
  };
  const wait = async (ms: number) => {
    await act(async () => {
      await sleep(ms);
    });
  };
  return {
    did,
    click,
    wait,
    async unmount() {
      await act(() => root.unmount());
      dom.window.close();
    },
  };
}

test("a double click toggles full screen and never plays or pauses", async () => {
  const view = await mountStage();
  try {
    await view.click(1);
    await view.wait(60);
    await view.click(2);
    await view.wait(CLICK_WAIT_MS + 80);
    assert.deepEqual(view.did, ["full-screen"]);
  } finally {
    await view.unmount();
  }
});

test("a single click plays or pauses once the moment for a second click has passed", async () => {
  const view = await mountStage();
  try {
    await view.click(1);
    assert.deepEqual(view.did, [], "it waits to see whether a second click follows");
    await view.wait(CLICK_WAIT_MS + 80);
    assert.deepEqual(view.did, ["play-pause"]);
  } finally {
    await view.unmount();
  }
});

test("a slow double click takes back what its first click did", async () => {
  const view = await mountStage();
  try {
    await view.click(1);
    await view.wait(CLICK_WAIT_MS + 60);
    assert.deepEqual(view.did, ["play-pause"]);
    await view.click(2);
    await view.wait(CLICK_WAIT_MS + 80);
    assert.deepEqual(view.did, ["play-pause", "play-pause", "full-screen"]);
  } finally {
    await view.unmount();
  }
});

test("a click that is still waiting is dropped when the player goes away", async () => {
  const view = await mountStage();
  await view.click(1);
  await view.unmount();
  await sleep(CLICK_WAIT_MS + 80);
  assert.deepEqual(view.did, []);
});
