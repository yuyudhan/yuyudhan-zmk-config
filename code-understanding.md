<!-- FilePath: code-understanding.md -->

# ZMK Config — Code Understanding

## What this repo is

ZMK firmware config for a Corne split keyboard (42 keys, 2 halves, wireless via BLE). Built on the ZMK firmware for nRF52840 (nice!nano v2). This repo contains only the *config layer* — the actual ZMK firmware source is fetched by West from GitHub at build time. Firmware is compiled locally via `just build` (Docker + west); see the README "Build Firmware" section.

---

## Repo layout

```
config/
  corne.conf                      — master keyboard config (behaviour, power)
  yuyudhan-1.keymap               — all keybindings and layer definitions (default keymap)
  yuyudhan-2.keymap               — second selectable keymap (copy of yuyudhan-1 to diverge)
  west.yml                        — ZMK firmware version pin
  corne.json                      — QMK-style physical-layout JSON (currently unused by the build/viewer tooling)
  boards/shields/corne/
    corne.dtsi                    — shared hardware: matrix, OLED, RGB wiring
    corne_left.conf/.overlay      — left-half (central/USB) overrides
    corne_right.conf/.overlay     — right-half (peripheral/BLE) overrides
    corne-layouts.dtsi            — physical positions for ZMK Studio
    Kconfig.defconfig             — auto-applied build defaults
    Kconfig.shield                — shield name detection
    CMakeLists.txt                — builds custom right-half display
    src/custom_status_screen.c    — custom OLED layout (Trishul + battery + BLE)
    src/behavior_display_toggle.c — custom display-blanking toggle behavior
  dts/bindings/behaviors/
    zmk,behavior-display-toggle.yaml — devicetree binding for the display-toggle behavior
  boards/shields/nice_view_adapter/
                                  — swap-in adapter for nice!view display
```

---

## The two halves

**Left half = central.** It connects via USB and BLE. It runs ZMK Studio, holds the full keymap in flash, and is the single source of truth for all keybindings. Flash this half whenever you change the keymap.

**Right half = peripheral.** It connects to the left half via BLE only. It scans its keys and sends raw position events to the left — it does not process or apply the keymap at runtime. The keymap is compiled into both firmware binaries, but only the central uses it. You do not need to reflash the right half for keymap-only changes; only reflash it when the firmware itself changes (hardware drivers, display code, ZMK version bump).

Both halves compile to separate `.uf2` files and must be flashed independently.

---

## How layers work

The layout follows a 7-layer Miryoku-style design. Activating a layer is always a thumb hold; layers never stack arbitrarily.

| Layer | Thumb key | Hand |
|-------|-----------|------|
| BASE  | —         | both |
| NAV   | Space     | left thumb; nav keys on right |
| NUM   | Backspace | right thumb; numpad on left |
| MEDIA | Escape    | left thumb; media keys on right |
| SYM   | Enter     | right thumb; symbols on left |
| FUN   | Delete    | right thumb; F-keys on left |
| MOUSE | Tab       | left thumb; mouse keys on right |

**Home row mods (BASE layer):** Hold `A/S/D/F` for `GUI/Alt/Ctrl/Shift` (left hand); mirror on `J/K/L/'` for the right hand. Tap for the letter, hold for the modifier.

Each layer concentrates its keys on one hand so the other hand is free to hold the activating thumb key.

---


## How to change keybindings

1. Open `config/<keymap>.keymap` (default `config/yuyudhan-1.keymap`).
2. Find the layer block by name (e.g. `layer_base`, `layer_nav`).
3. Edit `&kp KEY` for a plain keypress, `&lt LAYER KEY` for a layer-tap, or `&mt MOD KEY` for a mod-tap.
4. Run `just build <keymap>` to compile new `.uf2` images into `firmware/<keymap>/<datetime>/`.

For live editing without reflashing, connect the left half via USB and use **ZMK Studio** (web or desktop). Changes made in Studio are saved to the left half's flash and take effect immediately.

---

## How to build

Run `just build` (requires `just` + Docker Desktop) — it spins up the
`zmkfirmware/zmk-build-arm:stable` container, runs west init/update/build, and
writes every `.uf2` image to a timestamped `firmware/<datetime>/` directory.
`just build left right`. See the README "Build Firmware" section for the full
recipe list.

**Flashing:**
1. Double-tap the reset button on the target half to enter bootloader mode.
2. A USB drive appears (`NICENANO` or similar).
3. Drag the correct `.uf2` onto that drive. It reboots automatically.

Flash left and right halves separately. Always flash left after a keymap change.

---

## Files you will NOT normally edit

These files describe physical hardware wiring and build plumbing. Only touch them when changing the actual hardware (matrix pins, display model, encoder wiring).

- `config/boards/shields/corne/corne.dtsi` — matrix rows/cols, OLED, RGB wiring
- `config/boards/shields/corne/corne-layouts.dtsi` — physical key positions for ZMK Studio
- `config/boards/shields/corne/corne.zmk.yml` — shield metadata
- `config/boards/shields/corne/Kconfig.defconfig` — auto-applied Kconfig defaults
- `config/boards/shields/corne/Kconfig.shield` — shield detection logic
- `config/boards/shields/corne/CMakeLists.txt` — build rules for the custom display source
