# 🌌 Lumina — AI Agent & Developer Reference Guide

## Project-wide objective and standing coding prompt — Alex, 2026-11-23

Lumina is much more than a screensaver or ambient-display project. A secondary, possibly primary, objective is to be a shining example of declarative code and expert functional programming using modern language constructs. This is a project-wide design and acceptance objective for all code, not a temporary refactoring phase or a backend-only convention.

Treat the following standing prompt as front-of-mind guidance before every implementation and review. Preserve consistent surrounding conventions; use abstractions and shorthand for clarity, reuse, testability and predictable behavior, not ceremony. This applies to existing and new modules, client, server, tests and tooling. It does not commission a wholesale rewrite or change the current roadmap priorities.

```text
As always, document, create tests, and be a shining example of expert functional programming. Before implementing, consider whether the solution can be expressed through pure functions,
  curried interfaces, partial application, composition, higher-order functions, declarative pipelines, or small lawful abstractions. Prefer these forms unless a simpler alternative is clearly
  more readable.
  Favour data-last or data-first conventions consistently, depending on the surrounding codebase, so functions can be partially applied and combined cleanly. Avoid needless ceremony, but do
  not default to imperative control flow when a compositional functional design would be clearer.

  Use Fantasy Land-inspired abstractions where they fit the problem: Functor, Apply, Applicative, Chain, Monad, Semigroup, Monoid, and related laws should be considered when they make
  behaviour more reusable, testable, and predictable.

  Use concise shorthand, point-free style, tacit composition, and idiomatic functional expressions when they improve clarity.

  Use modern ES6+ language features idiomatically where they improve clarity and reduce noise. Prefer optional chaining, nullish coalescing, logical assignment, destructuring, rest/spread
  syntax, concise object literals, template literals, default parameters, arrow functions, const/let, modules, and declarative array/object transformations when they make intent clearer.
```

Keep the living roadmap enriched with Alex's feedback and discoveries; apply [roadmap and complexity discipline](./CONVENTIONS.md#roadmap-and-complexity-discipline), not a static task dump. Report commit subjects and roadmap movement, not bare hashes.


Welcome, fellow AI agent or human developer! This document is designed to give you an immediate, comprehensive understanding of **Lumina**, a highly-optimized, Chromecast Ambient-mode screensaver and smart-display dashboard. It runs as a system-wide background daemon on Linux (GNOME/Mutter displays) with dynamic mobile remote control capabilities.

---

## 📌 Project Overview & Goals

**Lumina** transforms a local display (e.g., an HTPC or dedicated living room TV running Linux/Fedora) into an elegant, ambient smart display. It has three core design pillars:
1. **High Visual Excellence**: Beautiful high-definition wallpapers curated dynamically, accompanied by glassmorphic widgets, smooth transitions, and environmental effects (rain, snow, bokeh particles).
2. **System-Wide Idle Daemon Integration**: Integrates directly with GNOME's window manager (Mutter) and PulseAudio to launch and close a fullscreen kiosk screensaver automatically based on system idle state and sound activity.
3. **Resource-Constrained Operation**: Built for resource-limited hardware such as older HTPCs. The kiosk applies a V8 heap limit, the slideshow bounds mounted slide elements, and the daemon changes CPU governor profiles. Total process memory, GPU allocation, and CPU usage remain performance measurements to establish on the reference host.

---

## 🛠️ Architecture & Data Flow

Lumina utilizes a decoupled client-server architecture. The durable control surface is moving toward REST-first APIs, while Socket.IO remains the live-sync and low-latency event channel.

Current engineering status and next work have one owner:
[FUNCTIONAL_REFACTOR_ROADMAP.md](./FUNCTIONAL_REFACTOR_ROADMAP.md#step-6-prepare-the-codebase-for-typescript-without-a-premature-rewrite).
Read [ROADMAP.md](./ROADMAP.md) for product intent, feedback and deferrals, and
[CONVENTIONS.md](./CONVENTIONS.md#roadmap-and-complexity-discipline) for task/WIP
and complexity discipline, including the commissioned Beads queue-first workflow.
Beads selects eligible work; Fila retains scope/review/acceptance. Do not mirror
queue transitions or append per-helper history to this guide.

The source-grounded [C4 architecture record](./docs/architecture/README.md) owns
current/target views and their single Structurizr DSL model. The target is a
proposal, not deployed structure. The domain directory includes an effectful
dispatcher and mutable snapshot-application helpers; pure projections are a
conceptual boundary, not a promise about every function in that folder.


---

## 📂 Project Structure

Here is a map of the codebase for quick navigation:

```text
lumina/
├── client/                     # React + Vite Frontend
│   ├── dist/                   # Production built assets (served by Express)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard.jsx   # The "TV View" dashboard & environmental widget engine
│   │   │   └── RemoteControl.jsx # The "Remote View" mobile-optimized controller web UI
│   │   ├── App.jsx             # Main Router (Auto-detects TV vs Remote view, coordinates socket)
│   │   ├── index.css           # Premium styling, animations, themes, and glassmorphic designs
│   │   └── main.jsx            # React client entry point
│   ├── package.json            # Vite frontend configuration & dependencies
│   └── vite.config.js          # Vite build options
├── server/                     # Modular backend services & domain logic
│   ├── domain/                 # Functional core (commands, reducers, selectors, ecowitt, statePatch)
│   ├── runtime/                # Operational runtimes (environment refresh, browser kiosk control)
│   ├── services/               # System & API integrations (system, vision, googlePhotos)
│   ├── app.js                  # Express application setup
│   └── routes.js               # REST route spec registrations
├── curated_collections.json    # Local JSON database persisting photography feeds
├── sensor_history.db           # SQLite database persisting hourly environmental telemetry snapshots
├── launch.sh                   # Convenience shell wrapper to start server and background daemons
├── package.json                # Root package configuration & backend dependencies
└── AGENTS.md                   # You are here! (AI Agent & Developer Guide)
```

---

## Core contracts and source ownership

- **Domain and transports:** REST owns durable mutations; Socket.IO owns live
  snapshots/status and explicit compatibility shims. Decode commands at the
  boundary, keep business rules in `server/domain`, and interpret ordered effects
  in the existing shell. Preserve native lookup/coercion/failure behavior while
  adding type contracts; do not replace compatibility data with silent validation.
- **State and persistence:** use the shared state/snapshot contracts rather than
  inventing local shapes. Retain unvalidated feed metadata and aliases where the
  current boundary permits them. Collection writes use read-merge-write and atomic
  persistence; a crawl must not erase human metadata, location or keyword settings.
  Rating1 removes a photo from the visible feed and advances the active selection.
  Tests must use the existing test-mode write protection, never production data.
- **Playback:** eligible pools rotate evenly; smart preferences apply within the
  selected pool and sequence playback keeps per-pool cursors. A displayed primary
  URL owns its rotation countdown; metadata/crop/secondary-only changes preserve
  it. The server selects recovery after one broken-photo report; clients must not
  append a second next-photo command. See selectors/media policy and their tests.
- **Client effects:** `App.jsx` owns normalized state-sync application. Dashboard
  effects derive from that canonical state, not duplicate raw snapshot listeners.
  REST/direct/enveloped responses share the existing projection. Keep transient
  browser/timer/storage/React effects outside pure selectors/request plans.
- **Images and kiosk:** at most two mounted slide elements; preload through one
  authoritative Image path and register handlers before assigning src. Preserve
  bounded retry/origin-recovery and page-wide cursor timeout/rearming. TV dismissal
  capability belongs to explicit `?mode=tv`, not an admin preview. Physical-TV
  reports remain unverified unless observed on the real kiosk. Do not confuse a
  DOM/heap bound with measured total RSS/GPU/CPU efficiency.
- **Desktop shell:** one native service owns the daemon and its tracked kiosk.
  GNOME may move the main browser into an application scope; verify its parent
  PID and TV-mode URL rather than relying on cgroup membership alone.
  Mutter idle checks and audio activity govern activation; CPU policy and OS calls
  stay in the defensive effect shell. Use existing runtime helpers instead of
  spawning another daemon, killing every node process or changing a shared default.
- **Feeds and integration:** retain source-local identity, accumulation, lifecycle,
  metadata and signed-URL behavior. Crawlers use descriptive user agents and varied
  requests, not browser impersonation. Environment profiles select one adapter;
  normalized sensor/history consumers must not become device-specific. Existing
  REST environment/history/export and legacy compatibility contracts remain in
  routes/services and regression tests. Weather uses local configuration, optional
  geolocation and its documented fallback. Secrets remain private configuration.
- **UI and styling:** preserve mobile/TV modes, immutable Image Feeds panel
  preferences and transient focus semantics. Pointer drag reordering remains
  deferred where it conflicts with crop gestures. CSS themes and particle/weather
  effects are presentation concerns, not duplicated domain state.

Detailed pre-consolidation integration explanations and migration observations
are retained as historical material in [DEVELOPER_LOG.md](./DEVELOPER_LOG.md#historical-agent-guide-reference--2026-11-23).
Use actual source/tests and the current engineering checkpoint for live truth;
that historical record is not an additional queue or authority grant.

## 🚀 Execution & Command Operations

To install and run Lumina, execute the following commands in the workspace root:

### 1. Install Dependencies
```bash
# Installs server and front-end dependencies recursively
npm run install-all
```

### 2. Start Developer Mode
```bash
# Starts both the Express core and the Vite web client concurrently
npm run dev
```

### 3. Production Daemon Control

The native user service is the running owner. Inspect its ExecStart and live
process executable before choosing a test/development runtime; shell node and the
OpenClaw node-agent runtime can differ. Follow the project's declared runtime
from the committed `.nvmrc` pin and qualify changes against the actual deployed
baseline. Select the installed qualified binary explicitly for tests/builds.
The existing installer accepts `NODE_BIN`; it and the manual launcher reject
a version mismatch. The generated service uses the same binary for ExecStart
and derives PATH from its directory. Do not change a global Node default or the
separate OpenClaw runtime to satisfy this project pin.

```bash
systemctl --user status lumina.service
# Only within current deployment/restart authority:
systemctl --user restart lumina.service
```

Build/test a private ignored candidate before promotion; the existing headless
runner accepts LUMINA_TEST_DIST so validation need not replace live assets.
Publish compatible hash-named assets and atomically switch the index for rollout;
an already-open admin page needs a normal refresh to load new code. Capture fresh
manual/active intent and restore only that intent through the existing API.
The supported installer is
`scripts/install-systemd-user-service.sh`; do not run it during read-only tests.
`launch.sh` is a duplicate-refusing fallback for environments without the service,
not a second supervisor. Source commits do not implicitly authorize publication.

### 4. Running Regression Tests
Use the existing regression entrypoint and [candidate verification policy](./CONVENTIONS.md#candidate-verification); reuse evidence for unchanged inputs rather than rerunning solely because a turn ends:
```bash
# Executes unit and integration smoke tests
npm test
```

---

## 🤖 AI Agent & Developer Guidelines

If you are an AI agent or developer modifying this codebase, you **MUST** strictly adhere to the following operational instructions:
1. **The Scout Rule (Core Directive)**: Proactively leave the codebase better than it was before. For every change, look for at least one piece of code to clean, document, or make more functional/declarative. If you identify a defect or a design flaw, and the fix is simple and quick, do it immediately. Otherwise, log it in the Tech Debt / Backlog documentation section.
2. **Abide by the Nine Maxims**: Read and strictly follow the [Lumina Coding Conventions & Philosophy](./CONVENTIONS.md) which institutionalizes our attitudes regarding clean code, functional style, SOLID design, small commits, automated testing, anti-overengineering, and privacy protection.
3. **Mandatory Git Commits**: Proactively make atomic, structured Git commits at **every substantive change** (e.g., adding a feature, fixing a bug, updating configurations). Do not wait until the end of the work session to commit all files. Keep commits under 4 files and 300 LOC where possible.
4. **Hardened Error Boundaries & Self-Healing**: Never let errors cascade or crash the main server daemon. Wrap all system-level commands (DBus Mutter polling, `pactl` audio checks, `scaling_governor` operations) in robust try/catch blocks with fail-safe recovery fallbacks.
5. **Loop & Skip Protections**: Always rate-limit and boundary-constrain recursive transitions or skip skips. Do not allow rapid high-frequency socket events to flood the client interfaces under error or offline conditions.
6. **Candidate Verification**: Follow [candidate verification](./CONVENTIONS.md#candidate-verification): required checks cover the exact candidate; handoffs alone don't invalidate passing evidence. Independent review and honest diagnostic reporting remain mandatory.
7. **Always Bind Image Event Handlers Before Setting `src`**: Assign event handlers (`img.onload` and `img.onerror`) to `Image` elements *prior* to setting `img.src = url`. For cached images, browsers might load and trigger events synchronously; setting `src` first will cause events to fire into the void, resulting in stuck preloader indicators ("Preloading preview...").
8. **Synchronize In-Place Slideshow State Properties**: When checking if the active slide needs updating in `useEffect` (e.g., in `Dashboard.jsx`), do not rely on URL identity checks alone. If only properties like `cropPercent` or `cropPositionY` have changed, apply these updates in-place inside `activeSlides` so they re-render correctly.
9. **Target Active Slides in Browser Automation Tests**: When writing end-to-end integration tests (e.g., in `test_split_sync.js`), always prepend `.slide.active` to selectors targeting images or content. This ensures selectors target the active slide and do not match old transitioning-out slides still lingering in the DOM during cross-fades.
10. **Authoritative Host / Fila Orchestration**: Develop, run and test in the existing checkout on `playwright`. Fila orchestrates through the paired command node or registered SSH; a bounded coding worker is not the controller. SSHFS is optional, never required. Do not copy the project or install browser dependencies on the Gateway, and preserve the single-writer boundary.
11. **No Personal Information in Git Commits**: Because git commits are pushed to a public repository on GitHub, you **MUST** ensure that no personal information (such as personal usernames, credentials, access tokens, OAuth secrets, local IP schemes, or personal paths) is saved in the project's git commits. Always inspect diffs (`git diff`) before committing. Keep host-private instructions in ignored `.agents/MEMORY.md`; tracked documentation is not an exception to privacy.
12. **Capture at the Right Owner**: Record new generic design lessons in `DEVELOPER_LOG.md` and private setup/recovery changes in ignored `.agents/MEMORY.md`. Update only the affected owner; link acceptance evidence instead of copying counts/status into both files. No new learning means no journal filler.
13. **Git Metadata Authority**: Complete scoped atomic commits after verification. A blocked metadata operation is not permission to bypass controls; use the supported authorized path. Push/publication requires current explicit authority and is not implied by local development acceptance.
14. **Functional-Excellence Learning**: Record substantive new design/compatibility learning once in `DEVELOPER_LOG.md`, linking its evidence; update the roadmap when direction, risks, acceptance or milestone outcomes change. Explain the pure boundary and imperative shell where relevant, not a prescribed ledger for every turn. Functional clarity remains a product objective.



---

## 🔮 Active Backlog & Future Developer Roadmap

If you are an AI agent or a developer tasked with extending Lumina, here are excellent planned features you could implement:
Cross-cutting design and consistency findings are tracked in [ROADMAP.md → Backlog & Audit Findings](./ROADMAP.md).
* **Forecast Transport Resilience**: Automatic IP lookup resilience is delivered in 1.1.0; see [weather/location behavior](./README.md#weather-and-location). The separate forecast request remains unbounded; the [product roadmap](./ROADMAP.md#backlog--audit-findings-2026-10-04) owns its proposed follow-up, not an automatic next implementation.
* **Google OAuth Callback Hardening**: Add a one-time OAuth `state` check and construct callback URLs from a configured trusted origin; see the audit backlog in [ROADMAP.md](./ROADMAP.md).
* **Smart Home Integrations**: Add an Express webhook (e.g. `POST /api/alert`) that temporarily overlays push notification bubbles on the TV view (e.g. "Front door bell rang") using standard Socket.io events.
* **Audio Spectrum Visualizer Widget**: Connect to a local browser audio node when screensaver animations are active to draw a matching organic visualizer bar at the bottom screen borders.
* **Repository-owned agent workflows**: Add portable roadmap-slice and Git-publish instructions under `.agents/skills` or tracked docs; this checkout currently has no repo-local copies, so a clean environment may depend on host-local Codex memory.
