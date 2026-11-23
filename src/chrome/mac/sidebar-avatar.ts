import { useEffect, useState } from "react";
import stremioDefaultAvatar from "@/assets/stremio-default-avatar.png";

/** The sidebar's 26 pt circle, drawn at 3× so it stays sharp on any display. */
const PIXELS = 78;

const drawn = new Map<string, Promise<string | null>>();

function crossOrigin(url: URL): boolean {
  return url.origin !== window.location.origin;
}

function loadImage(url: URL): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Without this a remote picture would taint the canvas and could not be read back.
    if (crossOrigin(url)) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("avatar did not load"));
    img.src = url.href;
  });
}

/**
 * The picture as a PNG data URL, cropped to a square like `object-cover`.
 * The release build serves its files from a scheme Swift cannot fetch, so the
 * page hands over pixels rather than a path. A remote picture whose server
 * refuses to share its pixels is handed over as its address instead.
 */
async function rasterize(src: string): Promise<string | null> {
  const url = new URL(src, window.location.href);
  let img: HTMLImageElement;
  try {
    img = await loadImage(url);
  } catch {
    if (crossOrigin(url) && /^https?:$/.test(url.protocol)) return url.href;
    // The account menu shows the default picture when an avatar fails to load.
    return src === stremioDefaultAvatar ? null : rasterize(stremioDefaultAvatar);
  }
  const canvas = document.createElement("canvas");
  canvas.width = PIXELS;
  canvas.height = PIXELS;
  const context = canvas.getContext("2d");
  if (!context) return null;
  const width = img.naturalWidth || PIXELS;
  const height = img.naturalHeight || PIXELS;
  const scale = Math.max(PIXELS / width, PIXELS / height);
  context.imageSmoothingQuality = "high";
  context.drawImage(
    img,
    (PIXELS - width * scale) / 2,
    (PIXELS - height * scale) / 2,
    width * scale,
    height * scale,
  );
  try {
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

/** The account picture for the native sidebar; null for the default picture or while it is drawn. */
export function useSidebarAvatarImage(src: string | null): string | null {
  const wanted = src ?? stremioDefaultAvatar;
  const [result, setResult] = useState<{ src: string; image: string | null } | null>(null);
  useEffect(() => {
    let live = true;
    let pending = drawn.get(wanted);
    if (!pending) {
      pending = rasterize(wanted);
      drawn.set(wanted, pending);
    }
    void pending.then((image) => {
      if (live) setResult({ src: wanted, image });
    });
    return () => {
      live = false;
    };
  }, [wanted]);
  return result?.src === wanted ? result.image : null;
}
