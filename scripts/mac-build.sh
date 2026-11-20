#!/bin/sh
# Builds Harbor.app for the Mac this runs on.
#
# The release pipeline in .github/workflows/tauri-build.yml builds for every Mac
# back to macOS 15, which needs an mpv built against an old SDK. This script is
# the local shortcut: it links whatever mpv Homebrew installed here, so the app
# it produces is only promised to run on this macOS version or newer.
#
# Needs: pnpm, the Rust toolchain, and `brew install mpv pkgconf`.
# To sign with your own certificate instead of an ad-hoc signature:
#   APPLE_SIGNING_IDENTITY="Apple Development: Your Name (TEAMID)" sh scripts/mac-build.sh
set -eu
cd "$(dirname "$0")/.."

TARGET="$(rustc -vV | sed -n 's/^host: //p')"
FRAMEWORKS="$PWD/src-tauri/target/mac-frameworks"
HOST_OS="$(sw_vers -productVersion | cut -d. -f1).0"

# Homebrew's mpv targets the installed macOS, above the ceiling a public
# release accepts. Lifting it is only right for a build that stays on this Mac.
export HARBOR_MACOS_MINIMUM_CEILING=99

rm -rf "$FRAMEWORKS"
# The end of this script leaves the mpv sidecar as a link to the installed mpv
# (that is what `pnpm tauri dev` needs). Staging copies mpv onto that path and
# refuses to copy a file onto itself, so drop the link first.
MPV_SIDECAR="src-tauri/binaries/mpv-$TARGET"
if [ -L "$MPV_SIDECAR" ]; then unlink "$MPV_SIDECAR"; fi
python3 scripts/macos-bundle-libmpv.py prepare \
  --frameworks "$FRAMEWORKS" \
  --config "$FRAMEWORKS/tauri-libmpv.json" \
  --target "$TARGET"

# The fetched sidecars and the staged Java runtime contain read-only files. The
# build copies them next to the binary and cannot overwrite its own earlier
# copies, and the bundler stops at the first one when it clears extended
# attributes. Make the sources and any earlier copies writable.
# A sidecar that is a link to a Homebrew binary is copied read-only as well;
# turn it into a writable copy of its own.
for bin in src-tauri/binaries/*-"$TARGET"; do
  if [ -L "$bin" ]; then
    cp -L "$bin" "$bin.copy" && chmod u+wx "$bin.copy" && mv -f "$bin.copy" "$bin"
  fi
done
OUT="src-tauri/target/$TARGET/release"
chmod -R u+w src-tauri/binaries src-tauri/resources/capstan "$OUT/resources" 2>/dev/null || true
find "$OUT" -maxdepth 1 -type f ! -perm -u+w -exec chmod u+w {} + 2>/dev/null || true
rm -rf "$OUT/bundle/macos"

export HARBOR_MACOS_FRAMEWORKS_DIR="$FRAMEWORKS"
export HARBOR_MACOS_LIB_DIR="$FRAMEWORKS/link"

# The second config lowers the advertised minimum to this Mac's own release, so
# the app opens here even when a library was built against a newer point SDK.
pnpm tauri build --bundles app --target "$TARGET" \
  --config "$FRAMEWORKS/tauri-libmpv.json" \
  --config "{\"bundle\":{\"macOS\":{\"minimumSystemVersion\":\"$HOST_OS\"}}}"

# Staging rewrote the mpv sidecar to load its libraries from inside the bundle,
# which `pnpm tauri dev` cannot use. Point it back at the installed mpv.
if command -v mpv >/dev/null 2>&1; then
  ln -sf "$(command -v mpv)" "src-tauri/binaries/mpv-$TARGET"
fi

echo "Built src-tauri/target/$TARGET/release/bundle/macos/Harbor.app"
