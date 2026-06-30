# FilePath: justfile

# justfile — local ZMK firmware builds. Run `just` to list recipes.

# List available recipes
default:
    @just --list

# Build firmware for a keymap (default yuyudhan-1, default all targets), verify that
# keymap's viewer sync, then regenerate its SVG.
# e.g. `just build`  |  `just build yuyudhan-2`  |  `just build yuyudhan-2 left right`
# Targets: left right left_view right_view reset
build keymap="yuyudhan-1" *targets:
    bash build.sh {{keymap}} {{targets}}
    if command -v keymap >/dev/null 2>&1; then \
      if command -v node >/dev/null 2>&1; then node scripts/check-viewer-sync.js {{keymap}} || echo "==> {{keymap}}-viewer.html is OUT OF SYNC with config/{{keymap}}.keymap (see above); update it per AGENTS.md"; else echo "==> node not installed; skipping viewer sync check"; fi; \
      make -B svg KEYMAP=config/{{keymap}}.keymap || echo "==> SVG generation failed (see above); firmware is fine"; \
    else echo "==> keymap-drawer not installed; run: pipx install --python python3.12 keymap-drawer==0.23.0"; fi
    dest="$(ls -1td firmware/{{keymap}}/*/ 2>/dev/null | head -1)"; \
    if [ -z "$dest" ]; then echo "==> no firmware dir for {{keymap}} (build produced none); skipped visual snapshot"; else \
      if [ -f {{keymap}}_keymap.svg ]; then cp {{keymap}}_keymap.svg "$dest"; echo "==> snapshot SVG    -> $dest{{keymap}}_keymap.svg"; fi; \
      if [ -f {{keymap}}-viewer.html ]; then cp {{keymap}}-viewer.html "$dest"; echo "==> snapshot viewer -> $dest{{keymap}}-viewer.html"; fi; \
    fi

# Flash the newest built .uf2 for a keymap onto a mounted NICENANO bootloader drive.
# Double-tap the reset button on the half first so it mounts as /Volumes/NICENANO.
# e.g. `just flash yuyudhan-1 left`   (both args required — flashing is destructive)
# Targets: left right left_view right_view reset
flash keymap target:
    bash flash.sh {{keymap}} {{target}}

# Check a keymap's viewer HTML is structurally in sync with its keymap (default yuyudhan-1)
check keymap="yuyudhan-1":
    node scripts/check-viewer-sync.js {{keymap}}

# Regenerate a keymap's viewer `layers` data block (default yuyudhan-1)
html keymap="yuyudhan-1":
    node scripts/gen-viewer.js {{keymap}}

# Regenerate a keymap's SVG (default yuyudhan-1; requires keymap-drawer: make install)
svg keymap="yuyudhan-1":
    make svg KEYMAP=config/{{keymap}}.keymap

# Remove the local west workspace and build cache (keeps firmware/)
clean:
    rm -rf zmk zephyr modules tools bootloader .west build
