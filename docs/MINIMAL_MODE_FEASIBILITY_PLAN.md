# Minimal Mode Feasibility Plan

Status: investigation complete; implementation not started
Date: 2026-07-23

## Decision summary

Minimal mode is technically feasible and worth a small, reversible spike. It should be treated as a second TV presentation runtime, not as a rewrite of Lumina's state, selection, weather, or persistence layers.

The resource-saving case is plausible, but “exactly the same” is not a safe acceptance criterion. A raster renderer can match a fixed-resolution screenshot closely after the layout and fonts are specified explicitly. It will not automatically reproduce browser font rasterization, CSS `backdrop-filter`, SVG icon rendering, blend modes, animation timing, or responsive layout behavior. The first milestone should therefore prove visual equivalence for the low-power static feature set and measure the real host resource usage before expanding scope.

Recommended shape:

```text
Lumina state/API + image cache
             |
      minimal renderer
  (one composed frame at a time)
             |
  fullscreen native presenter
             |
          Wayland/X11
```

Chromium should remain the fallback and the full interactive TV/settings surface. Minimal mode should be selected explicitly, for example with `LUMINA_DISPLAY_MODE=minimal`, and be disabled automatically when its presenter or renderer fails.

## What the current system already provides

- `server/runtime/kioskControl.js` owns launch/kill state, manual override, CPU governor transitions, retry behavior, and unexpected-exit recovery. This is a natural seam for a presenter-neutral display runtime.
- `server/services/system.js` currently launches Chromium through a Wayland-first command with an X11 fallback. The same display discovery and failure-boundary concerns apply to a native presenter.
- `Dashboard.jsx` already contains the relevant rendering policy: image preload/failure handling, cover/contain crop math, split portraits, clock, weather and indoor readings, QR code, photo credits, vignette, aura, particles, and weather effects.
- The backend's canonical state and playback selectors can remain shared. Minimal mode does not need to duplicate category selection, ratings, feed persistence, or weather refresh logic.
- The current client deliberately keeps at most two slideshow layers in the DOM. A native renderer should preserve the equivalent invariant: at most one decoded current frame, plus one transition frame when a cross-fade is enabled.

## Host evidence gathered

The diagnostic run on the development/display host found:

- Wayland socket: available at `/run/user/1000/wayland-0`.
- Chromium: available at `/usr/bin/chromium-browser`; the Lumina daemon and port 5000 were inactive during the check.
- ImageMagick: available as `/usr/bin/magick` and `/usr/bin/convert`, with JPEG, PNG, WebP, SVG, fontconfig, freetype, cairo, and pangocairo delegates.
- GraphicsMagick, `sharp`, `jimp`, `mpv`, `feh`, `imv`, and similar standalone image presenters were not available in the checked environment. `node-canvas` was not initially installed, but it installed successfully as a temporary probe (`canvas` 3.2.3) and generated a PNG through Cairo/Pango/font support.
- The diagnostic session had `XDG_SESSION_TYPE=tty`, an active Wayland socket, and an SSH-style `DISPLAY`; the Mutter DBus check was unavailable outside the local GNOME session. This makes presenter testing on the actual local GNOME session mandatory.
- The existing regression suite passed all 216 assertions; its temporary Unix-socket live smoke test was skipped because the sandbox rejects `listen` with `EPERM`.

The available ImageMagick delegates make a composition proof possible, but ImageMagick alone is not yet a complete display solution. The host does, however, already contain a credible presenter stack: GTK4/GDK, PyGObject, GdkPixbuf, Cairo/Pango, SDL2 runtime libraries, and the Wayland client runtime. A persistent presenter must still be tested against the local GNOME Wayland/X11 session.

## Candidate approaches

### A. ImageMagick/GraphicsMagick command per frame

Use `magick` to decode, resize/crop, composite overlays, draw text, and write a PNG or JPEG. This is the fastest feasibility spike and can validate crop math, fonts, colors, vignette, QR, and weather icons.

Risks: process startup and repeated image decoding can consume more CPU than expected; command escaping and remote URLs need careful handling; it still needs a fullscreen presenter; transparency, blur, and animation parity need explicit recipes. GraphicsMagick is not installed, so it should not be a dependency assumption.

### B. Persistent `node-canvas` compositor

Keep one Node process and one Cairo-backed canvas. Draw the current frame in memory, update only when state, time, weather, or animation requires it, and hand the encoded frame to a presenter.

Risks: `node-canvas` is a native dependency requiring Cairo/Pango/font libraries and build/install support on the target host. The temporary probe proves installation and basic PNG output are viable here, but the dependency still needs to be added to Lumina deliberately, tested in the production launch environment, and measured under sustained rendering. It does not display a window by itself; CSS `backdrop-filter` and SVG icon parity must be implemented as raster operations or replaced with stable assets.

### C. Native presenter plus persistent compositor

Use a small Wayland/X11-capable presenter that owns one fullscreen surface and consumes rendered frames. The compositor can initially be ImageMagick-backed, then move to `node-canvas` only if measurements justify it.

This is the likely production shape because it separates image composition from display lifecycle, allows Chromium fallback, and avoids launching a heavyweight browser. The presenter dependency and packaging work are the largest unknowns. Do not choose a direct DRM/KMS path for the first implementation; it would bypass the existing desktop session and materially expand operational risk.

## Presenter candidates

### 1. GTK4/PyGObject presenter — recommended first choice

The host already has GTK4 and its GDK Wayland/X11 backends, PyGObject, GdkPixbuf, Cairo, and Pango. A small GTK process can own one undecorated fullscreen `Gtk.Window`, load the latest composed PNG into a `GdkTexture`/`Gtk.Picture`, and replace it on an IPC command or atomic frame-file change. GTK exposes both fullscreen and fullscreen-on-monitor operations, with asynchronous state notification; the presenter must therefore report actual mapped/fullscreen state rather than assuming the request succeeded. See the [GTK4 fullscreen API](https://docs.gtk.org/gtk4/method.Window.fullscreen.html) and [fullscreen-on-monitor API](https://docs.gtk.org/gtk4/method.Window.fullscreen_on_monitor.html).

Why it fits Lumina:

- GNOME-native and Wayland-first through GDK, with X11 fallback through the same toolkit.
- GdkPixbuf handles local PNG/JPEG/WebP loading without making the presenter decode remote URLs.
- The presenter can be very small because composition, weather formatting, and state selection stay elsewhere.
- GTK/Cairo/Pango are already present, avoiding a new GUI toolkit download for the first probe.

Tradeoffs:

- Python becomes a runtime dependency for the presenter, unless the helper is later ported to C or Rust.
- GTK is a toolkit rather than a bare scanout surface, so its RSS must be measured rather than presumed negligible.
- `Gtk.Window.fullscreen()` is a request mediated by the window manager, not a hard guarantee; the presenter needs a timeout and health report.

### 2. SDL2 presenter — strong lower-level alternative

The host has SDL2 and SDL2_image shared libraries, and SDL2 can use Wayland or X11 video backends. A small C/C++ helper could upload each composed frame as a texture, present it fullscreen, and handle frame swaps with fewer toolkit abstractions than GTK.

The checked environment lacks SDL2 development headers and `pkg-config` metadata, so this route would require installing development packages or vendoring/building against a defined target. It is attractive if GTK's memory footprint or fullscreen behavior is not good enough, but it is a second spike rather than the first implementation.

### 3. mpv or imv presenter — useful external-process experiment

An image-capable Wayland viewer could consume a frame sequence and provide a quick black-frame/tearing experiment. `mpv` explicitly supports Wayland and X11 GPU contexts, but neither mpv nor imv is installed here. This adds an external process and its own lifecycle/IPC semantics, so it is better as a benchmark or fallback than as Lumina's long-term presentation boundary.

### 4. ImageMagick `display` — X11-only diagnostic fallback

The `display` executable is available, but it could not open the current SSH `DISPLAY`, and it is an X11 display utility rather than a Wayland-native presenter. It can be useful to validate a composed PNG under XWayland, but it should not be the production presenter for a Wayland-first GNOME session.

### 5. Direct Wayland protocol — not a first spike

A direct client using `libwayland-client` and generated `xdg-shell` protocol bindings would minimize dependencies, but it would require owning window-surface, buffer, scaling, input, and compositor details. It also gives up the existing GNOME/X11 fallback for little benefit at this stage. Use GTK or SDL first; only consider direct Wayland after measured evidence shows the toolkit overhead matters.

### Presenter ranking

| Rank | Presenter | Current host evidence | Fit |
| --- | --- | --- | --- |
| 1 | GTK4/PyGObject | GTK4, GDK, PyGObject, GdkPixbuf, Cairo/Pango present | Best first proof: native session integration with minimal new installation. |
| 2 | SDL2 helper | SDL2 runtime present; headers/pkg-config absent | Good lower-level fallback after a small native build. |
| 3 | mpv/imv | Not installed; Wayland-capable options exist | Fast external benchmark, weaker lifecycle ownership. |
| 4 | ImageMagick `display` | Installed, but X11 only and current display unavailable | Diagnostic fallback only. |
| 5 | Direct Wayland | Client library present; protocol development surface is larger | Reserve for a proven toolkit bottleneck. |

## Proposed implementation stages

### Stage 0: freeze the minimal visual contract

Define a low-power feature set and a target display profile, initially the host's active width, height, and refresh rate:

- single-image cover/contain rendering and per-photo crop position;
- optional split portrait with its two credit labels;
- clock/date;
- weather current conditions, three-day forecast, and indoor sensor line;
- photo category/title/author credits;
- vignette, theme colors, and a static aura;
- slideshow changes and a simple cross-fade;
- QR badge only if a local QR generator or stable cached QR asset is available.

Defer settings UI, hover behavior, cursor hiding, CSS Ken Burns, live particles, animated rain/snow/clouds, and glass blur until the static path is measured. These are presentation enhancements, not prerequisites for a useful minimal mode.

### Stage 1: pure renderer model and screenshot oracle

Extract a renderer-neutral frame model from existing selectors. It should contain display dimensions, primary/secondary image URLs, resolved crop rectangles, widget visibility, formatted text, theme palette, and a deterministic render timestamp.

Add pure tests for cover/contain geometry, split layout, widget visibility, weather formatting, and stable fallback behavior. Build a fixture renderer that produces a frame from local test images and fixture state. Compare its output with a checked-in reference screenshot or pixel metrics; do not use live network images in tests.

### Stage 2: composition spike

Implement the smallest compositor using the host's ImageMagick delegates. Bind image-load and error handling before source selection in any helper that uses an image loader. Render one static 1920x1080 frame and one split-portrait frame, including text, vignette, theme colors, and a weather icon asset.

Measure wall time, peak RSS, output quality, and behavior when an image or font is missing. Keep all generated frames in a temporary/runtime directory; never put them in the repository or Google Photos cache.

### Stage 3: presenter spike

Evaluate a persistent fullscreen presenter on the actual local GNOME session. The spike must prove:

1. Wayland startup and fullscreen placement.
2. X11/XWayland fallback where the existing Chromium launcher currently needs it.
3. Atomic frame replacement without tearing or a black interval.
4. clean dismissal on idle activity and clean restart after a presenter crash.
5. no input capture or remote-control regression for the daemon.

If no suitable installed utility is available, package a deliberately small native presenter as a separate executable rather than making the Node daemon speak display protocols directly.

### Stage 4: runtime integration behind a feature flag

Generalize `kioskControl` from browser-specific names to a display-runtime interface with `launch`, `kill`, `isRunning`, and unexpected-exit handling. Preserve the existing Chromium implementation unchanged as the default/fallback. Add a minimal runtime that subscribes to the canonical snapshot and requests frame updates on:

- active frame/category/crop changes;
- widget/theme/config changes;
- weather/environment refresh;
- clock tick, at the chosen update cadence;
- slideshow interval.

Use atomic writes or an in-memory frame handoff. Avoid a per-second full-resolution encode unless measurements show it is cheap enough.

### Stage 5: measured parity decision

Run a 30-minute A/B soak on the same host and display:

- idle CPU and peak CPU during image transitions;
- resident memory for the daemon, compositor, presenter, and Chromium baseline;
- startup-to-first-frame time;
- frame transition latency and dropped/black frames;
- screenshot similarity for representative themes, crops, widgets, and weather states;
- recovery from network outage, bad image, missing font, presenter exit, and daemon restart.

Promote minimal mode only if it materially lowers memory/CPU, passes the reliability checks, and reaches an explicitly agreed visual threshold. Otherwise retain the compositor as an optional experimental path rather than replacing Chromium.

## Key design constraints

- Keep state, selectors, image metadata, weather, sensor, and persistence code shared with the browser path.
- Make renderer input deterministic and serializable; do not pass React elements, CSS strings, or browser-only objects across the boundary.
- Use local/cached image bytes where possible. Remote image fetch, retry, broken-photo reporting, and offline last-good-frame behavior must remain explicit.
- Pin and package fonts. The current CSS asks for `Outfit` and `Inter` but does not make browser font availability a native-renderer guarantee.
- Treat QR, weather icons, and other SVG/browser assets as explicit raster/vector assets with tests, not as incidental DOM output.
- Do not assume CSS effects have a one-to-one ImageMagick equivalent. Prefer a simpler static effect over an approximate effect that changes brightness or legibility unpredictably.
- Keep Chromium available as the recovery path until the minimal presenter has survived a real daemon/display soak.

## Main risks and mitigations

| Risk | Mitigation |
| --- | --- |
| No reliable fullscreen presenter on the target session | Make presenter discovery a Stage 3 gate; keep Chromium fallback; avoid direct DRM/KMS initially. |
| Raster output differs from browser output | Define a fixed target profile, pin fonts/assets, use screenshot fixtures, and accept a measured threshold instead of “identical.” |
| Per-frame ImageMagick forks erase the resource win | Prototype first, measure, then move to a persistent compositor or native drawing path. |
| Native dependencies are difficult to deploy | Keep the compositor/presenter behind an optional mode and document target packages; do not add a dependency before the spike proves value. |
| Clock/weather updates cause excess encoding | Separate static background composition from small overlay updates where possible, and rate-limit full-frame writes. |
| Crash or stale frame leaves the TV blank | Preserve the last good frame, report runtime health, and have kiosk control fall back to Chromium or dismiss safely. |

## Initial recommendation

Proceed with Stages 0–3 as a bounded feasibility spike. Start by comparing ImageMagick with the now-proven installable `node-canvas` path. ImageMagick remains useful for a quick composition oracle, while `node-canvas` is the stronger persistent-compositor candidate because it avoids a child process for every frame. The decisive experiment is not “can a PNG be generated?”; it is “can a persistent Wayland/X11 fullscreen presenter display the composed frame reliably while lowering total resident memory and CPU on the real host?”

No production code, package dependency, or default-mode change should be made until that experiment has a screenshot fixture, resource measurements, and a presenter recovery test.
