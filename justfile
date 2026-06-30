# FilePath: justfile

# justfile — local ZMK firmware builds. Run `just` to list recipes.

# List available recipes
default:
    @just --list

# Build firmware (default: all), verify keymap-viewer.html sync, then regenerate corne_keymap.svg.
# e.g. `just build` or `just build left right`
# Targets: left right left_view right_view reset
build *targets:
    bash build.sh {{targets}}
    if command -v keymap >/dev/null 2>&1; then \
      if command -v node >/dev/null 2>&1; then node scripts/check-viewer-sync.js || echo "==> keymap-viewer.html is OUT OF SYNC with config/corne.keymap (see above); update it per AGENTS.md"; else echo "==> node not installed; skipping keymap-viewer.html sync check"; fi; \
      make -B svg || echo "==> SVG generation failed (see above); firmware is fine"; \
    else echo "==> keymap-drawer not installed; run: pipx install --python python3.12 keymap-drawer==0.23.0"; fi

# Flash the newest built .uf2 onto a mounted NICENANO bootloader drive.
# Double-tap the reset button on the half first so it mounts as /Volumes/NICENANO.
# e.g. `just flash left` or `just flash right`
# Targets: left right left_view right_view reset
flash target:
    bash flash.sh {{target}}

# Check keymap-viewer.html is structurally in sync with config/corne.keymap
check:
    node scripts/check-viewer-sync.js

# Regenerate the keymap-viewer.html `layers` data block from config/corne.keymap
html:
    node scripts/gen-viewer.js

# Regenerate corne_keymap.svg from config/corne.keymap (requires keymap-drawer: make install)
svg:
    make svg

# Remove the local west workspace and build cache (keeps firmware/)
clean:
    rm -rf zmk zephyr modules tools bootloader .west build
