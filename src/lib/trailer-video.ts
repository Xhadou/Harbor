const IDLE_RELEASE_MS = 60000;

/**
 * A page's trailer and a card's preview are two different pictures on screen at
 * once, so each has its own video element. Within a channel the element is
 * still shared: one hero trailer, one card preview, never more.
 */
export type TrailerChannel = "page" | "card";

type Pool = {
  element: HTMLVideoElement | null;
  owner: object | null;
  releaseTimer: number | null;
};

const pools: Record<TrailerChannel, Pool> = {
  page: { element: null, owner: null, releaseTimer: null },
  card: { element: null, owner: null, releaseTimer: null },
};
let park: HTMLElement | null = null;

function parkNode(): HTMLElement {
  if (park && park.isConnected) return park;
  const node = document.createElement("div");
  node.setAttribute("aria-hidden", "true");
  node.style.cssText =
    "position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;pointer-events:none";
  document.body.appendChild(node);
  park = node;
  return node;
}

function node(pool: Pool): HTMLVideoElement {
  if (pool.element) return pool.element;
  const video = document.createElement("video");
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = "none";
  pool.element = video;
  parkNode().appendChild(video);
  return video;
}

function cancelRelease(pool: Pool): void {
  if (pool.releaseTimer === null) return;
  window.clearTimeout(pool.releaseTimer);
  pool.releaseTimer = null;
}

function scheduleRelease(pool: Pool): void {
  cancelRelease(pool);
  pool.releaseTimer = window.setTimeout(() => {
    pool.releaseTimer = null;
    if (pool.owner || !pool.element || !pool.element.getAttribute("src")) return;
    try {
      pool.element.removeAttribute("src");
      pool.element.load();
    } catch {
      void 0;
    }
  }, IDLE_RELEASE_MS);
}

function poolHeldBy(token: object): Pool | null {
  if (pools.page.owner === token) return pools.page;
  if (pools.card.owner === token) return pools.card;
  return null;
}

export function claimTrailerVideo(
  token: object,
  mount: HTMLElement,
  channel: TrailerChannel = "page",
): HTMLVideoElement {
  const pool = pools[channel];
  cancelRelease(pool);
  pool.owner = token;
  const video = node(pool);
  video.pause();
  video.style.opacity = "";
  if (video.parentElement !== mount) mount.appendChild(video);
  return video;
}

export function releaseTrailerVideo(token: object): void {
  const pool = poolHeldBy(token);
  if (!pool) return;
  pool.owner = null;
  const video = pool.element;
  if (!video) return;
  try {
    video.pause();
  } catch {
    void 0;
  }
  video.style.opacity = "0";
  parkNode().appendChild(video);
  scheduleRelease(pool);
}

export function trailerVideoHeldBy(token: object): boolean {
  return poolHeldBy(token) !== null;
}
