import {
  createElement,
  lazy,
  useState,
  type ComponentProps,
  type ComponentType,
  type FunctionComponent,
} from "react";

const RETRY_DELAYS_MS = [400, 1200];

// oxlint-disable-next-line @typescript-eslint/no-explicit-any
export type LazyView<T extends ComponentType<any>> = FunctionComponent<ComponentProps<T>> & {
  /** Fetches the view's module ahead of its first render. Safe to call more than once. */
  preload: () => Promise<void>;
};

/**
 * React caches a lazy import's rejection forever, so a route that lost a single fetch never loads
 * again until the page is reloaded. A dev rebuild or a fresh release both drop module URLs a
 * mounted page is still holding, which makes that one lost fetch ordinary rather than rare.
 *
 * A view whose module has already arrived is rendered directly instead of through `lazy`. `lazy`
 * suspends on its first render even when the import settled long ago; the boundary's fallback is
 * committed, and React then holds the real content back for its 300 ms fallback throttle. A
 * preloaded page opened for the first time therefore sat blank for a third of a second.
 */
// oxlint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyView<T extends ComponentType<any>>(
  load: () => Promise<{ default: T }>,
): LazyView<T> {
  let ready: T | null = null;
  let pending: Promise<{ default: T }> | null = null;

  const loadWithRetry = async () => {
    let failure: unknown;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      if (attempt > 0)
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt - 1]));
      try {
        return await load();
      } catch (error) {
        failure = error;
      }
    }
    throw failure;
  };

  const loadOnce = () => {
    pending ??= loadWithRetry().then(
      (module) => {
        ready = module.default;
        return module;
      },
      (error: unknown) => {
        // A later preload may try again; `lazy` itself keeps the failure it was handed.
        pending = null;
        throw error;
      },
    );
    return pending;
  };

  const Suspending = lazy(loadOnce);

  const View = (props: ComponentProps<T>) => {
    // Chosen once per mount: a view that began by suspending keeps its element type when the
    // module arrives, so it is not unmounted and mounted again.
    const [Direct] = useState(() => ready);
    return createElement(Direct ?? Suspending, props);
  };

  return Object.assign(View, {
    preload: () =>
      loadOnce().then(
        () => undefined,
        () => undefined,
      ),
  });
}
