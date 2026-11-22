import type { AnimationItem } from "lottie-web";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { useSettings } from "@/lib/settings";
import { loadLottie } from "@/lib/lottie-lazy";

export function NavLottie({
  data,
  hovered,
  fallback,
  loop = false,
}: {
  /** The animation, or a function that fetches it when the icon is first played. */
  data: object | (() => Promise<object>);
  hovered?: boolean;
  fallback: ReactNode;
  loop?: boolean;
}) {
  const host = useRef<HTMLSpanElement | null>(null);
  const anim = useRef<AnimationItem | null>(null);
  const { settings } = useSettings();
  const reduce = useReducedMotion() || !settings.navIconAnimations;
  const [ready, setReady] = useState(false);
  const play = !reduce && !!hovered;

  useEffect(() => {
    if (!play || reduce || anim.current) return;
    const el = host.current;
    if (!el) return;
    let cancelled = false;
    const source = typeof data === "function" ? data() : data;
    void Promise.all([loadLottie(), source]).then(([lottie, animationData]) => {
      if (cancelled || anim.current || !el.isConnected) return;
      const a = lottie.loadAnimation({
        container: el,
        renderer: "svg",
        loop,
        autoplay: true,
        animationData,
        rendererSettings: {
          progressiveLoad: false,
          hideOnTransparent: true,
          preserveAspectRatio: "xMidYMid meet",
        },
      });
      anim.current = a;
      a.addEventListener("DOMLoaded", () => {
        if (anim.current === a) setReady(true);
      });
      if (a.isLoaded) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [play, reduce, data, loop]);

  useEffect(() => {
    const a = anim.current;
    if (!a) return;
    a.loop = loop;
    if (play) a.goToAndPlay(0, true);
    else a.goToAndStop(0, true);
  }, [play, loop]);

  useEffect(
    () => () => {
      const a = anim.current;
      anim.current = null;
      setReady(false);
      a?.destroy();
    },
    [data, reduce],
  );

  if (reduce) return <>{fallback}</>;

  const showAnim = play && ready;

  return (
    <span className="relative inline-flex leading-none">
      <span className={`inline-flex leading-none ${showAnim ? "invisible" : ""}`}>{fallback}</span>
      <span
        ref={host}
        aria-hidden
        className="harbor-nav-lottie absolute inset-[2px]"
        style={{ visibility: showAnim ? "visible" : "hidden" }}
      />
    </span>
  );
}
