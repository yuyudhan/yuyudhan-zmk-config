# FilePath: flash.sh

#!/usr/bin/env bash
# flash.sh — engine for `just flash`. Copies a built .uf2 from the newest
# firmware/<keymap>/<stamp>/ directory onto a mounted NICENANO bootloader drive.
# Invoked by the justfile; may also be run directly: `bash flash.sh <keymap> <target>`.
# Targets: left right left_view right_view reset
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VOLUME="/Volumes/NICENANO"

keymap="${1:-}"
target="${2:-}"
if [ -z "$keymap" ] || [ -z "$target" ]; then
  echo "Usage: just flash <keymap> <target>  (targets: left right left_view right_view reset)" >&2
  exit 1
fi
case "$target" in
  left)       out="corne_left" ;;
  right)      out="corne_right" ;;
  left_view)  out="corne_left_nice_view" ;;
  right_view) out="corne_right_nice_view" ;;
  reset)      out="settings_reset" ;;
  *)
    echo "Unknown target: $target  (valid: left right left_view right_view reset)" >&2
    exit 1 ;;
esac

# Newest matching .uf2 for THIS keymap by mtime (skips empty/older build dirs automatically).
file="$(ls -1t "$REPO_DIR"/firmware/"$keymap"/*/"$out.uf2" 2>/dev/null | head -1 || true)"
if [ -z "$file" ]; then
  echo "No $out.uf2 found under firmware/$keymap/. Build it first: just build $keymap $target" >&2
  exit 1
fi

if [ ! -d "$VOLUME" ]; then
  echo "$VOLUME not mounted. Double-tap the reset button on the half you want to flash, then re-run." >&2
  exit 1
fi

echo "==> Flashing $file -> $VOLUME"
if cp "$file" "$VOLUME"/ 2>/dev/null; then
  echo "==> Done. The nice!nano will reboot automatically."
else
  echo "==> cp reported an error — normal: the nice!nano reboots and unmounts mid-write. Flash succeeded."
fi
