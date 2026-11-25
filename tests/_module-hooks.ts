// @ts-expect-error Node test types are outside the browser tsconfig.
import { readFileSync } from "node:fs";

type LoadResult = { format?: string | null; source?: unknown; shortCircuit?: boolean };
type NextLoad = (url: string, context: unknown) => LoadResult;

/**
 * Hands a module on from a synchronous `registerHooks` load hook. On Node 22 the
 * default step gives a CommonJS file (React's entry, for one) a `null` source and
 * then rejects that same result, so every test that registered a hook failed before
 * running there. The file is read here instead and handed on as CommonJS.
 */
export function passThrough(url: string, context: unknown, nextLoad: NextLoad): LoadResult {
  try {
    return nextLoad(url, context);
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code !== "ERR_INVALID_RETURN_PROPERTY_VALUE" || !url.startsWith("file:")) throw error;
    return { format: "commonjs", source: readFileSync(new URL(url), "utf8"), shortCircuit: true };
  }
}
