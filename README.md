<!-- FilePath: README.md -->

# Corne ZMK Keymap

Split ergonomic keyboard (42 keys) running [ZMK firmware](https://zmk.dev) on Nice!Nano v2.
Miryoku-style layout adapted from TOTEM config.

## Keymap

Auto-generated from [`config/corne.keymap`](config/corne.keymap) via [keymap-drawer](https://github.com/caksoylar/keymap-drawer):

![Keymap](corne_keymap.svg)

Regenerate it after editing the keymap — `just build` (or `make svg`) re-renders it; see [Build Firmware](#build-firmware) below.

## Display

- **Left (central):** Built-in ZMK status screen — output (USB/BT profile), battery %, active layer, and WPM
- **Right (peripheral):** Custom Trishul logo + battery % + split/BT status

## Interactive Viewer

```sh
make viewer
```

Press `?` for the cheat sheet. Press `0-6` to switch layers.

## Build Firmware

Firmware builds locally via [`just`](https://github.com/casey/just) + Docker — no cloud CI needed.
Requires `just` and Docker Desktop (running).

```sh
just build             # build all targets -> firmware/<datetime>/
just build left right  # build only specific halves (faster)
just check             # verify keymap-viewer.html matches the keymap
just clean             # wipe the local west workspace + build cache
```

`just build` also regenerates `corne_keymap.svg` and warns if `keymap-viewer.html` has drifted from the keymap; `just check` runs that drift check on its own.

Targets: `left` `right` `left_view` `right_view` `reset`. Outputs land in a timestamped
`firmware/<datetime>/` directory (e.g. `firmware/2026-06-26_14-30-05/`), one dir per run,
**gitignored — not committed**, containing `corne_left.uf2`, `corne_right.uf2`,
`corne_left_nice_view.uf2`, `corne_right_nice_view.uf2`, `settings_reset.uf2`.

### Flash

1. Double-tap the reset button on a half → it mounts as the `NICENANO` USB drive.
2. Drag the matching `.uf2` from the newest `firmware/<datetime>/` directory onto it; it reboots automatically.
3. Repeat for the other half. Reflash **both** halves after any `config/` change.

Or run `just flash left` (targets: `left right left_view right_view reset`) once a half is
mounted as `NICENANO`; it copies the newest matching `.uf2` from `firmware/` automatically.

## Regenerate Keymap SVG

```sh
make install   # one-time: pip install keymap-drawer==0.23.0
make svg       # parse + render SVG
```

> Alternatively, isolate it with pipx: `pipx install --python python3.12 keymap-drawer==0.23.0`

## Hardware

- **Board:** Nice!Nano v2 (nRF52840)
- **Shield:** Corne (split, 6x3+3)
- **Display:** OLED SSD1306 128x32 / Nice!View
- **RGB:** Disabled (no LEDs installed)
- **Bluetooth:** 4 profiles
- **ZMK Studio:** Enabled
- **Mouse/Pointing:** Enabled
