// Shared argument policy for the Harbor Tauri launcher.
// Keep non-Windows and non-desktop commands exactly as the user entered them.
export function shouldEnableWindowsWhisper(platform, args) {
  const command = args[0];
  return (
    platform === "win32" &&
    (command === "dev" || command === "build") &&
    !args.includes("-h") &&
    !args.includes("--help") &&
    !args.includes("--version")
  );
}

export function addWhisperFeature(args) {
  const result = [...args];
  const divider = result.indexOf("--");
  const end = divider < 0 ? result.length : divider;
  for (let i = 0; i < end; i += 1) {
    const token = result[i];
    if (token === "--features" || token === "-f") {
      const value = result[i + 1];
      if (value === undefined || value.startsWith("-")) {
        result.splice(i + 1, 0, "asr-whisper");
      } else if (!value.split(/[\s,]+/).includes("asr-whisper")) {
        result[i + 1] = value + ",asr-whisper";
      }
      return result;
    }
    if (token.startsWith("--features=") || token.startsWith("-f=")) {
      const eq = token.indexOf("=");
      const value = token.slice(eq + 1);
      if (!value.split(/[\s,]+/).includes("asr-whisper")) {
        result[i] = token + (value ? ",asr-whisper" : "asr-whisper");
      }
      return result;
    }
  }
  result.splice(end, 0, "--features", "asr-whisper");
  return result;
}

// The Mac edition leaves Games and Music out of the native side as well as the
// frontend (vite.config.ts reads the same HARBOR_EDITION). Plugins stay.
export function shouldBuildMacEdition(platform, args, env) {
  const command = args[0];
  return (
    platform === "darwin" &&
    env.HARBOR_EDITION !== "full" &&
    (command === "dev" || command === "build") &&
    !args.includes("-h") &&
    !args.includes("--help") &&
    !args.includes("--version")
  );
}

// Cargo's own flags go after the `--` that ends the Tauri options.
export function addMacEditionArgs(args) {
  const cargo = ["--no-default-features", "--features", "plugins"];
  const divider = args.indexOf("--");
  if (divider < 0) return [...args, "--", ...cargo];
  return [...args.slice(0, divider + 1), ...cargo, ...args.slice(divider + 1)];
}
