# 📖 Lumina Developer Log & AI Learnings Journal

This document serves as a public-facing, generic history of technical developments, architectural decisions, and key technical lessons learned. Any developer or visiting AI agent should read this file to understand why certain features were built in a specific way and to avoid repeating past mistakes.

---

## 📅 Technical Changelog & Milestones
### 2026-07-19: Synchronized Comprehensive Project Documentation
- **Goal**: Update `README.md`, `AGENTS.md`, and project guides to fully accurately reflect all recently implemented major features, architecture shifts, and REST API expansions.
- **Implementation**:
  - Updated `README.md` features and architecture sections with adaptive sensor device management, pasteable JSON payload support, protocol-first adapter discovery (`GET /api/environment/adapters`), continuous TV kiosk presentation (with 3-second cursor auto-hiding), and full list of REST API endpoints (async jobs for recrawl and vision-analysis, pool mutations, state patches).
  - Updated `AGENTS.md` to remove obsolete references to the legacy pitch-black stealth clock dimmer, replacing it with the continuous smart display presentation model, and expanded the REST API reference guide.
  - Aligned system documentation across `README.md`, `AGENTS.md`, `ROADMAP.md`, and `DEVELOPER_LOG.md`.
- **Learning**: Maintaining clear, synchronized documentation across user-facing `README.md`, developer `AGENTS.md`, and product `ROADMAP.md` prevents context drift and ensures future AI agents and human contributors have an exact, accurate picture of the system state.

### 2026-07-19: Added Adaptive Sensor Device Management
- **Goal**: Make compatible local sensor setup a visible admin task instead of requiring users to reinterpret one flat GW1200 configuration.
- **Implementation**:
  - Added a pure saved-device catalog with automatic migration from existing flat `config.ecowitt` settings, registered-adapter validation, and a backwards-compatible active-device projection.
  - Kept several named profiles while retaining one active poller, so changing sources does not introduce concurrent timers, data fusion, or history migrations.
  - Rebuilt System → Environment around current conditions, a contained device list, an explicit **Add device** action, and a persistent editor that renders beside the list on expanded windows and below it on compact windows.
  - Replaced the ambiguous polling switch with **Use device** / **Stop polling** actions. The only switch on the page is the semantic, keyboard-operable **Show indoor readings on TV** presentation preference.
  - Hardened active-device changes so they clear the previous source's last-good reading, abort outstanding reads, and reject late completions before they can update the cache or history.
  - Removed the device editor's misleading close icon. The editor is intentionally persistent in the list–detail layout, so a dismiss action had no coherent state to represent.
  - Recorded the research, trade-offs, target model, rubber-duck transcript, and acceptance criteria in `SENSOR_DEVICE_MANAGEMENT_PLAN.md`.
- **Learning**: A protocol adapter, a saved physical-device profile, and a running poller are three different concepts. Making those distinctions explicit simplified both the runtime and the interface; multiple profiles do not require multiple simultaneous ingestion pipelines. Cached and in-flight observations also belong to the active-source generation, not to the adapter runtime globally.
- **Verification**: Focused server and client-state regressions were added. Source parsing, ESLint, CSS parsing, and public-diff checks passed in the contribution workspace; the repository-mandated `npm test`, client build, and live responsive checks remain to be run on Playwright before the draft PR is marked ready.

### 2026-07-19: Documented Ecowitt Compatibility API
- **Goal**: Make hardware compatibility discoverable before setup.
- **Implementation**: Documented the exact local API contract, `GET /get_livedata_info`, in the admin panel, README, and agent guide with a link to Ecowitt’s published protocol.

### 2026-07-19: Added Pasteable Adapter JSON to Environment Setup
- **Goal**: Let a fresh GitHub user configure a device from a copied setup payload without manually editing local files.
- **Implementation**:
  - Added an Advanced JSON editor to Gateway Configuration with a safe parse-and-apply step before the existing validated save path.
  - Added pure JSON parsing coverage, preserving the rule that pasted data is configuration only and never executable code.
- **Learning**: Field controls are approachable for common setup, while a portable JSON representation is essential for repeatable onboarding and future adapter-specific settings.

### 2026-07-19: Introduced the General Sensor Adapter Platform Boundary
- **Goal**: Prevent the local sensor platform from becoming an Ecowitt-only subsystem as additional device protocols are introduced.
- **Implementation**:
  - Added `server/services/sensorPlatform.js` with one capability-aware adapter contract for read, lifecycle, and settings operations.
  - Registered the Ecowitt GW1200 as the first adapter and routed environment reads, startup, shutdown, and configuration updates through the platform.
  - Added `GET /api/environment/adapters` so the admin/API layer can discover registered device capabilities rather than assuming one vendor forever.
  - Kept Ecowitt HTTP parsing inside its adapter boundary; storage and normalized consumers remain source-agnostic.
- **Learning**: There is no single universal local sensor wire protocol. The stable abstraction is a normalized platform envelope plus thin protocol adapters, not a universal vendor-shaped data object.
- **Verification**: Added capability-aware platform composition coverage and retained the full existing regression gate.

### 2026-07-19: Added Admin Controls for Local Ecowitt Configuration
- **Goal**: Make a fresh Lumina installation self-configurable for an IoT-ready Ecowitt gateway instead of requiring direct editing of `config.json`.
- **Implementation**:
  - Added validated `GET/POST /api/environment/settings` endpoints for gateway URL, enablement, polling interval, timeout, and presentation units.
  - Added the Gateway Configuration form under Remote Control → System → Environment. Saving writes only local non-secret settings to gitignored `config.json` and applies them to the running adapter immediately.
  - Kept URL and unit validation in the backend boundary, with the existing placeholder-only public example retained.
- **Learning**: Configuration belongs at the REST/admin boundary, while the adapter remains a small runtime interpreter. This keeps deployment-specific device details out of the public source and avoids requiring a restart for ordinary setup changes.
- **Verification**: Live port-5000 settings and environment endpoints returned the configured gateway, units, and current GW1200 reading; regression suite passed.

### 2026-07-19: Made Ecowitt Units Configurable and Preserved Full Gateway Telemetry
- **Goal**: Remove implicit local assumptions from the public adapter and ensure the history contract does not discard GW1200 sensor families that are not needed by the first widget.
- **Implementation**:
  - Documented `config.json` as the local source of the Ecowitt gateway URL and presentation units; the tracked example uses placeholders and no household IP or location.
  - Kept database values canonical in Celsius, hPa, and other metric units, then converted the TV/remote presentation according to `ecowitt.units`.
  - Added a backwards-compatible SQLite migration and persisted the complete `get_livedata_info` JSON payload as `gateway_metrics_json`, exposed as parsed `gateway_metrics` in JSON history and included in CSV export.
  - The live GW1200 currently reports `common_list`, `wh25`, and `debug`; future paired blocks such as rain, wind, lightning, air quality, soil, leaf, leak, distance, and multichannel sensors now flow through without a schema change.
- **Learning**: A fixed column set is appropriate for canonical widgets, but it is not an adequate representation of a vendor gateway with optional sensor families. Preserve the source payload at the storage boundary and derive stable fields only where Lumina has a semantic consumer.
- **Verification**: Live port-5000 API returned current GW1200 data and history with `gateway_metrics`; client build and lint passed, and the full regression suite passed.

### 2026-07-18: Added a Discoverable Environment Admin Surface
- **Goal**: Make the new IoT-ready sensor capabilities visible without adding another top-level navigation tab or turning the remote into a telemetry dashboard.
- **Implementation**:
  - Split the System panel into lightweight `General` and `Environment` subtabs.
  - Added a Local Sensor Bay card for Ecowitt GW1200 status, indoor readings, stale-state visibility, and the existing TV visibility toggle.
  - Added 24-hour history refresh, latest stored snapshot context, and a direct CSV export action for Grafana or archival use.
  - Kept the device presentation adapter-agnostic in naming and data shaping; the current GW1200 is shown as the first local adapter, not as a UI-wide special case.
- **Learning**: The right information architecture was a sub-navigation within System: environment telemetry is operational context, while direct photo/display controls remain separate top-level workflows.
- **Verification**: Client helper tests, `npm test` (199 passing assertions, zero failures), production client build, and lint completed successfully.

### 2026-07-18: Persisted Hourly GW1200 Sensor Snapshots
- **Goal**: Complete the Phase 2 local sensor-platform storage slice without introducing a database server or coupling UI widgets to Ecowitt.
- **Implementation**:
  - Added `server/services/sensorHistory.js`, separating pure sensor normalization and CSV projection from a small injected `node:sqlite` storage adapter.
  - Successful GW1200 reads now upsert one row per UTC hour, retaining the newest reading in that hour and combining indoor gateway metrics with the latest outdoor Open-Meteo snapshot.
  - Added `GET /api/environment/history`, `GET /api/environment/history/export?format=csv`, and the short `/api/environment/export` alias. The default database path is the local ignored `sensor_history.db`; tests use an in-memory database.
  - Added configuration defaults, route tests, normalization tests, hourly deduplication tests, and CSV export coverage.
- **Learning**: The useful abstraction is a pure normalized record plus a narrow persistence port. The hourly key is a domain projection, so idempotent upsert behavior stays deterministic and independent of SQLite details.
- **Verification**: `npm test` passed 198/198 assertions.

### 2026-07-18: Extended Clock Widget Glass Container Right Padding
- **Goal**: Prevent the top-right rounded corner of the blurry glass container behind the clock from clipping the letter "m" in "am" / "pm".
- **Implementation**:
  - Added `padding-right: 36px` to `.clock-widget` in `client/src/index.css` (up from default `24px`), extending the backdrop-blur glass container rightward so top-right corner radius curves clear the AM/PM text.
- **Verification**: `npm test` passed 225/225 diagnostic assertions.

### 2026-07-18: Removed Pitch-Black Dimmer Overlay to Keep TV View Desktop Visible
- **Goal**: Prevent the TV View from flashing for a moment on page load/mount and then fading to a pitch-black screen.
- **Implementation**:
  - Removed `.screensaver-dimmer` pitch-black overlay and `.stealth-dim-clock` elements from `client/src/components/Dashboard.jsx` and `client/src/index.css`.
  - Updated `Dashboard.jsx` to render the TV dashboard UI (clock, weather, widgets, wallpaper slideshow, particle effects, weather overlay animations) directly without dimming to black.
  - Simplified mouse interaction in `Dashboard.jsx` so mouse movement manages smooth 3-second cursor auto-hiding without dismissing or fading the TV View to pitch black.
- **Learning**: Gating ambient smart display rendering behind an active/inactive idle state can create unintended black-screen states when viewing the dashboard from web browsers or remote controllers. Keeping the TV dashboard elements rendered directly while managing cursor visibility provides a seamless ambient display experience.
- **Verification**: `npm run build --prefix client` and `npm test` passed 225/225 diagnostic test assertions cleanly.

### 2026-07-18: Added SQLite Sensor Data Recording & REST Export API to Phase 2 Roadmap
- **Goal**: Define the storage and API export strategy for hourly IoT sensor readings (Ecowitt GW1200 + outdoor weather) as part of Phase 2's Local Sensor Platform.
- **Implementation**:
  - Evaluated storage and telemetry architectures (SQLite + REST export API vs. Prometheus `/metrics` endpoint).
  - Selected **Option A (SQLite DB + REST Export API)** for minimal complexity, zero external server dependencies, full offline self-containment, and adherence to Lumina's strict hardware memory (<80MB RAM) and CPU footprint constraints.
  - Updated `ROADMAP.md` Phase 2 (Local sensor platform) and Phase 2 Acceptance Plan to specify hourly sensor recording to a local SQLite database (`sensor_history.db`) exposed via `GET /api/environment/history` and `/export` REST endpoints for Grafana (Infinity/SQLite plugin) and direct JSON/CSV downloads.
- **Learning**: Self-contained SQLite persistence using Node.js built-in `node:sqlite` or lightweight SQLite allows Lumina to act as a zero-dependency telemetry source that integrates cleanly into Grafana without forcing the user to host a separate Prometheus server stack.
- **Verification**: Updated `ROADMAP.md` and `DEVELOPER_LOG.md`, verified formatting and repository standards.

### 2026-07-18: Add the First Ecowitt GW1200 Indoor Environment Slice
- **Goal**: Introduce local indoor observations without turning Lumina's picture-gallery view into a dashboard or coupling indoor telemetry to outdoor weather selection.
- **Implementation**:
  - Added `server/services/ecowitt.js` with pure payload parsing and metric normalization for the verified GW1200 `wh25[0]` response, including Fahrenheit-to-Celsius and inHg-to-hPa conversion.
  - Added a resilient in-memory runtime and read-only `GET /api/environment` contract with last-known-good stale fallback and availability-transition logging.
  - Added ignored local Ecowitt configuration, a quiet subordinate indoor line inside the existing weather card, and an independent remote visibility toggle.
  - Kept Open-Meteo as the outdoor weather and forecast source; the GW1200 endpoint currently provides no outdoor observation.
  - Added parser, normalization, disabled-mode, stale-fallback, and API-shape regression coverage, plus the captured payload as an anonymized test fixture.
- **Learning**: The useful functional boundary is a pure vendor-to-domain normalization pipeline followed by a small imperative polling shell. A generalized sensor framework or Fantasy Land wrapper would add ceremony without improving this first adapter.
- **Verification**: `npm test` passed 195/195 assertions, `npm run lint` passed, and the client production build completed successfully.

### 2026-07-18: Made QR Code & IP Address Widget Optional to Display
- **Goal**: Allow users to toggle the QR code and IP address rectangle on the TV view, so it doesn't block image titles in paired mode or clutter the screen when unneeded.
- **Implementation**:
  - Added `qrcode: true` to the default `widgets` object state in `server/config/state.js`.
  - Updated `client/src/components/Dashboard.jsx` to conditionally render the bottom-left `connection-widget` based on `state.widgets.qrcode` and added "QR & IP Badge" to the Desktop settings toggle list.
  - Updated `client/src/components/remote/SystemSettingsTab.jsx` with a new `QrCode` switch item under the TV Widgets Switchboard so users can toggle the QR & IP Badge from the mobile remote.
  - Updated `AGENTS.md` documentation to list `qrcode` as an official widget key in `widgets`.
  - Added test assertions in `server/domain/tests.js` for `qrcode` widget state patching and updated client build bundle.
- **Learning**: Because the domain reducer and socket compatibility adapters evaluate `widgets` patches dynamically against the keys on `state.widgets`, adding a new widget key to `state.js` automatically enables seamless validation and dispatch without requiring extra transport boilerplate.
- **Verification**: `npm test` passed 218/218 tests cleanly, and `npm run build --prefix client` built the production React bundle without issues.

### 2026-07-18: Continued Step 4 with a Shared Field-Entry Reducer Shell for Simple Setters
- **Goal**: Keep the active Step 4 readability pass moving by removing the remaining ad hoc simple config/runtime setter branches in `server/domain/reducer.js` without hiding the explicit kiosk side effects or widening the reducer into another framework.
- **Implementation**:
  - Added one small field-entry reducer helper in `server/domain/reducer.js`, then rewired the remaining simple setters to specialize that same shell instead of mixing one-off `assignIfChanged(...)` and multi-field runtime updates inline.
  - Moved `set-split-portrait`, `set-split-crop`, `set-scale-mode`, `change-theme`, `change-interval`, and `set-screensaver-active` onto the shared `read entries -> assign changed fields -> maybe persist/effect` boundary while keeping the `launch-kiosk` / `kill-kiosk` effect choice explicit in the command table.
  - Expanded `server/domain/tests.js` so the reducer regression suite now covers the deactivation path too, proving the shared shell flips `screensaverActive`, `manualOverride`, and `browserRunning` together while still emitting `kill-kiosk`.
  - Expanded `run-tests.js` so the REST route suite now covers both screensaver activation and deactivation through `POST /api/state/screensaver`, pinning the shared setter shell at the transport boundary as well as in the pure reducer.
  - Updated `ROADMAP.md` and `FUNCTIONAL_REFACTOR_ROADMAP.md` so the repository records this July 18, 2026 Step 4 slice directly for the next agent.
- **Learning**: The useful abstraction here was another tiny reducer-local interpreter, not a generalized command framework. Once the remaining setter branches became field-entry readers plus one shared shell, the only code left in each branch was the actual policy: which fields change, whether they persist, and whether a kiosk effect should fire.
- **Verification**: `npm test` and `npm run lint` are the verification gate for this slice.

### 2026-07-18: Continued Step 4 with One Shared Patch-Transport Builder for Photo and Pool Mutations
- **Goal**: Keep the active Step 4 readability pass moving by removing the last duplicated route/socket transport-shaping helpers in `server/domain/commands.js` without flattening the intentional route-only and socket-only exceptions in those families.
- **Implementation**:
  - Refactored `server/domain/commands.js` around one small patch-transport builder plus shared route/socket interpreters, then rewired both the photo and pool mutation families to specialize that same boundary instead of carrying parallel `createPhoto*` and `createPool*` shaping helpers.
  - Kept transport-owned differences explicit by preserving route-only loved-photo patches, socket-only metadata reporting, and dynamic pool feed-config route expansion as plain spec data flowing through the shared builder instead of hiding them behind imperative branching.
  - Expanded `server/domain/tests.js` with direct regression coverage that asserts the shared builder still expands the expected photo and pool route keys while keeping the intentional route-only/socket-only cases explicit.
  - Updated `ROADMAP.md`, `FUNCTIONAL_REFACTOR_ROADMAP.md`, and `AGENTS.md` so the July 18, 2026 checkpoint names this Step 4 slice directly for the next agent.
- **Learning**: The useful abstraction here was one tiny transport-family interpreter, not separate photo and pool helper clusters. Once the route/socket shaping shell became shared, the only remaining differences were the real policy facts, which now stay visible as data instead of duplicated helper code.
- **Verification**: `npm test`, `npm run lint`, `npm --prefix client run build`, and `git diff --check` are the verification gate for this slice.

### 2026-07-16: Continued Step 4 with Shared Pool-Mutation Transport Specs
- **Goal**: Keep the active Step 4 readability pass moving by removing the remaining duplicated pool-mutation command inventory across REST patch decoding and durable socket listeners without widening the pool transport boundary into a framework.
- **Implementation**:
  - Refactored `server/domain/commands.js` around one shared declarative pool-transport family for keyword and feed-config mutations, then derived both the `PATCH /api/pools/:name` decode specs and the durable `update-keywords` / `update-feed-config` socket specs from that same source.
  - Kept transport-owned differences explicit by leaving pool-scoped recrawl submission and pool create/delete routes outside the new shared family, since those commands do not actually share the same patch-style transport shape.
  - Expanded `server/domain/tests.js` to assert direct REST/Socket.IO parity for pool keyword and feed-config decoding, and expanded `run-tests.js` so the live socket harness now proves `update-feed-config` dispatches the shared `merge-pool-feed-config` command path.
  - Updated `ROADMAP.md` and `FUNCTIONAL_REFACTOR_ROADMAP.md` so the repository records this Step 4 slice and names the current pool-transport checkpoint explicitly for the next agent.
- **Learning**: The useful abstraction here was another small cross-transport family, not a generalized pool DSL. Once the overlapping pool mutation facts became shared data, the route/socket differences that still matter became clearer because only the intentional transport-specific cases stayed outside the family.
- **Verification**: `npm test`, `npm run lint`, `npm --prefix client run build`, and `git diff --check` are the verification gate for this slice.

### 2026-07-16: Continued Step 4 with a Shared Socket Listener-Family Table
- **Goal**: Keep the active Step 4 readability pass moving by removing the last repeated socket command-listener registration ceremony in `server/sockets.js` without widening the transport layer or hiding the intentionally imperative telemetry and signed-URL handlers.
- **Implementation**:
  - Added `SOCKET_COMMAND_LISTENER_SPECS` in `server/domain/commands.js`, deriving one declarative listener-family table from the existing state-patch, durable-command, async-job, and secret-save socket metadata instead of leaving `server/sockets.js` to loop those families separately.
  - Refactored `server/sockets.js` around one small interpreter that specializes each listener family into the existing `createCommandListener(...)` shell, preserving explicit fallback resolution, async-job unavailable acknowledgements, and secret-save success/failure acknowledgements as transport-owned behavior.
  - Expanded `server/domain/tests.js` to assert that the unified listener-family table stays aligned with the underlying socket spec families, and expanded `run-tests.js` to prove every shared listener spec still registers a live socket handler through the integration harness.
  - Updated `ROADMAP.md` and `FUNCTIONAL_REFACTOR_ROADMAP.md` so the repository records this Step 4 slice and makes the current socket-readability checkpoint explicit for the next agent.
- **Learning**: The useful abstraction here was one tiny listener-family table, not another socket framework. Once the remaining registration ceremony became shared data plus one interpreter, `server/sockets.js` got shorter while the real transport-owned policies stayed explicit at the edge.
- **Verification**: `npm test`, `npm run lint`, and `npm --prefix client run build` are the verification gate for this slice.

### 2026-07-16: Fixed Side Designation Labels in Remote Direct Control Tab when Single Photo Layout is Active
- **Goal**: Ensure "Permanent Collection", "Allow Side-by-Side Pairing", and "Image Display Weight" labels in the Remote Control interface omit "(Left Photo)" / "(Right Photo)" suffixes when only a single photo is displayed on screen.
- **Implementation**:
  - Updated `client/src/components/remote/DirectControlTab.jsx` to check `isSplitLayoutActive` before appending side indicators (`(Left Photo)` / `(Right Photo)` / `(Left)` / `(Right)`).
  - Preserved side indicators when `isSplitLayoutActive` is `true` so side-by-side split screen view still clearly indicates which photo side is being modified.
- **Verification**: Verified via `npm test` (214 passing tests) and built client production bundle cleanly via `npm run build --prefix client`.

### 2026-07-16: Continued Step 4 with Shared Route-Local Specs for Remaining REST Single-Command Registrations
- **Goal**: Keep the active Step 4 readability pass moving by removing the remaining repeated `createCommandRoute(...)` registration ceremony in `server/routes.js` without exporting route-only presentation policy into the shared domain layer.
- **Implementation**:
  - Refactored `server/routes.js` around one small mixed-method route-spec registrar, then moved the remaining standalone REST single-command endpoints onto one local declarative table while keeping the existing `decode -> guard -> dispatch -> present` shell, custom senders, and route-specific guard/presentation behavior intact.
  - Left intentionally unique handlers such as Google auth/media routes, pool batch patches, async submissions, and live preview/photo batch flows explicit, so the new abstraction stops at the real repetition seam instead of becoming another route framework.
  - Expanded `run-tests.js` with direct regression coverage for the newly spec-driven `POST /api/photos/rate`, `POST /api/state/categories`, and `POST /api/state/screensaver` routes, so the refactor is verified through route invocation rather than only through broader live smoke coverage.
  - Updated `ROADMAP.md`, `FUNCTIONAL_REFACTOR_ROADMAP.md`, and `AGENTS.md` so the repository records this Step 4 slice and tightens the forward guidance to continue only where shared helpers are genuinely smaller and clearer than the explicit code they replace.
- **Learning**: The useful abstraction here was route-local metadata, not another command-module export. These handlers still own route presentation and guard behavior, so keeping the spec table inside `server/routes.js` preserves the imperative shell boundary while still removing the repeated registration ceremony.
- **Verification**: `npm test`, `npm run lint`, and `git diff --check` are the verification gate for this slice.

### 2026-07-14: Continued Step 4 with Shared Photo-Mutation Transport Specs
- **Goal**: Keep the active Step 4 readability pass moving by removing the last overlapping photo-mutation command inventory across the REST photo patch route and the durable socket photo listener table without hiding the intentional transport differences.
- **Implementation**:
  - Refactored `server/domain/commands.js` around one shared declarative photo-transport family, then derived the REST photo patch specs and the durable socket photo command specs from that same source instead of restating the decoder/fallback inventory in parallel.
  - Kept transport-owned behavior explicit by preserving route-only response shaping for rating, crop, pairing, broken, and loved patches, while leaving metadata reporting socket-only and loved-photo updates REST-only where those boundaries are intentional.
  - Expanded `server/domain/tests.js` with direct parity coverage proving that the overlapping REST and Socket.IO photo commands still decode to the same shared command shapes, while the route-only loved patch and socket-only metadata report remain explicit exceptions.
  - Updated `ROADMAP.md`, `FUNCTIONAL_REFACTOR_ROADMAP.md`, and `AGENTS.md` so the repository records this as the latest Step 4 slice and names the next likely seam explicitly.
- **Learning**: The useful abstraction here was one small cross-transport photo family, not another route or socket framework. Once the overlapping photo command facts became shared data, the transport differences that actually matter became easier to see because the accidental duplication disappeared.
- **Verification**: `npm test`, `npm run lint`, and `git diff --check` are the verification gate for this slice.

### 2026-07-14: Added Permanent Collection Loved Photos Through the Shared Photo Mutation Path
- **Goal**: Implement the permanent-collection idea without inventing another transport or persistence branch, so loved photos can survive crawler pruning while the active Step 4 shared-command architecture stays intact.
- **Implementation**:
  - Extended `server/domain/commands.js` and `server/domain/reducer.js` with a new `set-photo-loved` mutation that rides the same shared photo patch spec/reducer path already used for ratings, crop, pairing, and metadata.
  - Updated `server/services/crawler.js` so `capCollectionLimit(...)` now partitions originals, loved dynamic photos, and standard dynamic photos, preserving loved items while still keeping the rotating standard pool capped relative to the original curated seed set.
  - Wired `client/src/hooks/useLuminaActions.js`, `DirectControlTab.jsx`, and `ImageFeedsTab.jsx` to expose a REST-first "Permanent Collection" toggle with immediate optimistic snapshot patching in the initiating client.
  - Extended Google Photos metadata persistence helpers so loved flags survive the source-local external metadata path too, even though crawler pruning primarily matters for curated crawled feeds.
  - Added regression coverage in `server/domain/tests.js` and `run-tests.js` for loved command decoding, reducer persistence behavior, Google Photos metadata persistence, shared photo patch route decoding, live photo patch responses, and crawler-cap loved-photo preservation.
- **Learning**: The right abstraction was another tiny photo metadata command, not a separate “favorites” subsystem. Once loved became just one more shared photo patch plus one pure crawler partition rule, the feature fit the existing reducer/route/action composition cleanly and stayed easy to test.
- **Verification**: `npm test`, `npm run lint`, and `npm --prefix client run build` are the verification gate for this slice.

### 2026-07-14: Continued Step 4 with Shared REST Patch Command Specs
- **Goal**: Keep the active Step 4 readability pass moving by removing the remaining inline photo/pool REST patch command facts from `server/routes.js` without widening the route shell or changing wire behavior.
- **Implementation**:
  - Refactored `server/domain/commands.js` so photo patch mutations, pool patch mutations, and pool-scoped recrawl command decoding now live in shared pure spec data and helpers instead of route-local arrays.
  - Rewired `server/routes.js` to consume those exported spec rows through the existing `decode -> guard -> dispatch -> present` shell, leaving the route module focused on transport orchestration rather than command metadata inventory.
  - Expanded `server/domain/tests.js` with direct regression coverage for the shared photo patch specs, pool patch spec builder, and scoped recrawl decoder.
  - Updated `ROADMAP.md`, `FUNCTIONAL_REFACTOR_ROADMAP.md`, and `AGENTS.md` so the repository records this as the latest Step 4 slice while keeping the broader checkpoint intentionally open.
- **Learning**: The useful abstraction here was another small spec boundary, not a broader HTTP DSL. Once the remaining REST patch command facts became shared data, the route layer kept its explicit failure/guard/presentation behavior while dropping another pocket of transport-local command inventory.
- **Verification**: `npm test` and `npm run lint` are the verification gate for this slice.

### 2026-07-13: Continued Step 4 with Shared Cross-Transport Command Family Specs
- **Goal**: Keep the active Step 4 readability pass moving by removing the remaining duplicated command-family metadata across REST and Socket.IO without widening the shared dispatch shell or changing wire behavior.
- **Implementation**:
  - Refactored `server/domain/commands.js` so the admin-secret, async-job, and next/prev-photo families now derive their REST and Socket.IO transport specs from one shared declarative source instead of parallel per-transport tables.
  - Kept transport-owned behavior explicit by preserving route-only response shaping, socket-only fallback metadata, and the existing shared decoders while collapsing the repeated family facts into small spec builders.
  - Expanded `server/domain/tests.js` to assert cross-transport parity directly, proving the shared family metadata yields the same admin-secret and async-job command shapes across REST and Socket.IO while keeping socket playback advance on `smart` strategy and REST advance routes on `sequence`.
  - Updated `ROADMAP.md`, `FUNCTIONAL_REFACTOR_ROADMAP.md`, and `AGENTS.md` so the repository records this as the newest Step 4 slice while keeping the broader checkpoint intentionally open.
- **Learning**: The useful abstraction here was one transport-family source of truth, not another layer around the adapters. Once the family facts became shared data, the remaining REST and Socket.IO spec tables stayed explicit about transport-owned behavior while losing the parallel metadata drift risk.
- **Verification**: `npm test` passed, with the usual live smoke skip under sandbox `listen EPERM`. `npm run lint` passed.

### 2026-07-12: Continued Step 4 with Shared REST Route Specs for Repeated Command Families
- **Goal**: Keep the active Step 4 readability pass moving by removing the last repeated REST command-registration ceremony without widening the shared dispatch shell or changing route behavior.
- **Implementation**:
  - Added declarative shared REST route specs in `server/domain/commands.js` for the admin-secret, async-job, and sequence-advance photo POST families.
  - Refactored `server/routes.js` to register those route families through small shared helpers, so the transport layer now specializes route metadata through the existing `createCommandRoute(...)` and `createEffectSubmissionRoute(...)` shells instead of repeating inline `app.post(...)` command setup.
  - Expanded `server/domain/tests.js` with direct assertions against the new REST route specs, covering both admin-secret endpoints, both async job families, and both advance-photo directions through the shared command shape.
  - Expanded `run-tests.js` with route regressions for `POST /api/admin/secrets/tumblr-api-key` and `POST /api/photos/prev`, proving the spec-driven registration still dispatches the expected shared commands and response shapes.
  - Updated `ROADMAP.md`, `FUNCTIONAL_REFACTOR_ROADMAP.md`, and `AGENTS.md` so the repository records this as the latest Step 4 slice while keeping the broader checkpoint intentionally open.
- **Learning**: The useful abstraction here was a tiny route-spec table, not another HTTP framework. Once the repeated POST families became plain metadata plus one registration helper, `server/routes.js` got shorter without hiding the existing decode/guard/dispatch/present boundary that still matters operationally.
- **Verification**: `npm test` passed with 176 assertions. `npm run lint` passed. The existing sandbox-only live smoke skip still reports `listen EPERM` when the temporary Unix socket bind is attempted.

### 2026-07-12: Continued Step 4 with Declarative `patch-state` Reducer Specs
- **Goal**: Keep the active Step 4 readability pass moving by removing the remaining hand-built `patch-state` reducer handler chain without widening the shared state contract or transport boundary.
- **Implementation**:
  - Refactored `server/domain/reducer.js` so `patch-state` now runs through declarative spec rows for scalar config fields, excluded keywords, widgets, `visionConfig`, `autoLocation`, and manual location.
  - Added a small pure `read -> compare -> apply -> flag` interpreter in the reducer, preserving the existing recompute-photos and refresh-weather semantics while making the durable patch surface read as data instead of bespoke branching.
  - Expanded `server/domain/tests.js` with regression coverage that proves the spec-driven reducer ignores unknown widget keys while still composing recompute and weather-refresh follow-up flags correctly.
  - Updated `ROADMAP.md`, `FUNCTIONAL_REFACTOR_ROADMAP.md`, and `AGENTS.md` so the repository records this as the newest Step 4 slice while keeping the broader checkpoint intentionally open.
- **Learning**: The useful abstraction here was a reducer-local patch spec table, not another general command framework. Once `patch-state` became one tiny interpreter over shared spec rows, the durable config surface became easier to extend because new fields now fit the same explicit `read -> compare -> apply -> flag` shape.
- **Verification**: `npm test` and `npm run lint` are the verification gate for this slice.

### 2026-07-12: Continued Step 4 with a Shared `patch-state` Contract Module
- **Goal**: Keep the active Step 4 readability pass moving by removing the remaining duplicated `patch-state` contract inventory and normalization logic without broadening the reducer or transport surface.
- **Implementation**:
  - Added `server/domain/statePatch.js` as one pure boundary for the shared scalar `patch-state` field list plus the canonical `visionConfig` and manual-location normalization helpers.
  - Refactored `server/domain/commands.js` to build `patch-state` commands through that shared contract instead of carrying its own scalar field reducer and duplicate normalizers.
  - Refactored `server/domain/reducer.js` to apply scalar `patch-state` updates through the same shared field inventory, removing the last parallel scalar list from the reducer boundary.
  - Expanded `server/domain/tests.js` with regression coverage that proves the shared scalar `patch-state` fields decode and apply consistently through the command and reducer path.
  - Updated `ROADMAP.md`, `FUNCTIONAL_REFACTOR_ROADMAP.md`, and `AGENTS.md` so the repo records this as the newest Step 4 slice while keeping the broader checkpoint intentionally open.
- **Learning**: The useful abstraction here was one small contract module, not another reducer framework. Once `patch-state` stopped carrying parallel field inventories and normalizers in separate modules, the decode and reducer stages became easier to trust because their shared durable surface is now explicit in one place.
- **Verification**: `npm test` and `npm run lint` passed. The existing sandbox-only live smoke skip still reports `listen EPERM` when the temporary Unix socket bind is attempted.

### 2026-07-12: Continued Step 4 with Shared Durable Socket Command Specs
- **Goal**: Keep the active Step 4 readability pass moving by removing the remaining durable socket command-registration tables from `server/sockets.js` without hiding the transport-only fallback and acknowledgement behavior.
### 2026-07-17: Dynamic Fit-Content Sizing for Clock Widget Glass Backdrop
- **Goal**: Prevent the glassmorphic blurry background container beneath the clock widget from occupying an oversized 450px rectangular area when time digits take little horizontal space (e.g. 1:11 vs 12:58).
- **Implementation**:
  - Replaced fixed `min-width: 450px` on `.clock-widget` in `client/src/index.css` with `width: fit-content`, allowing the glass container to shrink-wrap snugly around the clock time and date with standard padding.
  - Added `font-variant-numeric: tabular-nums` and `white-space: nowrap` on `.clock-time` and `white-space: nowrap` on `.clock-date` to keep clock digits steady and clean across layout changes.
- **Learning**: Fixed minimum width rules on glass container cards create awkward empty translucent space when content dynamically varies in size. Shrink-wrapping with `width: fit-content` preserves aesthetics across all digit variations.
- **Verification**: `npm test` passed 217 diagnostic assertions. `npm --prefix client run build` built successfully.

### 2026-07-12: Continued Step 4 with Shared Socket Command Specs
  - Refactored `server/sockets.js` to register those specs through small shared decode/fallback helpers, leaving the socket layer with only transport-owned compatibility resolution, unavailable-job acknowledgements, secret-save acknowledgements, telemetry, and Google Photos URL refresh behavior.
  - Expanded `server/domain/tests.js` to assert the shared durable socket command, async-job, and secret-save specs directly, so the regression coverage now targets the actual event/decode metadata instead of another local registration copy.
  - Updated `ROADMAP.md`, `FUNCTIONAL_REFACTOR_ROADMAP.md`, and `AGENTS.md` so the repo records this as the newest Step 4 slice while keeping the broader checkpoint intentionally open.
- **Learning**: The useful abstraction here was another small spec table, not a broader socket framework. Once the remaining durable socket handlers became shared event/decode metadata, `server/sockets.js` could stay explicit about transport-only responsibilities while dropping the repeated registration inventory.
- **Verification**: `npm test` and `npm run lint` are the verification gate for this slice.

### 2026-07-12: Continued Step 4 with Shared Durable Socket State-Patch Specs
- **Goal**: Keep the active Step 4 readability pass moving by removing the last repeated socket state-patch decoder assembly without changing the existing Socket.IO event contracts.
- **Implementation**:
  - Moved the durable socket state-patch event specs into `server/domain/commands.js`, so the shared command module now owns the declarative `event -> patch builder -> patch-state command` mapping instead of rebuilding the decoders in `server/sockets.js`.
  - Refactored `server/sockets.js` to register those shared specs directly, leaving the transport layer with only wiring and fallback policy instead of another pocket of patch-decoder assembly.
  - Reused the shared `STATE_PATCH_FIELDS` list in `server/socketLegacyCompatibility.js`, so the compatibility fallback and the shared command decoder stop carrying parallel scalar field inventories.
  - Expanded `server/domain/tests.js` to assert against the exported shared socket state-patch specs directly, which keeps the regression coverage on the actual transport command boundary instead of on locally rebuilt test helpers.
  - Updated `ROADMAP.md`, `FUNCTIONAL_REFACTOR_ROADMAP.md`, and `AGENTS.md` so the repo records this as the newest Step 4 slice while keeping the broader checkpoint intentionally open.
- **Learning**: The useful abstraction here was not another listener factory, but one small shared spec table. Once the durable socket settings boundary became plain spec data owned by the command module, both the transport adapter and the fallback/test seams got smaller without losing readability.
- **Verification**: `npm test` and `npm run lint` are the verification gate for this slice.

### 2026-07-12: Continued Step 4 with Shared Reducer Specs for Playback Selection Commands
- **Goal**: Keep the active Step 4 readability pass moving by removing the last repeated playback-selection reducer ceremony without hiding preview-feed staging or navigation policy.
- **Implementation**:
  - Refactored `server/domain/reducer.js` around one narrow playback-command reducer-spec helper, so `set-active-photo` and `advance-photo` now express only their payload readers, photo-selection policy, direction policy, and optional feed-staging behavior while sharing the repeated `select -> activate -> emit photo update` shell.
  - Preserved the existing behavior: preview photos still get staged into the visible feed when needed, sequence and smart navigation still choose photos through the same selectors, and unresolved target URLs still stay silent as no-ops.
  - Expanded `server/domain/tests.js` with direct regression coverage for preview-photo staging and missing-photo no-op semantics through the new shared playback reducer boundary.
  - Updated `ROADMAP.md`, `FUNCTIONAL_REFACTOR_ROADMAP.md`, and `AGENTS.md` so the repo records this as the newest Step 4 slice while keeping the broader checkpoint intentionally open.
- **Learning**: The useful abstraction here was another tiny reducer-spec interpreter, not a generalized playback DSL. Once the shared shell owned only `select -> maybe stage -> activate`, the interesting behavior stayed explicit because each spec still owns the only domain-specific choices: where the photo comes from and whether the visible feed needs patching first.
- **Verification**: `npm test` and `npm run lint` are the verification gate for this slice.

### 2026-07-12: Continued Step 4 with Shared Reducer Specs for Remaining Pool Commands
- **Goal**: Keep the active Step 4 readability pass moving by removing the last repeated reducer ceremony across pool creation and pool-config mutations without flattening their distinct persistence and crawler behaviors.
- **Implementation**:
  - Refactored `server/domain/reducer.js` around one narrow pool-command reducer-spec helper, so `add-pool`, `set-pool-keywords`, and `merge-pool-feed-config` now express only their payload readers, mutation policy, and optional side effects while sharing the repeated persistence/no-op shell.
  - Kept `delete-pool` on the separate feed-mutation path, preserving the existing `recompute -> ensure active photo -> emit` flow while limiting the new helper strictly to the pool commands that still shared the simpler `read -> apply -> persist/effect` pattern.
  - Expanded `server/domain/tests.js` with direct no-op coverage for duplicate pool creation and invalid feed-config payloads through the new shared reducer boundary.
  - Updated `ROADMAP.md` and `FUNCTIONAL_REFACTOR_ROADMAP.md` so the repo records this as the newest Step 4 slice while keeping the broader checkpoint intentionally open.
- **Learning**: The useful abstraction here was another tiny reducer-spec interpreter, not a generalized pool DSL. Once pool creation and pool-config commands became payload readers plus one explicit shell, the interesting behavior stayed visible because the only things left in each spec were the actual policy choices: create, persist, crawl, or silently no-op.
- **Verification**: `npm test` passed with 165 assertions. `npm run lint` is the remaining verification gate for this slice.

### 2026-07-12: Continued Step 4 with Shared Reducer Specs for Feed Mutations
- **Goal**: Keep the active Step 4 readability pass moving by removing the remaining repeated reducer ceremony across feed-mutating commands without flattening their distinct reselection and persistence policies.
- **Implementation**:
  - Refactored `server/domain/reducer.js` around one narrow feed-command reducer-spec helper, so `select-categories`, `update-excluded-keywords`, and `delete-pool` now express only their payload normalization and mutation policy while sharing the repeated `apply -> recompute -> finalize playback` interpreter.
  - Preserved the existing command semantics: category selection still forces photo reselection and emits `photo-update`, excluded-keyword clears still persist and recompute, and invalid pool deletions still short-circuit as no-ops.
  - Expanded `server/domain/tests.js` with direct regression coverage for forced reselection, exclusion clearing, and invalid delete no-op behavior through the new shared reducer boundary.
  - Updated `ROADMAP.md` and `FUNCTIONAL_REFACTOR_ROADMAP.md` so the repo records this as the newest Step 4 slice while keeping the broader checkpoint intentionally open.
- **Learning**: The useful abstraction here was another tiny reducer-spec interpreter, not a generic mutation framework. Once the feed-affecting branches became payload readers plus one shared finalization boundary, the remaining command-specific behavior stayed obvious because the only things left in each spec were the actual policy choices.
- **Verification**: `npm test` and `npm run lint` are the verification gate for this slice.

### 2026-07-12: Continued Step 4 with Shared Route Decoder-Spec Pipelines for Photo and Pool Patches
- **Goal**: Keep the active Step 4 readability pass moving by removing the last hand-built optional-command decode ceremony from the shared REST photo/pool patch routes without changing their wire contracts.
- **Implementation**:
  - Refactored [server/routes.js](file:///home/alex/work/lumina/server/routes.js) around one tiny optional-command spec interpreter, so photo and pool patch decoders now express their mutation fields as declarative spec data instead of repeating `decodeOptionalCommandPart(...)` wrapper calls inline.
  - Rewrote the `PATCH /api/photos` and `PATCH /api/pools/:name` decode paths to build their command batches through those shared spec pipelines while keeping the existing validation messages, command order, and response shaping intact.
  - Expanded [run-tests.js](file:///home/alex/work/lumina/run-tests.js) with a batch pool-patch regression that proves keywords plus multi-source feed-config updates still dispatch in deterministic order through the new decoder boundary.
  - Updated `ROADMAP.md` and `FUNCTIONAL_REFACTOR_ROADMAP.md` so the repo records this as the newest Step 4 slice while keeping the broader checkpoint intentionally open.
- **Learning**: The useful abstraction here was another small lawful interpreter, not a new HTTP DSL. Once optional route mutations became plain spec rows plus one collector, the route layer stayed readable because each mutation still owns the only interesting part: its payload policy and validation message.
- **Verification**: `npm test` passed with 162 assertions. `npm run lint` passed.

### 2026-07-12: Continued Step 4 with Shared Transport Command-Decoder Specs
- **Goal**: Keep the active Step 4 readability pass moving by removing the remaining repeated transport decode ceremony in `server/domain/commands.js` without changing the existing REST or Socket.IO wire contracts.
- **Implementation**:
  - Added small pure decoder helpers in `server/domain/commands.js` for shared command construction, required-value validation, optional field normalization, and photo/pool decoder specialization.
  - Rewrote the repeated photo and pool decoders to specialize those helpers as data, so the transport layer now reads as `require value -> normalize payload -> build command` instead of repeating the same guard shell for each mutation.
  - Expanded `server/domain/tests.js` with direct assertions for active-photo preview decoding and partial photo-crop decoding so the new shared decoder boundary is covered explicitly.
  - Updated `ROADMAP.md` and `FUNCTIONAL_REFACTOR_ROADMAP.md` so the repo records this as the latest Step 4 slice while keeping the broader checkpoint active.
- **Learning**: The right abstraction here was another tiny spec boundary, not a full parser DSL. Once the required-value guard and payload normalization steps became shared helpers, the decoder layer stayed readable because each command still owns the only interesting part: how its payload is shaped.
- **Verification**: `npm test` passed with 162 assertions. `npm run lint` passed after removing two unused Google Photos test imports from `run-tests.js`.

### 2026-07-12: Implemented Local Offline Caching for Google Photos
- **Goal**: Resolve the 7-day session expiration and 60-minute URL expiration limitations of Google's public APIs by caching selected photo files locally.
- **Implementation**:
  - Defined a local cache directory `server/config/google_photos_media/` to store image files.
  - Implemented pure functional helpers `difference` and `getOrphanedFiles` in [googlePhotos.js](file:///home/alex/work/lumina/server/services/googlePhotos.js) to compute orphaned files when syncing new items.
  - Added background downloader `downloadSyncMediaItems` and file cleanup `cleanOrphanedMediaFiles` in [googlePhotos.js](file:///home/alex/work/lumina/server/services/googlePhotos.js) to run on album sync.
  - Modified `fetchMediaItemBytes` to serve files from local disk when available, and lazy-download and write to disk on success (self-healing cache).
  - Added full unit and integration tests to [run-tests.js](file:///home/alex/work/lumina/run-tests.js) verifying local serving, lazy caching, set difference, and cleanup.
- **Learning**: The 7-day Picker session limit is a hard security feature of Google's public APIs. Instead of attempting fragile API hacks, downloading only the user's selected photos locally on-demand provides permanent, offline-capable screensaver playback with minimal disk footprint.
- **Verification**: `npm test` passed successfully with 189 assertions.

### 2026-07-11: Extended Per-Image Crop Zoom Beyond Cover
- **Goal**: Let operators zoom past the old cover ceiling for framed or matted images without loosening unrelated percentage fields like vertical crop position or split-balance controls.
- **Implementation**:
  - Added a dedicated server-side `cropPercent` validator so per-photo zoom now accepts `0..200` while `cropPositionY` and other true percentages remain `0..100`.
  - Raised the Direct Control and Image Feeds rating-deck crop sliders to the new per-photo max and clarified the UI copy so `100%` is understood as the cover point rather than the maximum zoom.
  - Centralized the client-side photo-crop defaults/blend math in `client/src/state/photoCrop.js` so the remote preview surfaces keep the same contain/cover baseline while allowing extra zoom headroom.
  - Expanded regression coverage so route decoding now rejects only values above the new max and live photo patch tests explicitly verify crop values greater than `100`.
- **Learning**: The old limit was not in the render math; it was the contract. The slideshow and preview code already extrapolated cleanly past cover, so the real fix was to widen the persisted `cropPercent` range without broadening every other percentage validator in the system.
- **Verification**: `npm test` and `npm --prefix client run build` passed.

### 2026-07-11: Continued Step 4 with Shared Reducer Specs for Photo Library Commands
- **Goal**: Keep the active Step 4 readability pass moving by removing the remaining inline reducer ceremony across the shared photo-library command branches without hiding their distinct playback rules.
- **Implementation**:
  - Refactored `server/domain/reducer.js` so `rate-photo`, `mark-photo-broken`, `set-photo-crop`, `set-photo-prevent-pairing`, and `report-photo-metadata` now register through one small photo-command reducer-spec table.
  - Kept the command-specific behavior as data: each spec still owns its updater, persisted metadata patch, and playback finalizer (`recompute`, `preserve`, or `keep`) while the shared helper owns only the repeated `url -> update -> persist -> emit` ceremony.
  - Added regression coverage in `server/domain/tests.js` for equality-aware no-op behavior across the shared photo reducer specs, alongside the existing crop, pairing, ban, and Google Photos metadata assertions.
  - Updated `ROADMAP.md` and `FUNCTIONAL_REFACTOR_ROADMAP.md` so the active Step 4 checkpoint records this reducer-focused slice while remaining intentionally selective.
- **Learning**: The useful abstraction here was another tiny reducer-spec boundary, not a broader photo DSL. Once the photo commands became plain data plus one interpreter, the reducer kept the interesting playback semantics visible while the copy-pasted metadata plumbing disappeared.
- **Verification**: `npm test`, `npm run lint`, and `npm --prefix client run build` passed.

### 2026-07-11: Continued Step 4 with Shared Reducer Specs for Simple Setter and Effect Commands
- **Goal**: Keep the active Step 4 readability pass moving by removing the remaining repeated reducer ceremony for the simplest setter and effect-bearing commands without turning the reducer into a framework.
- **Implementation**:
  - Refactored `server/domain/reducer.js` around a few narrow helpers for command-local state mutation, field assignment, and effect-result construction, then moved the simple setter/effect branches onto one shared reducer-spec table.
  - Standardized the branches for split layout, crop split percentage, scale mode, theme, slideshow interval, screensaver activation, admin-secret persistence, and async job triggers so they now reuse shared field/effect builders instead of repeating small state-update and payload-shaping blocks.
  - Added regression coverage in `server/domain/tests.js` for the positive and no-op behavior of the shared setter reducers plus the silent invalid admin-secret payload case.
  - Updated `ROADMAP.md` and `FUNCTIONAL_REFACTOR_ROADMAP.md` so the current Step 4 checkpoint records this reducer-focused slice while staying intentionally open only for clearly repetitive future seams.
- **Learning**: The useful abstraction here was a tiny reducer-spec algebra, not a command framework. Once the simplest branches became data plus a couple of local interpreters, the reducer kept its explicit switch for the complex cases while the repetitive field/effect ceremony disappeared.
- **Verification**: `npm test` and `npm run lint` are the verification gate for this slice.

### 2026-07-11: Continued Step 4 with Declarative Socket Listener Specs
- **Goal**: Keep the active Step 4 readability pass moving by removing the last repeated socket command-registration ceremony without hiding the intentionally imperative telemetry and signed-URL refresh handlers.
- **Implementation**:
  - Refactored `server/sockets.js` around small listener-spec helpers, so durable socket state-patch, photo, pool, async-job, and admin-secret commands now register through declarative spec data instead of a long repeated `listenForCommand(...)` sequence.
  - Kept the socket-only shell behaviors explicit: viewport/media-failure telemetry, second-photo sync, disconnect lifecycle, and on-demand Google Photos URL refresh still sit outside the shared command-registration boundary.
  - Added regression coverage in `run-tests.js` for declarative state-patch dispatch, explicit async-job fallback acknowledgements when no dispatcher is available, and secret-save failure acknowledgements through the shared listener-spec path.
  - Updated `ROADMAP.md` and `FUNCTIONAL_REFACTOR_ROADMAP.md` so the active Step 4 checkpoint records this slice while remaining open for only clearly repetitive future seams.
- **Learning**: The right abstraction here was a small registration algebra, not another transport framework. Once socket command listeners became plain data plus a single interpreter, the durable mutation section read compositionally while the truly imperative socket tail remained obvious.
- **Verification**: `npm test` and `npm run lint` are the verification gate for this slice.

### 2026-07-11: Continued Step 4 with Shared Route-Decode Composition
- **Goal**: Keep the active Step 4 readability pass moving by removing the last hand-rolled REST mutation decode batching and follow-up validation seams without disturbing the shared dispatch-route shell.
- **Implementation**:
  - Added `server/utils/routeDecode.js` as a tiny pure success/failure algebra with `collect`, `map`, and `chain` helpers so route decoding can short-circuit predictably without scattering nullable command checks.
  - Refactored `server/routes.js` so the photo patch, pool patch, keyword, and preview decoders now compose as explicit `decode -> collect -> map/chain` pipelines, with field-specific failures such as invalid crop bounds or bad source-config payloads returned before dispatch.
  - Added regression coverage in `run-tests.js` for the new route-decode helper layer and for shared route-shell short-circuiting on invalid pool feed-config and photo crop decode failures.
  - Updated `ROADMAP.md` and `FUNCTIONAL_REFACTOR_ROADMAP.md` so the repo records the new route-decode slice while keeping the broader Step 4 checkpoint active.
- **Learning**: The useful abstraction here was a tiny lawful decode result, not a broader transport DSL. Once route decode success/failure became composable data, the remaining REST mutation decoders collapsed into small pipelines and the dispatch shell stayed unchanged.
- **Verification**: `npm test` and `npm run lint` passed. The existing sandbox-only live smoke skip still reports `listen EPERM` when the temporary Unix socket bind is attempted.

### 2026-07-11: Continued Step 4 with Dispatcher-Local Effect Sequencing Helpers
- **Goal**: Keep the active Step 4 readability pass moving by removing the remaining repeated command/effect ceremony in `server/domain/dispatch.js` without turning the dispatcher into a framework.
- **Implementation**:
  - Refactored `server/domain/dispatch.js` around a few small shell helpers: sequential effect interpretation, event emission, manual-override effect runners, env/runtime payload normalization, and fail-safe weather-refresh handling.
  - Kept the dispatch flow explicit as `reduce -> apply snapshot -> interpret effects -> emit events`, while moving the repeated payload-shape and `typeof handler === 'function'` plumbing behind narrow helpers instead of duplicating it across effect cases.
  - Tightened `server/domain/types.js` so the shared JSDoc contract now includes `patch-state` commands and `refresh-weather` effects, matching the live reducer/effect surface.
  - Added regression coverage in `run-tests.js` for the shared kiosk-kill helper path and for the rule that a failed `refresh-weather` effect logs once but does not abort the enclosing state update or broadcast.
  - Updated `ROADMAP.md` and `FUNCTIONAL_REFACTOR_ROADMAP.md` so the current Step 4 checkpoint records this dispatcher-focused slice while staying open for future clearly repetitive seams only.
- **Learning**: The useful abstraction here was a tiny interpreter boundary, not a generic dispatcher DSL. Once effect sequencing, payload normalization, and fail-safe shell behaviors each had one named helper, the dispatcher became easier to extend without hiding the actual order of work.
- **Verification**: `npm test` and `npm run lint` passed. The existing sandbox-only live smoke skip still reports `listen EPERM` when the temporary Unix socket bind is attempted.

### 2026-07-11: Continued Step 4 with One Shared REST Dispatch-Route Shell
- **Goal**: Keep the active Step 4 readability pass moving by removing the remaining duplicate route-shell ceremony across command, batch-command, and async effect-submission handlers without hiding route-specific validation or response shaping.
- **Implementation**:
  - Refactored `server/routes.js` around one shared `createDispatchRoute(...)` boundary, so the higher-level route helpers now specialize the same `decode -> guard -> preflight -> dispatch -> present` flow instead of re-implementing overlapping error and dispatcher logic.
  - Preserved the route-specific behavior as data: command routes still own no-op semantics and custom response senders, batch routes still reject empty mutation sets before dispatch, and async job routes still validate extracted effect submissions before returning `202 Accepted`.
  - Added regression coverage in `run-tests.js` for the restored photo-batch preflight rejection and for the `PATCH /api/state` no-op path that must keep its raw state response shape even when the shared command route produces no reducer events or effects.
  - Updated `ROADMAP.md` and `FUNCTIONAL_REFACTOR_ROADMAP.md` so the active Step 4 checkpoint now records the new shared dispatch-route shell while leaving the broader readability pass open.
- **Learning**: The right abstraction here was a tiny route-plan algebra, not a larger HTTP DSL. Once each route kind could describe its own guards, preflight checks, dispatch step, and post-dispatch validation as data, the shell stopped repeating itself without becoming opaque.
- **Verification**: `npm test` and `npm run lint` passed. The existing sandbox-only live smoke skip still reports `listen EPERM` when the temporary Unix socket bind is attempted.

### 2026-07-11: Continued Step 4 with Shared Keyword-Spec Normalization and Route Unification
- **Goal**: Keep the active Step 4 readability pass moving by removing the last direct keyword-config mutation route and expressing timed keyword specs through one pure normalization/equality boundary.
- **Implementation**:
  - Added `server/utils/keywordSpecs.js` so keyword entries now share small pure helpers for trimming, timed-spec normalization, deep equality, cloning, and feed-config term projection.
  - Refactored `server/domain/commands.js`, `server/domain/reducer.js`, `server/domain/snapshot.js`, `server/config/collectionsCodec.js`, and `server/config/state.js` to reuse that same helper layer, preserving time-scoped keyword objects through decode, reducer updates, snapshot cloning, and persisted config loading.
  - Rewired `POST /api/config/keywords` in `server/routes.js` onto the shared guarded command shell by decoding straight to `set-pool-keywords` instead of mutating `state.searchKeywords` and persisting inline.
  - Added regression coverage in `server/domain/tests.js` and `run-tests.js` for timed keyword-spec decoding, equality-aware no-op reducer behavior, and the keyword route's shared-command dispatch path.
  - Updated `ROADMAP.md` and `FUNCTIONAL_REFACTOR_ROADMAP.md` so the repo records this latest Step 4 slice while keeping the broader readability pass active.
- **Learning**: The useful abstraction here was not a new keyword subsystem; it was one small lawful normalization boundary. Once timed keyword specs had one canonical shape plus one equality rule, the old route-local mutation logic collapsed naturally into the same command path as the rest of the pool state.
- **Verification**: `npm test` passed. The existing sandbox-only live smoke skip still reports `listen EPERM` when the temporary Unix socket bind is attempted.

### 2026-07-10: Continued Step 4 with Decode-Aware Photo Mutation Route Composition
- **Goal**: Keep the active Step 4 readability pass moving by removing the last ad hoc photo mutation and preview wrappers from the REST shell without losing the route-specific photo lookup behavior.
- **Implementation**:
  - Extended `server/routes.js` with small decode-result helpers so shared command, batch-command, and async-submission route factories can surface custom decode-phase failures instead of forcing transport-local wrapper handlers.
  - Rewired `PATCH /api/photos` onto the shared batch-command route directly, adding a pre-dispatch photo-existence guard so missing photo mutations now fail at the shell boundary instead of silently dispatching no-op command batches.
  - Rewired `POST /api/photos/preview` onto the shared command route while preserving the payload-photo preview fallback for items that are not already in the active feed snapshot.
  - Added regression coverage in `run-tests.js` for photo batch decode failures, missing-photo guard failures, and the preview route's shared-command dispatch path.
- **Learning**: The useful next Step 4 abstraction was not another special-case photo helper, but a small decode-result algebra for the route shell. Once route factories could express custom decode failures, the remaining photo wrappers collapsed into the same declarative transport pipeline as the pool routes.
- **Verification**: `npm test` and `npm run lint` passed. The existing sandbox-only live smoke skip still reports `listen EPERM` when the temporary Unix socket bind is attempted.

### 2026-07-10: Continued Step 4 with Guarded REST Mutation Route Composition
- **Goal**: Keep the active Step 4 readability pass moving by collapsing the remaining repeated REST mutation-route ceremony without hiding route-specific validation or response shaping.
- **Implementation**:
  - Refactored `server/routes.js` so single-command, batch-command, and async effect-submission handlers now share one guard-aware boundary for `decode -> guard -> dispatch -> present`, with dynamic not-found and missing-submission messages still owned by each route.
  - Rewired the pool mutation routes (`POST /api/pools`, `DELETE /api/pools/:name`, `PATCH /api/pools/:name`, `PATCH /api/pools/:name/feed-sources/:source`, and `POST /api/pools/:name/crawl`) onto that shared shell, replacing bespoke dispatcher/existence checks with small pool guard helpers.
  - Added regression coverage in `run-tests.js` for duplicate-pool rejection, missing-pool guard failures on batch and async-job routes, and the existing-pool feed-source patch success path through the new shared route boundary.
  - Updated `ROADMAP.md` and `FUNCTIONAL_REFACTOR_ROADMAP.md` so the repo records this latest Step 4 slice while keeping the broader readability pass open.
- **Learning**: The useful abstraction here was a tiny validation semigroup at the shell edge, not a full route DSL. Once guards became explicit data passed into the shared route factories, the pool routes read as declarative transport code again without losing their concrete HTTP behavior.
- **Verification**: `npm test` and `npm run lint` passed. The existing sandbox-only live smoke skip still reports `listen EPERM` when the temporary Unix socket bind is attempted.

### 2026-07-10: Continued Step 4 with Shared Feed-Mutation Finalization Helpers
- **Goal**: Keep the active Step 4 readability pass moving by collapsing the remaining repeated reducer ceremony around feed recomputation, active-photo finalization, and persistence-bearing library mutations without changing the high-signal command branches.
- **Implementation**:
  - Refactored `server/domain/reducer.js` so category selection, excluded-keyword updates, and pool deletion now share one selective `reduceFeedMutation(...)` boundary that composes `apply -> recomputeFeed -> ensureActivePhoto -> emit/persist` instead of open-coding that pipeline in each branch.
  - Added an equality-aware `assignExcludedKeywords(...)` helper so `update-excluded-keywords` now stays fully silent when the trimmed effective keyword list is already active, matching the no-op discipline already established for patch-state and pool/config mutations.
  - Added regression coverage in `server/domain/tests.js` and `run-tests.js` for normalized excluded-keyword no-ops, preserving the rule that reducer and dispatcher layers should not emit events or persistence effects when nothing durable changes.
  - Updated `ROADMAP.md` and `FUNCTIONAL_REFACTOR_ROADMAP.md` so the active Step 4 checkpoint records the new shared feed-finalization slice while keeping the broader readability pass open.
- **Learning**: The useful abstraction here was a tiny composition boundary for feed-affecting mutations, not a generic reducer framework. Once the shared `recompute -> ensure -> emit` tail existed in one place, the command branches became easier to read precisely because they now only describe their actual state mutation.
- **Verification**: `npm test` and `npm run lint` are the intended verification gate for this slice.

### 2026-07-10: Continued Step 4 with Shared Async Effect Submission Helpers
- **Goal**: Keep Step 4 moving by removing the repeated async `dispatch -> effect extraction -> 202 response` ceremony from the shell boundary without hiding route-specific validation or presentation.
- **Implementation**:
  - Refactored `server/domain/dispatch.js` so payload-driven optional effects (`persist-external-photo-metadata`, `run-crawler`, `start-recrawl-job`, `start-vision-analysis-job`) now share small effect-runner helpers instead of repeating the same `typeof handler === 'function'` payload plumbing.
  - Added `createEffectSubmissionRoute(...)` in `server/routes.js`, then rewired `POST /api/jobs/recrawl`, `POST /api/jobs/vision-analysis`, and `POST /api/pools/:name/crawl` to share one explicit `decode -> dispatch -> extract submission -> present` path with the same 503 handling when no job snapshot is produced.
  - Added regression coverage in `run-tests.js` for shared vision-analysis effect interpretation in the dispatcher and for the recrawl route's missing-submission failure path, while preserving the existing accepted-job route assertions.
  - Updated `FUNCTIONAL_REFACTOR_ROADMAP.md` to record this Step 4 slice while keeping the overall checkpoint active.
- **Learning**: The useful abstraction here was not a generic route DSL; it was one tiny async submission boundary that treats reducer effects as a first-class contract. That keeps the shell composable while leaving per-route validation and response shape obvious.
- **Verification**: `npm test` and `npm run lint` passed. The existing sandbox-only live smoke skip still reports `listen EPERM` when the temporary Unix socket bind is attempted.

### 2026-07-10: Continued Step 4 with Pool/Feed-Config Reducer Combinators and No-Op Guardrails
- **Goal**: Keep the implementation-companion Step 4 readability pass moving by collapsing the remaining repeated pool/config reducer ceremony without hiding the more complex playback-recompute branches.
- **Implementation**:
  - Refactored `server/domain/reducer.js` so pool lifecycle/config branches now share small reducer-local helpers for pool-name normalization, equality-aware keyword replacement, source-config merging, and pool removal setup instead of repeating clone/validate/persist scaffolding inline.
  - Added content-aware equality for small config objects so array-backed source settings like `subreddits` and `keywords` no longer trigger persistence or broadcasts when the normalized effective config is unchanged.
  - Kept the delete-pool playback recompute path explicit while reusing the new removal helper, preserving readability by standardizing only the truly repetitive parts of the command/effect pipeline.
  - Added regression coverage in `server/domain/tests.js` and `run-tests.js` for no-op pool keyword updates, no-op feed-config merges, and dispatcher silence when those commands do not change durable state.
  - Updated `ROADMAP.md` and `FUNCTIONAL_REFACTOR_ROADMAP.md` so the repo still points to Step 4 as the active checkpoint while recording that the pool/config slice is now complete.
- **Learning**: The right Step 4 abstraction here was a small semigroup-like merge boundary for pool config plus explicit no-op detection, not a generic mutation framework. Repeated ceremony disappeared, but the delete/recompute branch still reads plainly because it stayed concrete.
- **Verification**: `npm test` and `npm run lint` passed. The existing sandbox-only live smoke skip still reports `listen EPERM` when the temporary Unix socket bind is attempted.

### 2026-07-10: Continued Step 4 with Declarative Config Mutation Helpers and Dispatcher Handler Tables
- **Goal**: Carry the active implementation-companion Step 4 checkpoint forward by cleaning up the remaining ad hoc command/effect seams after the earlier photo-mutation and result-shape standardization.
- **Implementation**:
  - Refactored `server/domain/reducer.js` so simple config/runtime setter commands now share a small `reduceStateMutation(...)` helper with proper no-op semantics instead of each branch cloning state and emitting events manually.
  - Reworked the `patch-state` reducer branch into a declarative sequence of focused patch appliers for scalar config fields, excluded keywords, widgets, vision config, and location settings, with equality-aware checks that avoid redundant persistence or weather refreshes when the incoming payload is already normalized.
  - Refactored `server/domain/dispatch.js` to use explicit effect and event handler tables, so the shell now reads as `reduce -> apply snapshot -> interpret effects -> emit events` rather than a long conditional ladder.
  - Added regression coverage in `server/domain/tests.js` for identical `visionConfig` / `manualLocation` no-op patches and unchanged setter commands, plus `run-tests.js` coverage for dispatcher event ordering, kiosk launch effects, effect-only recrawl dispatch, and shared external-photo persistence interpretation.
  - Updated `FUNCTIONAL_REFACTOR_ROADMAP.md` to record this as the next completed Step 4 slice while keeping the broader readability pass active.
- **Learning**: The next useful abstraction layer was not a deeper algebra of commands, but a pair of very small tables: one for reducer-local state updates and one for shell-level effect/event interpretation. That keeps the pipeline composable without obscuring what each command actually changes.
- **Verification**: `npm test` and `npm run lint` passed. The existing sandbox-only live smoke skip still reports `listen EPERM` when the temporary Unix socket bind is attempted.

### 2026-07-10: Started Step 4 by Standardizing Reducer Result Shapes and Photo-Mutation Composition
- **Goal**: Begin the implementation-companion Step 4 readability pass by removing repeated reducer ceremony around unchanged returns, state-sync/photo-update result shapes, and persistence-bearing photo metadata updates.
- **Implementation**:
  - Refactored `server/domain/reducer.js` to use small shared result helpers for unchanged results, state-sync results, photo-update results, effect-only results, conditional photo/state-sync event selection, and persistence-effect bundling.
  - Added a composable `reducePhotoLibraryCommand(...)` helper so rating, broken-photo, crop, pairing, and metadata-report commands now share the same pure `update -> optional playback finalization -> persistence effect -> event` pipeline instead of reimplementing that flow in each branch.
  - Kept the abstractions selective: simple branches like interval/theme changes still read directly, while repeated photo-library mutations now express only their specific updater and post-update policy.
  - Added domain regression coverage for standardized no-op behavior on `patch-state` and missing-photo metadata commands, protecting the new result-shape boundary.
  - Updated `FUNCTIONAL_REFACTOR_ROADMAP.md` to record this as the first completed Step 4 slice while keeping the overall Step 4 checkpoint active.
- **Learning**: The cleanest Step 4 abstractions were not deep pipelines or clever point-free wrappers, but a small algebra of result builders plus one shared photo-mutation combinator. That keeps the reducer teachable: the repeated mechanics are centralized once, while each command branch still shows its domain-specific intent plainly.
- **Verification**: `npm test` and `npm run lint` passed. The existing sandbox-only live smoke skip still reports `listen EPERM` when the temporary Unix socket bind is attempted.

### 2026-07-10: Completed the `server/app.js` Step 3 Shell Refactor with Kiosk and Idle-Daemon Runtimes
- **Goal**: Finish the remaining `server/app.js` Step 3 shell-composition seam by extracting the kiosk/browser lifecycle and the 2-second idle-daemon orchestration loop out of the bootstrap file.
- **Implementation**:
  - Added `server/runtime/kioskControl.js` as a dedicated browser lifecycle shell that owns manual override state, deferred launch retries, CPU-governor transitions, kiosk relaunch sequencing, and unexpected-exit recovery behind one object-shaped runtime API.
  - Added `server/runtime/idleDaemon.js` as the explicit Mutter/audio/inhibition polling shell, keeping the pure `getNextScreensaverState(...)` reducer local to that runtime and exposing a small `tick()` / `start()` boundary for the app bootstrap.
  - Rewired `server/app.js` to assemble those runtimes and inject their methods into the shared dispatcher and socket layers, leaving the app file focused on state/bootstrap assembly instead of long-lived host orchestration.
  - Added regression coverage in `run-tests.js` for deferred kiosk launches, manual-override reset after unexpected Chromium exits, idle-daemon launch after three idle ticks, and the rule that GNOME session inhibition is ignored once Lumina's own kiosk is already running.
  - Updated `ROADMAP.md`, `FUNCTIONAL_REFACTOR_ROADMAP.md`, and `AGENTS.md` so the repo now records Step 3 as complete and moves the active implementation-companion checkpoint to Step 4.
- **Learning**: This refactor worked best when the shell was split by host responsibility, not by arbitrary helper grouping. `server/app.js` became meaningfully easier to read only once browser lifecycle state and daemon polling cadence each had a named runtime boundary with injected effects and a tiny public surface.
- **Verification**: `npm test` and `npm run lint` passed. The existing sandbox-only live smoke skip still reports `listen EPERM` when a real socket bind is attempted.

### 2026-07-10: Extracted the Environment Refresh Runtime as the Next `server/app.js` Step 3 Slice
- **Goal**: Continue the `server/app.js` shell-composition refactor by removing the weather, news-sentiment, and daily-feed refresh orchestration cluster from the app bootstrap file.
- **Implementation**:
  - Added `server/runtime/environmentRefresh.js` as an explicit shell module that owns the weather refresh pipeline, news-sentiment refresh pipeline, and daily feed-update policy using injected effects and small pure helpers (`shouldSkipDailyFeedUpdate`, weather snapshot builders, and collection merge projection).
  - Rewired `server/app.js` to assemble that runtime and keep only scheduling plus host wiring locally, matching the same object-shaped factory style already used by `server/runtime/activeFeed.js` and the async job services.
  - Added regression coverage in `run-tests.js` for refresh-interval skipping, successful news-sentiment refresh, successful weather-cache refresh, and the daily feed-update side-effect bundle (persist -> refresh active feed -> broadcast -> schedule analysis).
  - Updated `ROADMAP.md`, `FUNCTIONAL_REFACTOR_ROADMAP.md`, and local memory logs so the Step 3 checkpoint now explicitly records that the active-feed and environment-refresh slices are complete and that kiosk/browser plus idle-daemon composition is the next seam.
- **Learning**: `server/app.js` gets smaller fastest when whole orchestration clusters move behind named runtimes rather than when individual helper functions are merely relocated. Once weather, sentiment, and daily refresh shared the same injected shell boundary, the remaining app-level work became much easier to see as "scheduling and host runtime" instead of a vague tangle of mixed concerns.
- **Verification**: `npm test` and `npm run lint` passed. No client build was needed because this slice only changed server/runtime code and tracked docs.

### 2026-07-10: Closed the Step 2 Socket Audit and Started Step 3 by Extracting Active-Feed Runtime Composition
- **Goal**: Confirm whether any durable socket behavior still required new domain commands/effects, then begin the next `server/app.js` shell-composition slice instead of leaving the checkpoint implicit.
- **Implementation**:
  - Audited the remaining `server/sockets.js` handlers and confirmed the only non-dispatch tail is intentionally ephemeral or source-local (`report-tv-viewport`, media-failure alerts, second-photo sync, disconnect lifecycle, and the signed-URL refresh helper), so no further Step 2 command/effect expansion was needed.
  - Added `server/runtime/activeFeed.js` as a small runtime boundary for active-category normalization, balanced-feed rebuilding, fallback-feed selection, and scoped refresh checks.
  - Rewired `server/app.js` to consume that runtime module for active-feed refreshes after daily crawls and vision-analysis persistence, and to share one `getActiveCategories` function across recrawl and vision-analysis job wiring instead of re-splitting `currentCategory` inline.
  - Added regression coverage in `run-tests.js` for alias-aware active-category normalization, scoped refresh no-ops, direct active-feed refreshes, and the Scenic Nature fallback path when a selected feed becomes empty after filtering.
  - Updated `ROADMAP.md`, `FUNCTIONAL_REFACTOR_ROADMAP.md`, and `AGENTS.md` so the repo now states explicitly that the implementation-companion audit step is complete and Step 3 is the active checkpoint.
- **Learning**: The right way to close an audit checkpoint is to codify its conclusion. Once the socket audit showed no missing durable commands, leaving that fact undocumented would have created artificial ambiguity. Extracting a small runtime shell immediately afterward makes the roadmap transition concrete in both code and docs.
- **Verification**: `npm test`, `npm run lint`, and `npm --prefix client run build` passed. The known sandbox-only live smoke skip still reports `listen EPERM` when a real bind is attempted.

### 2026-07-10: Completed the `server/sockets.js` Transport-Adapter Step by Isolating Legacy Compatibility
- **Goal**: Finish Step 1 of the functional refactor companion by removing the last inline legacy mutation branches from `server/sockets.js` without dropping mixed-version compatibility behavior.
- **Implementation**:
  - Added `server/socketLegacyCompatibility.js` as a dedicated compatibility adapter that owns the old no-dispatch fallback mutation paths for state patches, category/photo updates, pool/admin changes, excluded-keyword edits, screensaver toggles, and Google Photos cache-backed photo mutations.
  - Simplified `server/sockets.js` so it now focuses on shared `decode -> dispatch` listener registration plus explicit async/telemetry handlers, creating the legacy compatibility adapter only when a shared dispatcher is unavailable.
  - Kept the intentionally socket-owned tail explicit in `server/sockets.js`: connection lifecycle, viewport/media-failure telemetry, second-photo preview sync, and on-demand Google Photos signed-URL refreshes.
  - Updated roadmap and agent-facing docs so Step 1 is marked complete and the next companion checkpoint is explicit.
- **Learning**: The cleanest way to finish a transport-adapter refactor is often not to delete every old branch immediately, but to move compatibility behavior behind a named boundary so the live adapter reads as transport code again. Once the fallback path became a separate adapter, the remaining socket module structure matched the functional-core/imperative-shell split much more honestly.
- **Verification**: `npm test` and `npm run lint` passed. The sandbox live smoke bind still skipped with the known `listen EPERM` Unix-socket limitation.

### 2026-07-10: Excluded-Keyword Socket Commands and Ephemeral Socket Tail Now Use Explicit Listener Boundaries
- **Goal**: Continue the Phase 1 `server/sockets.js` thinning work by removing the last durable socket outlier and making the remaining socket-only handlers explicit, injectable, and testable.
- **Implementation**:
  - Moved `update-excluded-keywords` onto the shared `createCommandListener(...)` path, so the socket adapter now decodes and dispatches that durable mutation the same way it already handles category, pool, photo, and admin compatibility events.
  - Added small `createAsyncListener(...)` and `createTelemetryListener(...)` factories plus a declarative listener-registration helper, then used them to isolate `report-tv-viewport`, `report-media-failure`, `set-active-second-photo`, `get-active-google-photo`, and disconnect wiring from the durable command section.
  - Extended the socket environment with injected host-IO dependencies for media-failure alerts, TV display-info reads, and Google Photos signed-URL refreshes, keeping those effects at the shell boundary instead of hard-wiring them into the middle of transport logic.
  - Expanded `run-tests.js` to cover shared dispatch of excluded-keyword socket commands, the legacy excluded-keyword fallback path, viewport telemetry state updates, and the dedicated Google Photos refresh response handler.
- **Learning**: The right endgame for a transport adapter is not “remove every non-command event,” but “make the non-command events obviously non-command events.” Once the durable mutation outlier moved onto the shared listener and the remaining host-IO handlers were wrapped behind explicit factories, `server/sockets.js` read much more like a shell than a second business-rules module.
- **Verification**: `npm test`, `npm run lint`, and `npm --prefix client run build` passed. The known sandbox-only live smoke skip still reported `listen EPERM` as expected.

### 2026-07-10: Google Photos Photo Mutations Now Share the Reducer/Dispatcher Path
- **Goal**: Continue the Phase 1 `server/sockets.js` thinning work by removing the last Google Photos photo-metadata interceptors from the REST and Socket.IO adapters.
- **Implementation**:
  - Generalized the shared reducer photo-update path so `rate-photo`, `mark-photo-broken`, `set-photo-crop`, `set-photo-prevent-pairing`, and `report-photo-metadata` can update either curated collections or `externalCollections` while keeping `photosList` and playback state coherent.
  - Added a new explicit `persist-external-photo-metadata` effect interpreted by the dispatcher shell, with `server/app.js` wiring that effect to the Google Photos cache writer instead of letting routes or sockets mutate the cache inline.
  - Removed the Google Photos `PATCH /api/photos` special case and the socket interceptors for photo metadata/rating/crop/pairing/broken updates, leaving those transports to decode commands and dispatch them through the shared path by default.
  - Kept a small isolated socket fallback shim for dispatcher-less compatibility, so legacy mixed-version Google Photos control events still patch the cache-backed state without restoring ad hoc transport-owned business logic.
  - Expanded regression coverage in `server/domain/tests.js` and `run-tests.js` for external-photo reducer effects, Google Photos REST photo patch batching, shared socket dispatch of Google proxy photo commands, and the legacy no-dispatch fallback shim.
- **Learning**: The right abstraction boundary was not “special-case Google Photos in every transport,” but “teach the reducer about external collections, then express source-specific persistence as an explicit shell effect.” Once that boundary existed, both REST and Socket.IO could collapse back to ordinary command adapters.
- **Verification**: `npm test`, `npm run lint`, and `npm --prefix client run build` passed. The known sandbox-only live smoke section still skipped the Unix-socket bind with `listen EPERM` as expected.

### 2026-07-10: Pool/Admin Socket Tail Now Shares the Command Path and Admin Secret Saves Are REST-First
- **Goal**: Continue the Phase 1 `server/sockets.js` thinning work by removing the remaining pool/admin compatibility logic from ad hoc transport branches and moving remote admin secret writes onto a REST-first boundary.
- **Implementation**:
  - Added shared admin-secret decoders in `server/domain/commands.js` plus a `save-env-secret -> persist-env-vars` command/effect pair in the reducer/dispatcher, so admin `.env` writes now flow through the same explicit intent/effect language as the rest of the migration.
  - Added REST admin-secret routes and client helpers for UseAPI and Tumblr credentials, then updated the remote settings UI to save those secrets through REST by default with socket fallback reserved for mixed-version daemons.
  - Refactored `server/sockets.js` so pool keyword updates, feed-config merges, add/delete pool compatibility events, and legacy admin secret-save events all use the shared command-listener factory instead of hand-rolled dispatch branches.
  - Expanded regression coverage in `server/domain/tests.js` and `run-tests.js` for admin-secret command decoding, reducer effect purity, REST admin-secret routing, REST client fallback, and socket compatibility dispatch/ack behavior.
  - Updated `ROADMAP.md`, `FUNCTIONAL_REFACTOR_ROADMAP.md`, and `AGENTS.md` so the next explicit socket-tail checkpoint is now the remaining source-local Google Photos exceptions plus intentionally ephemeral telemetry handlers.
- **Learning**: A good transport-thinning slice often needs one more domain effect, not one more socket helper. Once secret persistence became an explicit effect, both REST and Socket.IO could share the same intent without pretending that `.env` writes were just another inline socket side effect.
- **Verification**: `npm test`, `npm run lint`, and `npm --prefix client run build` passed. The known sandbox-only live smoke section still skipped the Unix-socket bind with `listen EPERM` as expected.

### 2026-07-10: Socket Category and Curated-Photo Compatibility Handlers Now Share the Domain Command Path
- **Goal**: Continue the Phase 1 `server/sockets.js` thinning work by removing the remaining ad hoc category/photo transport logic that already had reducer support elsewhere in the codebase.
- **Implementation**:
  - Added shared photo command decoders in `server/domain/commands.js` for broken-photo and prevent-pairing mutations so REST and Socket.IO stop hand-building those command objects independently.
  - Refactored `server/sockets.js` around a slightly richer command-listener factory with optional interceptors, then moved category selection, active-photo preview, smart next/prev navigation, rating, crop, prevent-pairing, broken-photo marking, and photo-metadata reporting onto shared decode-and-dispatch flows.
  - Isolated the unavoidable Google Photos divergence behind a small source-local metadata interceptor, keeping the transport shell aware only of the cache-backed exception rather than re-encoding the whole mutation path inline.
  - Added regression coverage in `server/domain/tests.js` for the new decoders and in `run-tests.js` for the socket transport path, proving that category/photo compatibility events dispatch the same domain commands when the shared dispatcher is present while the legacy smart-photo fallback still works when it is not.
  - Updated `ROADMAP.md`, `FUNCTIONAL_REFACTOR_ROADMAP.md`, and `AGENTS.md` so the next explicit tail is now pool/admin compatibility shims plus source-local Google Photos exceptions.
- **Learning**: A transport adapter gets meaningfully thinner once the remaining “special cases” are split into two buckets: generic command-shaped work that should always decode through the domain layer, and genuinely source-local exceptions that deserve a small, named interceptor instead of another inline branch cascade.
- **Verification**: `npm test` and `npm run lint` passed. The known sandbox-only live smoke skip still reported `listen EPERM` as expected.

### 2026-07-10: ES6+ Cleanup Pass on the Shared Socket Patch Decoder Slice
- **Goal**: Revisit the new socket transport refactor and remove avoidable noise so the code teaches modern JavaScript style more clearly without changing behavior.
- **Implementation**:
  - Refined `server/domain/commands.js` with shared field constants, destructured input handling, and declarative patch construction for `decodeStatePatchCommand(...)`.
  - Tightened `server/sockets.js` with shared category helpers, optional chaining, nullish coalescing, logical assignment (`??=`), destructured patch handling, and small reusable arrow-function utilities for repeated active-photo sync and category parsing paths.
  - Kept the work scoped to readability and intent clarity on the already-refactored transport boundary rather than broadening the migration surface again.
- **Learning**: Once the functional boundary is correct, a second pass for ES6+ clarity is worthwhile. The best cleanup is usually replacing hand-rolled branching and initialization with a few small shared transforms, not adding new abstraction layers.
- **Verification**: `npm run lint` and `npm test` passed. The known sandbox-only live smoke skip still reported `listen EPERM` as expected.

### 2026-07-10: Socket Settings Transport Now Uses Shared Patch-State Decoders
- **Goal**: Start the next Phase 1 implementation-companion step by thinning `server/sockets.js` so the dashboard's durable socket settings stop owning their own mutation rules.
- **Implementation**:
  - Added a small functional patch-decoder toolkit in `server/domain/commands.js` built around curried field-patch builders plus `createStatePatchCommandDecoder(...)`, so socket adapters can express `build patch -> decode shared command` instead of hand-rolling transport-local updates.
  - Refactored `server/sockets.js` to use an object-shaped environment plus shared `createCommandListener(...)` / `listenForStatePatch(...)` helpers for widget toggles, theme, slideshow interval, scale/split controls, alignment toggles, vision config, and location settings.
  - Moved those socket events onto the same `patch-state` / `set-screensaver-active` command path the REST layer already uses, leaving Socket.IO in a thinner adapter role while preserving the old fallback behavior as a contained compatibility shim.
  - Expanded `server/domain/tests.js` with regression coverage for the new pure decoder builders, including valid shared-command composition and rejection of invalid enum/percent payloads.
  - Updated `ROADMAP.md` and `FUNCTIONAL_REFACTOR_ROADMAP.md` so the next checkpoint is explicit: continue shrinking the remaining category/photo/admin compatibility handlers in `server/sockets.js`.
- **Learning**: The cleanest way to thin a transport is not to add more transport branching, but to make decoding itself composable. Once socket events can be described as pure patch builders feeding the shared command decoder, the transport layer becomes wiring instead of business logic.
- **Verification**: `npm run lint` and `npm test` passed. The live smoke section still hit the known sandbox-only `listen EPERM` Unix-socket bind guard and was skipped as expected.

### 2026-07-09: Manual Vision Analysis Now Uses a REST-First Async Job Boundary
- **Goal**: Complete the next Phase 1 roadmap step by moving manual vision-analysis runs onto the same explicit REST-first async job flow already used for recrawls.
- **Implementation**:
  - Added `server/jobs/visionAnalysis.js` as a dedicated observable job shell for scoped manual vision-analysis runs, reusing the shared `job-status` transport with typed `vision-analysis` payloads.
  - Extended the domain command/effect surface with `trigger-vision-analysis` plus `start-vision-analysis-job`, so REST and the legacy socket shim dispatch the same async intent instead of owning separate background-analysis orchestration.
  - Upgraded `triggerImageAnalysisBackground(...)` in `server/app.js` to accept scoped categories, emit progress snapshots, fail fast when the Vision API is manually requested but not configured, and only refresh the active live feed when the analyzed categories actually affect it.
  - Added `POST /api/jobs/vision-analysis`, client REST helpers, and a new remote-control operator button/status panel so manual analysis is now queued through the REST job path and observed through Socket.IO progress updates.
  - Added coverage for the new decoder/reducer effect, the vision-analysis job service, and the REST route contract in `server/domain/tests.js`, `server/jobs/tests.js`, and `run-tests.js`.
- **Learning**: Once one operator-triggered background workflow has a clean REST job boundary, follow-up workflows should reuse that same command/effect language instead of treating “background work” as a special socket-only case. The transport stays simple when long-running work is modeled as a first-class job and Socket.IO is only the status stream.
- **Verification**: `npm test`, `npm run lint`, and `npm --prefix client run build` passed. The live server smoke section still hit the sandbox-only `listen EPERM` guard and was skipped as expected.

### 2026-07-09: Manual Recrawls Now Use a REST-First Async Job Boundary
- **Goal**: Complete the next Phase 1 roadmap step by moving manual recrawls off the socket-owned mutation path and onto an explicit REST-first async job flow with live progress updates.
- **Implementation**:
  - Added `server/jobs/recrawl.js` as a small shell module that composes scope normalization, crawl execution, collection merge/persist, active-feed refresh, state broadcast, and background-analysis scheduling behind one observable job service.
  - Extended the shared domain path with a `trigger-recrawl` command plus `start-recrawl-job` effect so REST and legacy socket triggers now dispatch the same async intent instead of carrying duplicate crawl orchestration.
  - Rewired `server/routes.js` so `POST /api/jobs/recrawl` and `POST /api/pools/:name/crawl` enqueue recrawl jobs and return `202 Accepted` job snapshots, while `server/sockets.js` now acts as a backward-compatible shim that only dispatches the same command and relays job status.
  - Updated the remote UI to submit recrawls through the shared REST client and render live progress text from socket-pushed job updates instead of directly emitting `trigger-recrawl`.
  - Added reducer, job-service, and route coverage for the new async boundary in `server/domain/tests.js`, `server/jobs/tests.js`, and `run-tests.js`.
- **Learning**: Async operator actions should not bypass the shared command/effect language just because they are long-running. A small job shell lets REST own the durable intent while Socket.IO stays in its proper role as the observable status transport.
- **Verification**: `npm run lint`, `npm test`, and `npm --prefix client run build` passed. The network-bound live server smoke section was skipped in this sandbox because all listen attempts returned `EPERM`, but the new route contract is covered by direct handler invocation tests.

### 2026-07-09: Realigned the Product Roadmap and Functional Companion Wording
- **Goal**: Resolve the stale roadmap checkpoint and make the relationship between `ROADMAP.md` and `FUNCTIONAL_REFACTOR_ROADMAP.md` unambiguous across the repo docs.
- **Implementation**:
  - Updated `ROADMAP.md` so Phase 1 Step 3 is marked complete instead of still listed as next.
  - Set the next product checkpoint to the remaining asynchronous operator-triggered REST migration work, starting with recrawl flows and live progress events.
  - Clarified in `ROADMAP.md`, `FUNCTIONAL_REFACTOR_ROADMAP.md`, `AGENTS.md`, and `README.md` that the functional refactor document is a supporting Phase 1 implementation track with its own local step numbering, not a separate product roadmap.
- **Learning**: Once a repo carries both a product roadmap and an implementation-companion roadmap, both documents need explicit scope labels. Otherwise, old step numbers are easy to misread as conflicting priorities instead of different layers of the same plan.

### 2026-07-06: Integrated TypeScript Migration Strategy into the Product Roadmap
- **Goal**: Update the Lumina product roadmap to include a detailed TypeScript migration plan and determine the most appropriate timing and scope for execution.
- **Implementation**:
  - Analyzed the codebase to determine the best phase for migration. Identified that migrating during Phase 1 (REST-first API migration) adds unnecessary churn, whereas migrating between Phase 1 and Phase 2 (as a transition bridge) is optimal because the API contracts and domain logic are stabilized.
  - Updated [ROADMAP.md](file:///home/alex/work/lumina/ROADMAP.md) to define a dedicated "TypeScript Migration (Transition Bridge)" stage.
  - Specified frontend migration scopes (Vite config, TSX conversion) and backend scopes (Node v22 `--experimental-strip-types`, domain conversions, `run-tests.js` updates).
  - Added specific criteria to the Acceptance Plan and updated Defaults rules.
- **Learning**: Implementing structural language migrations (like JavaScript to TypeScript) is most efficient when scheduled directly after major API and data model restructuring (Phase 1) is complete, preventing double-refactoring effort. Node v22's native type-stripping capabilities permit a lightweight transition without introducing heavy compile-step wrappers in production.

### 2026-07-05: Bypassed Test-Environment Crawls & Robust Photo Selection for Integration Suite
* **Goal**: Fix a regression in the integration tests where `POST /api/photos/prev` failed to return the expected preview photo.
* **Implementation**:
  * Identified that background dynamic crawlers were being triggered asynchronously during integration tests (when creating pools via `POST /api/pools`), which recomputed the feed and wiped out the temporary Picsum photo from `state.photosList`.
  * Bypassed the dispatcher's `run-crawler` effect when `process.env.NODE_ENV === 'test'` inside `server/domain/dispatch.js` to ensure test state remains undisturbed.
  * Discovered that the mock Picsum photo `https://picsum.photos/id/1025/1200/1800` was marked as `isBroken: true` in the git-tracked `curated_collections.json` database, causing it to be filtered out of sequential navigation.
  * Updated `run-tests.js` to dynamically select the first non-broken, non-banned photo from the pool for `samplePhotoUrl` instead of blindly taking index `0`.
* **Learning**: Background effects (like crawling) and disk persistence states from developer tests must be properly isolated under automated testing. Bypassing side-effect queues and writing robust fallback selectors keeps automated testing deterministic and fast.
* **Verification**: All 98 unit, domain, and integration tests passed cleanly in under 10 seconds.

### 2026-07-06: Optimize Vision Service Cache Initialization, Implement Circuit Breaker, and Isolate Tests
- **Goal**: Fix screensaver freezes and high CPU/swap thrashing caused by the background Vision Service loop attempting to process all 336 images on every daemon start when the local qwen3-vl API is offline/down, and prevent test runs from killing/interrupting the production kiosk browser.
- **Implementation**:
  - **Lazy Cache Init**: Modified [vision.js](file:///home/alex/work/lumina/server/services/vision.js#L8-L15) to use a `cacheInitialized` boolean flag, ensuring `analysis_cache.json` is read and parsed from disk exactly once per process lifetime instead of on every image evaluation (which previously caused 336 synchronous disk reads).
  - **Circuit Breaker**: Added a failure-counter circuit breaker in `triggerImageAnalysisBackground` inside [app.js](file:///home/alex/work/lumina/server/app.js#L320-L330). If 3 consecutive Vision API inference failures are encountered on cache misses, the background analyzer immediately aborts the loop, preventing 336 high-bandwidth image downloads and inference requests.
  - **Test Isolation Bypass**: Updated [system.js](file:///home/alex/work/lumina/server/services/system.js#L102-L272) to check `process.env.NODE_ENV === 'test'` and bypass real hardware CPU governor modifications, browser GUI spawns, and global process kills (which were executing `killall` and terminating the production TV screensaver browser).
- **Learning**: Background loops processing large datasets must be safeguarded with circuit breakers when hitting external/local microservices. Unbounded retry loops and redundant disk I/O block event loops and saturate swap spaces on low-resource hardware. Additionally, test suites running integration smoke checks must be strictly decoupled from the host system's hardware configurations and active user sessions to avoid unexpected side effects (such as terminating active processes).
- **Verification**:
  - Verified the `lumina` systemd service successfully restarted and logged the early abort after exactly 3 consecutive 404 inference failures.
  - Verified that running `node run-tests.js` no longer affects the production kiosk browser on `playwright`.
  - All 98 regression tests passed cleanly.

### 2026-07-05: Feed Category Active-State Rendering Now Follows Canonical Selected Categories
* **Goal**: Fix the remaining `Image Feeds` category-toggle regression where a tapped category could flash active on the initiating remote and then immediately appear inactive again.
* **Implementation**:
  * Extracted a small functional category-selection core in `client/src/state/categorySelection.js` to canonicalize aliases (`Liminal Space`/`AI Creation`), derive the active selection from `playback.selectedCategories` before falling back to older snapshot fields, and compose toggle operations against that canonical selection.
  * Updated `client/src/state/feedMutations.js` and `client/src/state/frameSelectors.js` so optimistic category patches and general snapshot normalization both reconcile `currentCategory`, `playback.selectedCategories`, and `currentFrame.context.categories` to the same canonical value.
  * Rewired `client/src/components/RemoteControl.jsx`, `client/src/components/remote/ImageFeedsTab.jsx`, and `client/src/components/Dashboard.jsx` to render and toggle category buttons through the shared selector helpers instead of directly splitting `state.currentCategory`.
  * Added regression coverage in `run-tests.js` for stale top-level category drift, alias normalization, snapshot reconciliation, and snapshot-driven category toggling.
* **Learning**: The real bug boundary was no longer “did the mutation succeed?” but “which category field does the client trust after several transport migrations?” Once multiple snapshot shapes coexist, active-state rendering must be derived from one canonical selector layer or harmless field drift turns into visible toggle flicker.
* **Verification**: `npm run lint` passed. `npm --prefix client run build` passed. The new client category regression assertions passed inside `npm test`; the suite still finishes with the pre-existing unrelated `POST /api/photos/prev reverses the direct-control sequence after next` failure.

### 2026-07-05: Image Feeds Toggles Now Patch the Initiating Remote Snapshot Optimistically
* **Goal**: Fix the `Image Feeds` regression where category and per-source enable/disable clicks could leave the initiating remote looking unchanged until a later sync or refresh.
* **Implementation**:
  * Added `client/src/state/feedMutations.js` as a small pure helper layer for category-selection normalization, toggle composition, feed-source config merges, and snapshot patch projection.
  * Updated `client/src/hooks/useLuminaActions.js` so `changeCategory(...)` and `updateFeedConfig(...)` apply those pure snapshot transforms immediately, then reconcile against the REST response or a fallback refresh if the request fails.
  * Rewired `client/src/components/RemoteControl.jsx` to build category toggles through the shared pure helper instead of ad hoc `split(',')` state juggling.
  * Added regression coverage in `run-tests.js` for category normalization/toggling plus feed-source config merge projection on the client snapshot layer.
* **Learning**: The REST/domain path was still correct; the gap was on the initiating client. If the remote waits entirely on a later sync to reflect a durable click, the UI can feel broken even though the write contract itself is sound. Small pure snapshot projections are the right boundary here.
* **Verification**: `npm run lint`, `npm --prefix client run build`, and `npm test` passed. The existing sandbox-only ephemeral localhost `listen EPERM` warning still appears in the smoke-test section without failing the suite.

### 2026-07-05: Direct Control Prev/Next Now Uses Deterministic Feed Navigation
* **Goal**: Fix the Direct Control `Prev/Next` controls so multi-feed navigation can round-trip back to the same image instead of sampling another weighted candidate.
* **Implementation**:
  * Added a pure circular feed navigator in `server/domain/selectors.js` that advances over the already-balanced `photosList` order with wraparound behavior and explicit fallback when the active photo is no longer in the feed.
  * Extended `advance-photo` commands with a small `strategy` discriminator in `server/domain/commands.js` / `server/domain/reducer.js`, keeping `smart` selection available for slideshow-style paths while routing the REST `/api/photos/next|prev` operator controls to deterministic `sequence` navigation.
  * Added regression coverage in `server/domain/tests.js` for multi-feed next/prev round-tripping and in `run-tests.js` for the REST next-then-prev path.
* **Learning**: `prev` cannot be modeled as “smart selection with a different flag” if the selector is still probabilistic. For operator navigation, the correct source of truth is the precomputed balanced feed order, not a fresh weighted pick.
* **Verification**: `npm test` passed successfully.

### 2026-07-05: Category, Pool, and Feed Configuration Controls Now Use REST Mutations by Default
* **Goal**: Complete Phase 1 Step 3 by moving category selection plus pool/feed-configuration writes off socket-only operator mutations and onto the shared REST/domain command path.
* **Implementation**:
  * Extended `server/domain/commands.js` and `server/domain/reducer.js` with pure pool lifecycle/config commands for add/delete, keyword updates, and per-source feed-config merges.
  * Rewired `server/routes.js` so `POST /api/state/categories`, `POST|PATCH|DELETE /api/pools`, and `PATCH /api/pools/:name/feed-sources/:source` all flow through the same reducer/dispatcher contract, preserving source-level feed-config merges instead of clobbering sibling fields.
  * Added dispatcher-backed crawler execution in `server/app.js` for `add-pool`, and updated `server/sockets.js` so the legacy socket events remain thin adapters over the same command shapes instead of carrying a second mutation implementation.
  * Updated `client/src/api/luminaClient.js`, `client/src/hooks/useLuminaActions.js`, `client/src/components/remote/ImageFeedsTab.jsx`, and `client/src/components/Dashboard.jsx` so operator category/pool/feed actions now call REST by default.
  * Expanded regression coverage in `server/domain/tests.js` and `run-tests.js` for pool command decoding, source-config merge behavior, `POST /api/state/categories`, and the dedicated feed-source patch route.
  * Updated `AGENTS.md` to mark Phase 1 Step 3 complete.
* **Learning**: Pool feed-config writes need source-level merge semantics. A shallow category-level merge is not transport parity because it silently drops sibling fields like `enabled` when only `subreddits` or `keywords` are being edited.
* **Verification**: `npm run lint` passed. `npm --prefix client run build` passed. `npm test` passed its functional/domain/API assertions; the long-standing sandbox-only ephemeral localhost `listen EPERM` warning still appears in the smoke section but does not fail the suite.

### 2026-07-05: Remote Durable State & Settings Controls Now Use REST Mutations by Default
* **Goal**: Continue Phase 1 by moving the remote's durable settings/state slice off socket-only mutations and onto `PATCH /api/state` plus `POST /api/state/screensaver`.
* **Implementation**:
  * Extended `client/src/api/luminaClient.js` with state mutation helpers and updated `client/src/hooks/useLuminaActions.js` so widget toggles, theme, slideshow interval, scale/split settings, weather/night alignment, vision config, fallback consent, location settings, excluded keywords, and screensaver activation all use REST by default.
  * Rewired `client/src/components/remote/SystemSettingsTab.jsx` to call the shared action layer instead of emitting those durable mutations directly over Socket.IO, and cleaned up the last Direct Control rating button that was still emitting `rate-photo`.
  * Added REST parity for location settings in `server/routes.js` by teaching `PATCH /api/state` about `autoLocation` and `manualLocation`, including weather refresh behavior, and broadened the screensaver route response to return the updated unified snapshot.
  * Updated roadmap and agent-facing docs to mark Phase 1 Step 2 complete and Phase 1 Step 3 as the next slice: categories, pools, and feed-config mutation migration.
* **Learning**: The clean boundary is becoming clearer now that two slices are in place. REST should own durable operator intent, while Socket.IO should remain for live push paths like `state-sync`, viewport reporting, crawler completion, and similar server-initiated events.
* **Verification**: `npm test` and `npm --prefix client run build` passed successfully.

### 2026-07-05: Remote Photo Controls Now Use REST Mutations by Default
* **Goal**: Take the first real Phase 1 roadmap step by moving the remote's photo-control slice off socket-only mutations and onto the existing REST surface, while keeping Socket.IO for live sync.
* **Implementation**:
  * Added a small typed-ish client REST wrapper at `client/src/api/luminaClient.js` for photo patching, previewing, advancing, and snapshot refreshes.
  * Updated `client/src/hooks/useLuminaActions.js` so photo rating, crop, pairing, preview, next/prev, and broken-photo marking use REST by default, then patch or refresh the initiating client's local snapshot directly instead of waiting for a socket round-trip.
  * Added `patchPhotoInSnapshot(...)` in `client/src/state/frameSelectors.js` so local crop/rating/pairing changes update `photosList`, active-photo pointers, and derived frame crop fields consistently.
  * Extended `server/routes.js` so `PATCH /api/photos` supports `preserveActive` parity for pairing edits and `POST /api/photos/preview` can preview photos from the active feed snapshot, including source-backed items that are not only present in curated collections.
* **Learning**: The first transport migration should target a slice where the server semantics already exist and tests already cover the domain surface. Photo controls fit that boundary well, but they still needed one client-side correction: REST mutations must update the initiating client directly, otherwise a socket disconnect still leaves the UI stale even though the write succeeded.
* **Verification**: `npm test` passed successfully.

### 2026-07-05: Product Roadmap Added for REST-First, Metadata, Sharing, and Sensor Work
* **Goal**: Capture Lumina's next major product and architecture phases in one tracked roadmap so future work stops drifting back toward socket-only mutations and ad hoc feature additions.
* **Implementation**:
  * Added `ROADMAP.md` as the repo's phase-based planning document, anchored on a REST-first backend API, a functional core / imperative shell direction, and three major delivery phases.
  * Aligned `README.md` with the current architecture reality by describing Lumina as a REST-first migration with Socket.IO reserved for live sync and low-latency events, and linked the new roadmap.
  * Corrected `AGENTS.md` wording so future agents see Socket.IO as the real-time transport rather than the long-term durable control surface.
* **Learning**: The repo already contains the server-side beginnings of this plan (`server/routes.js`, `server/domain/`, transport-parity tests), but the top-level docs were still describing Lumina as if Socket.IO were the primary integration boundary. That mismatch makes it too easy for future feature work to reintroduce transport drift.
* **Verification**: `npm test` passed successfully.

### 2026-07-04: TV Preview Resolution & Display Info Refactor & Adapter Filtering
* **Goal**: Move the best-effort TV preview resolution metadata off the actual TV-frame preview outlines onto the outer layouts (under section headings), and hide it completely if a real physical TV make/model cannot be resolved (e.g. generic name "display" or video converters like "VGA to HDMI").
* **Implementation**:
  * **Generic & Adapter Filter**: Updated `formatTvPreviewMetaLabel` in `client/src/components/RemoteControl.jsx` to match against generic words (`display`, `unknown`, `default`) and video adapters/converters (`vga to hdmi`, `hdmi to vga`, `adapter`, `converter`, `vga-`, `hdmi-`, `dp-`). If matched, it returns `null` to indicate no meta label should be rendered.
  * **Direct Control Relocation**: Removed the meta span overlay from the preview frame inside `client/src/components/remote/DirectControlTab.jsx`, and rendered it as an outer text layout just below the "TV Gesture Controller" section header.
  * **Image Feeds Relocation**: Removed the meta span overlay from all three states (loading, failed, loaded) of the preview frame in `client/src/components/remote/ImageFeedsTab.jsx`, and rendered it as an outer text layout below the "Independent Rating Deck" header.
* **Learning**: High-fidelity TV preview overlays can easily look cluttered if metadata captions are rendered on top of them. Placing metadata on the outer card layout and hiding it when it is generic/adapter-based yields a cleaner and more professional remote control interface.
* **Verification**: `npm test` and `npm --prefix client run build` passed successfully.

### 2026-07-04: Shared Detected TV Outline for Direct Control and Rating Deck
* **Goal**: Keep the remote previews honest by rendering the same automatically detected TV frame outline in both `TV Gesture Controller` and `Independent Rating Deck`.
* **Implementation**:
  * **Single TV-frame helper**: Added `client/src/components/remote/tvPreview.js` so remote preview surfaces share the same fallback aspect ratio and fit logic instead of each card carrying its own sizing assumptions.
  * **Detection confirmation path**: Kept `client/src/components/Dashboard.jsx` as the source of truth that reports `window.innerWidth` / `window.innerHeight`, with `server/sockets.js` persisting that live `tvViewport` snapshot for remotes.
  * **Rating deck parity**: Updated `client/src/components/RemoteControl.jsx` and `client/src/components/remote/ImageFeedsTab.jsx` so the rating deck preview uses the detected TV aspect ratio, renders inside the same outlined shell, and drives crop math from that frame rather than a fixed generic thumbnail box.
* **Learning**: A crop/rating preview is misleading even when the image itself is correct if the surrounding frame does not match the real TV viewport. The frame outline is part of the editing truth, not just decoration.
* **Verification**: `npm test` passed. `npm --prefix client run build` passed.

### 2026-07-04: Google Photos Category Selection Rehydrates the Active Pool
* **Goal**: Fix the `No photos in active pool to display` regression that appeared when selecting the `Google Photos` feed.
* **Implementation**:
  * **Shared external-feed support**: Extended the functional-core feed builder in `server/domain/selectors.js` so category selection can merge curated collections with source-specific external collections such as cached Google Photos items.
  * **Reducer and snapshot plumbing**: Updated `server/domain/reducer.js`, `server/domain/snapshot.js`, and `server/app.js` so the live dispatcher receives Google Photos cache rows as runtime `externalCollections` instead of treating `Google Photos` like a curated category with no backing list.
  * **Regression coverage**: Added domain tests in `server/domain/tests.js` proving that `buildBalancedFeed(...)` and `select-categories` both keep a Google Photos pool populated from external cache state.
* **Learning**: Category normalization was already permissive enough to accept `Google Photos`, but the pure recompute path only looked at curated collections. A category can be valid in the selector layer yet still collapse to an empty pool unless the feed source is represented explicitly in the shared state model.
* **Verification**: `npm test` passed. `npm run lint` passed. `systemctl --user restart lumina` succeeded. Live checks against `http://127.0.0.1:5000/api/config` and `http://127.0.0.1:5000/api/photos?category=Google%20Photos` showed `currentCategory: "Google Photos"` with `74` photos in the active pool.

### 2026-07-04: Google Photos Crop Persistence & Aspect-Preserving Preview Fix
* **Goal**: Fix three related Google Photos regressions: squished paired images in the `TV Gesture Controller` preview, Direct Control crop/scroll snap-back, and a non-working `Photo Crop/Zoom (Rating Deck)` slider.
* **Implementation**:
  * **Aspect-preserving proxy URLs**: Updated `server/services/googlePhotos.js` and `server/routes.js` so Google Photos proxy URLs no longer request server-side cropped landscape bytes by default. Explicit crop remains opt-in, but the normal rendering path now preserves the source aspect ratio.
  * **Unified metadata projection**: Extended `server/sockets.js` so `report-photo-metadata` and `set-photo-crop` use the same cache-backed Google Photos metadata path as pairing updates, instead of falling through the curated-collections reducer path that cannot see proxy-only photos.
  * **REST metadata parity**: Broadened the Google Photos branch in `server/routes.js` so crop updates (`cropPercent`, `cropPositionY`) and pairing flags can be patched through one declarative metadata payload, with crop validation still flowing through the existing decoder.
  * **Preview-dimension hygiene**: Updated `client/src/hooks/useImagePreloader.js` to cache `naturalWidth` / `naturalHeight` for preview math instead of relying on the looser `width` / `height` properties.
  * **Regression coverage**: Expanded `run-tests.js` to lock the new no-default-crop proxy contract while preserving an explicit crop opt-in path.
* **Learning**: For Google Photos, the remote preview and the live crop state are coupled through two independent truths: the actual proxied bitmap shape and the persisted per-image metadata. If either one falls back to a curated-only assumption, the operator sees either a squished preview or a crop value that snaps back after interaction.
* **Verification**: `npm test`, `npm run lint`, and `npm --prefix client run build` passed. `systemctl --user restart lumina` succeeded, `http://127.0.0.1:5000/api/config` responded afterward, and the live Google Photos normalization now emits proxy URLs without the `c=1` crop flag by default.

### 2026-07-04: Google Photos Pairing Toggle Persists Outside Curated Collections
* **Goal**: Fix the `Allow Side-by-Side Pairing` toggle when used on Google Photos items, where the switch appeared stuck in the `On` position.
* **Implementation**:
  * **Google Photos metadata helpers**: Extended `server/services/googlePhotos.js` with proxy-url id parsing plus focused helpers to merge cached metadata updates and project them back onto the live runtime snapshot.
  * **Socket fix**: Updated `server/sockets.js` so `set-photo-prevent-pairing` bypasses the curated-collections reducer path for Google Photos proxy URLs and persists the pairing flag directly into `google_photos_cache.json` while keeping the in-memory state in sync.
  * **REST parity**: Updated `server/routes.js` so `PATCH /api/photos` can apply a Google Photos pairing-only mutation through the same cache-backed path instead of silently missing the photo.
  * **Regression coverage**: Added cache-helper assertions in `run-tests.js` covering proxy id extraction, cached pairing metadata updates, and live-state projection.
* **Learning**: Per-image display metadata no longer belongs conceptually to only `curated_collections.json`. Source-specific feeds like Google Photos need the mutation path to target their own persistence store instead of assuming every editable image lives in the curated collections map.
* **Verification**: `npm test`, `npm run lint`, and `.agents/skills/lumina-diagnostics/scripts/diagnose.sh` passed. `systemctl --user restart lumina` succeeded and `curl http://127.0.0.1:5000/api/config` responded successfully afterward.

### 2026-06-30: Direct Control Pairing Toggle Preserves Focused Portrait Preview
* **Goal**: Make the `Allow Side-by-Side Pairing` toggle in Direct Control behave like an editable preview control instead of seeming to skip away from the portrait being adjusted.
* **Implementation**:
  * **Focused single-photo preservation**: Updated `server/domain/reducer.js` so a `set-photo-prevent-pairing` command can optionally preserve the targeted portrait as the active photo when pairing is turned off from a split view.
  * **Socket passthrough**: Extended `server/sockets.js` to forward the new `preserveActive` intent and keep the legacy fallback path aligned.
  * **Direct Control UX fix**: Updated `client/src/components/remote/DirectControlTab.jsx` so disabling pairing on the focused portrait requests that single-photo preservation instead of immediately collapsing back to the other half of the split frame.
  * **Regression coverage**: Added a reducer test in `server/domain/tests.js` proving that disabling pairing on the focused secondary portrait yields a single-image frame with that same portrait still active.
* **Learning**: In split portrait mode, metadata edits that change layout must preserve the operator's focused image when the intent is preview/editing, otherwise the toggle reads like a slideshow navigation action.
* **Verification**: `npm test` passed. `npm run lint` passed. `npm --prefix client run build` passed. The known sandbox-only `listen EPERM` log still appears inside the ephemeral localhost smoke section, but the suite exits successfully.

### 2026-06-29: Selector-Core Reuse & Declarative Feed Config Presets
* **Goal**: Make another ES6+/functional cleanup pass without sacrificing readability, and keep the JavaScript surface closer to the reducer/selector foundation that will later migrate to TypeScript.
* **Implementation**:
  * **Legacy app dedupe**: Refactored `server/app.js` so `combineFeedsBalanced`, `selectWeightedRandomPhoto`, `isTimeInSchedule`, and the smart-photo filter pipeline now reuse the shared implementations in `server/domain/selectors.js` instead of carrying parallel copies.
  * **Preset-driven config builder**: Reworked `server/config/state.js` so feed configs are assembled from a small keyword-source factory plus a frozen built-in override table, replacing the long category `if/else` ladder with a declarative `Object.fromEntries(...)` projection.
  * **Collection projection reuse**: Updated `server/config/collections.js` to reuse the immutable `updatePhotoInCollections(...)` selector helper and compact state-photo sync helpers instead of nested mutation loops.
  * **Regression coverage**: Added tests in `run-tests.js` covering declarative feed-config layering and legacy crop projection across `photosList` plus `activeSecondPhoto`.
* **Learning**: For Lumina, the cleanest “functional” move is often not adding more combinators or point-free wrappers, but collapsing duplicate implementations onto the existing pure selector layer. That reduces drift now and lowers the TypeScript conversion surface later.
* **Verification**: `npm test` passed. `npm run lint` passed. The known sandbox-only ephemeral localhost bind warning still appears in the smoke-test section, but the regression suite exits successfully.

### 2026-06-28 (Part 3): Persistent `systemd --user` Service Installation
* **Goal**: Stop relying on ad hoc manual launches for the TV host and make Lumina survive logout and reboot through `systemd`.
* **Implementation**:
  * Added a tracked service template at `systemd/lumina.service.template` rather than committing host-specific absolute paths directly into git.
  * Added `scripts/install-systemd-user-service.sh`, which resolves the current repo root, `node` binary, user, UID, and user config directory at install time, then materializes `~/.config/systemd/user/lumina.service`.
  * Updated `README.md` with `systemctl --user` installation and operations guidance.
  * Installed and enabled the user service on `playwright`, then enabled lingering for `alex` so the service stays available across logout/reboot.
* **Operational Result**:
  * `systemctl --user status lumina` reports the service active.
  * `curl http://127.0.0.1:5000/api/config` responds successfully.
* **Learning**: Because Lumina depends on the logged-in GNOME stack, Mutter DBus, PulseAudio/PipeWire, and kiosk browser launch behavior, a `systemd --user` service is the correct execution model; a root system service would be the wrong integration boundary here.
* **Verification**: `npm test` passed. The long-standing sandbox-only `listen EPERM` warning still appears in the ephemeral localhost smoke-test section, but all assertions passed and the real host service responds on port `5000`.

### 2026-06-28 (Part 2): Nullish-Safe Selector Defaults & Declarative Cleanup
* **Goal**: Make the selection and persistence layers more fluent and falsy-safe by using modern ES6+ operators where they improve both readability and behavior.
* **Implementation**:
  * **Selector cleanup**: Refactored `server/domain/selectors.js` to use `??`, `?.`, default parameters, and `Array.prototype.at()` in category normalization, weighted selection, split-frame derivation, and weather/news fallbacks.
  * **Night-percentage bugfix**: Replaced `nightPercentage || 50` with `nightPercentage ?? 50` in both the domain selectors and legacy `server/app.js`, so an explicit `0` percent night preference is no longer silently treated as `50`.
  * **Persistence codec cleanup**: Refactored `server/config/collectionsCodec.js` with destructuring, nullish-aware cloning helpers, and explicit fallback handling for persisted split crop values and manual location state.
  * **Regression coverage**: Added tests proving that explicit `false` metadata is preserved during photo tagging and that persisted `splitCropPercent: 0` survives normalization.
* **Learning**: Apply `??` only where `null`/`undefined` are the real “missing value” states. Keep truthy fallbacks or validation guards when empty strings or wrong types should still collapse to safe defaults.
* **Verification**: `npm test` passed. The known ephemeral localhost bind warning (`listen EPERM`) still appears in the smoke-test section but the command exits successfully and all assertions pass.

### 2026-06-24: TV Controller Rating Fallback Bugfix
* **Issue**: The remote control rating widget displayed `undefined (Weight: 1)` for photos that did not yet have a rating set.
* **Root Cause**: The client-side rating component was reading the photo's rating field without providing a default value.
* **Fix**: Added a safe fallback expression: `const currentRating = activePhoto && activePhoto.rating !== undefined ? activePhoto.rating : 10;`.
* **Learning**: Avoid assuming all metadata properties are initialized; provide logical defaults (e.g. standard rating weight `10`).

### 2026-06-25: REST API Integration & Test Automation
* **Goal**: Implement a fully RESTful API to configure and control Lumina next to the real-time Socket.IO synchronization layer.
* **Implementation**:
  * Refactored server routes to expose endpoints for state query/updates (`GET`/`PATCH` `/api/state`), screensaver toggle (`POST` `/api/state/screensaver`), scenic pool configuration (`GET`/`POST`/`PATCH`/`DELETE` `/api/pools`), and photo actions (rating, cropping/zooming, previews, next/prev transitions).
  * Automated testing: Added programmatic server start and teardown on a dedicated test port (`5001`) during integration testing to guarantee smoke tests run reliably and independently.
* **Verification**: Established a suite of 50 unit and integration tests.

### 2026-06-26: Live Weather Humidity & Cursor Auto-Hiding
* **Goal**: Display relative humidity in the weather widget and hide the mouse pointer during screensaver playback.
* **Implementation**:
  * **Humidity**: Extracted `relative_humidity_2m` from the live meteorological API payload and added a soft-styled `.weather-humidity` display utilizing a droplet icon.
  * **Cursor Auto-Hide**: Implemented a mouse-movement listener in the main dashboard. If no movement is detected for 3 seconds, a `.hide-cursor` class is applied via CSS (`cursor: none !important`). The timer clears automatically on movement and is paused when the settings drawer is open.

### 2026-06-27: Custom Keyword Chip UI & Safety Bounds
* **Goal**: Upgrade keyword configuration to a tag chip UI and ensure rating input bounds are safe.
* **Implementation**:
  * **Tag Chip UI**: Replaced comma-separated text strings with an interactive tag chip component supporting tag creation via commas, semicolons, or the Enter key. Added automatic deduplication and validation for time-restricted keyword items.
  * **Safe Rating display**: Unified fallbacks across the remote dashboard, formatting `undefined` or default states explicitly as `10 (Default / Max)`.

### 2026-06-27 (Part 2): TV Screensaver Rapid Skipping Fix & Default Pool Config
* **Goal**: Fix rapid screensaver wallpaper rotation (every 3-5 seconds) when creating/activating new pools, and disable broken Art Institute of Chicago URLs by default.
* **Implementation**:
  * **Preloader Hook Cleanup**: Added cleanup logic to the preloader `useEffect` hook in `Dashboard.jsx` to abort previous preloading requests when the state or categories change, preventing orphaned background loaders from triggering slide skips on error.
  * **Crawl Defaults**: Changed the default pool configurations to disable the `artic` crawler by default. This avoids flooding new custom pools with broken URLs that get Cloudflare 403 blocks in datacenter environments.
* **Verification**: Added automated tests to assert the crawler configuration, rebuilt client assets, and successfully passed the Playwright E2E integration test (`test_split_sync.js`).

### 2026-06-27 (Part 3): Functional Programming Refactor & State Synchronization Fix
* **Goal**: Refactor server-side state projection, tagging/filtering algorithms, and client-side preloader to use clean, declarative, functional programming paradigms, and resolve split portrait synchronization bugs.
* **Implementation**:
  * **Unified Photo Updaters**: Refactored `collections.js` to replace duplicate, imperative loops in `updatePhotoRating`, `markPhotoBroken`, `updatePhotoCrop`, and `updatePhotoPreventPairing` with a single, curried `updatePhotoField` orchestrator. This fixed a bug where setting ratings/crops on portrait photos did not synchronize to the split/paired second photo (`state.activeSecondPhoto`).
  * **Declarative Server Pipelines**:
    * Refactored keyword tagging inside `app.js` using composed, curried classifiers (`tagSinglePhoto`, `classifyAtmosphere`).
    * Refactored `combineFeedsBalanced` using functional pipe-composition of pure `shuffle` and `interleave` functions.
    * Replaced imperative loops in `selectWeightedRandomPhoto` with a mathematical Cumulative Distribution Function (CDF) reducer and `find` predicate.
    * Composed the smart wallpaper selection filters (`getSmartPhoto`) using curried, piped stages (`filterByTime`, `filterByWeather`, `filterByNight`).
  * **Promise-based Client Preloader**: Rewrote the nested recursive callback queue in `Dashboard.jsx` to use a clean async/await loop based on a Promise-wrapped image loading utility.
* **Verification**: All 50 diagnostic and integration smoke tests pass 100%. Compilation builds successfully.

### 2026-06-27 (Part 4): Comprehensive Backend Functional Upgrades
* **Goal**: Refactor secondary backend modules (weather codes, news sentiment, audio sink inputs, crawler configuration builders, and IP retrievers) to remove mutable variables, index loops, and imperative conditions.
* **Implementation**:
  * **News Sentiment Regex & Classifier**: Replaced the mutative `while` loop parsing Google News RSS feed with a declarative `matchAll` mapping in `sentiment.js`, and extracted sentiment label calculations into a pure `classifyScore` mapper.
  * **WMO Weather Code Lookup**: Replaced the nested `if/else` condition chains in `weather.js` (`classifyWeatherCode`) with a constant-time $O(1)$ lookup mapping dictionary.
  * **Declarative Audio Active Checker**: Refactored the imperative `for` loop in `system.js` (`isAudioPlaying`) to cleanly slice, filter, and match active inputs via the `.some` array predicate.
  * **Crawler Config Mapper**: Refactored `buildFeedConfigsFromKeywords` in `crawler.js` to flatMap custom categories and reduce configs into a clean declarative output.
  * **Local IP Resolver**: Refactored `getLocalIpAddresses` in `app.js` to use a single chain of `Object.values`, `.flat()`, `.filter()`, and `.map()`.
* **Verification**: All 50 diagnostics and smoke tests passed. Integration split sync test suite passed.

### 2026-06-27 (Part 5): Pure System Reducers & Curried Validators
* **Goal**: Refactor the main screensaver daemon activation loop, crawler scheduling blocks, and endpoint validators to use pure state machine reducers, declarative map-flatMap queues, and curried parameter validator scopes.
* **Implementation**:
  * **Daemon State Machine Reducer**: Extracted Mutter idle loop condition checks into a pure `getNextScreensaverState` state transition reducer. Unit tests were added to run-tests.js to assert action schedules ('launch' vs 'kill') and idle ticks.
  * **Crawler Jobs mapping**: Refactored `crawlAllCollections` in `crawler.js` to flatMap configs into a flat Crawl Jobs array, replacing nested loops with flat sequential executions.
  * **Curried validation scopes**: Created `validation.js` containing a curried `validateRange` factory, defining and exporting `validateRating` and `validatePercent`. We replaced inline parameter validations in routes.js and sockets.js with these clean validators.
* **Verification**: All 51 assertions passed. Integration E2E tests verified successfully.

### 2026-06-27 (Part 6): Functional Core Dispatch, Derived Frames, and REST-First Snapshots
* **Goal**: Move Lumina toward a functional core / imperative shell architecture in JavaScript, with TypeScript-ready JSDoc contracts and a REST-first derived snapshot model.
* **Implementation**:
  * **Typed Domain Layer**: Added `server/domain/` modules with `@ts-check` JSDoc contracts for command types, reducers, selectors, domain snapshots, and persistence-oriented tests.
  * **Unified Command Path**: Added a shared reducer/dispatcher flow for category selection, photo rating, preview/advance actions, split settings, exclusions, screensaver activation, and pool lifecycle transitions. Both REST routes and Socket.IO handlers now decode into the same command shapes for the refactored surface area.
  * **Derived `currentFrame` Snapshot**: Introduced a server-derived `currentFrame` object and started removing client-side split-pair orchestration. The dashboard now reports photo metadata to the server and renders the server-selected secondary portrait instead of inventing its own pairing state.
  * **Persistence Codec**: Added `server/config/collectionsCodec.js` to normalize persisted collections/config, re-seed empty categories after dedupe, and write a canonical snapshot shape.
  * **Transport Hardening**: Fixed test harnesses to bind ephemeral localhost ports instead of assuming `5001`, and changed the client Socket.IO URL logic to use same-origin by default with a Vite-dev exception (`5173 -> 5000`). This fixes split sync and REST smoke tests when the daemon self-heals onto fallback ports.
* **Verification**: `npm test` passed with 64/64 assertions. `npm run test:integration` passed on `playwright` after rebuilding the client bundle.

### 2026-06-27 (Part 7): Split Portrait Wallpaper Failures Fix
* **Goal**: Prevent the screensaver from displaying a half-blank/black screen when a secondary split portrait wallpaper fails to load.
* **Implementation**:
  * **Secondary Preload Handling**: Updated the client-side preloader in `client/src/components/Dashboard.jsx` to track if the secondary photo loads successfully.
  * **Pruning and Fallback**: If the secondary photo fails to load, the client now emits a `mark-photo-broken` socket event using the secondary image URL to immediately flag and prune it from the collections, and falls back to rendering the primary photo as a fullscreen single slide (`addSingleSlide`).
* **Verification**: Verified that unit tests (`npm test`) and E2E integration tests (`node test_split_sync.js`) pass successfully.

### 2026-06-27 (Part 8): Optional Tumblr Tag Search via API Key
* **Goal**: Add Tumblr tag-based crawling without disturbing the existing zero-credential public-blog Tumblr source.
* **Implementation**:
  * **Optional authenticated crawler**: Added `fetchTumblrTaggedImages` in `server/services/crawler.js` using Tumblr's official `GET /v2/tagged` API. The crawler activates only when `TUMBLR_API_KEY` is present in the server environment; otherwise it logs a skip and returns an empty result safely.
  * **Feed config support**: Added a new `tumblrTags` source alongside existing `tumblr` blog crawling in the default feed config builders so built-in scenic pools can opt into curated tag queries without losing the legacy blog lists.
  * **Remote UI**: Extended `client/src/components/remote/ImageFeedsTab.jsx` with a new `Tumblr Tag Search` source card and inline operator guidance that the source requires `TUMBLR_API_KEY`.
  * **Regression coverage**: Added test coverage proving the tagged crawler is exported and safely no-ops when the API key is absent.
* **Verification**: `npm test` passed. In this sandbox, the live endpoint smoke sub-suite still logs `listen EPERM` when trying to bind an ephemeral localhost port, but the command exits successfully and the new Tumblr-tag assertions pass.

### 2026-06-27 (Part 8): Remove Google DeepMind Footer Attribution
* **Goal**: Remove incorrect footer attribution "POWERED BY GOOGLE DEEPMIND" from the Remote Control user interface.
* **Implementation**:
  * Modified `client/src/components/RemoteControl.jsx` to omit the "• POWERED BY GOOGLE DEEPMIND" string from the system info paragraph.
* **Verification**: Verified that all diagnostics and tests run successfully.

### 2026-06-27 (Part 9): Portrait Split Crop/Zoom Refinement & Touch Isolation
* **Goal**: Fix touchpad drag-to-crop vs. swipe-to-skip touch conflicts, reduce slider zoom response latency on the TV, add focus-based dual photo controls, and correct in-place slide check caching bugs.
* **Implementation**:
  * **Touch Isolation**: Called `e.stopPropagation()` in touchstart, mousedown, and touchend handlers on both single and split preview panes in `client/src/components/remote/DirectControlTab.jsx`, preventing drag gestures from triggering the parent swipe-to-skip controller.
  * **Focus-Based Controls**: Introduced a `selectedPhotoSide` state in `client/src/components/RemoteControl.jsx`. Tapping on either the Left or Right preview pane focuses that photo (highlighted by a glowing border), dynamically binding the zoom slider, rating deck, and pairing toggle below to it.
  * **Real-Time Responsiveness**: Reduced debounced socket emits from `200ms` to `30ms` on the Direct Control tab, and added a local crop range state with `30ms` throttled emits on the Image Feeds rating deck. Zoom changes now update the TV screen dynamically as you drag.
  * **Resolved In-place Check**: Updated the TV view slide-change check in `client/src/components/Dashboard.jsx` to compare resolved crop values rather than raw values, ensuring changes to global defaults (like `splitCropPercent`) are applied instantly.
* **Verification**: Verified successfully via automated unit tests (`npm test`) and Playwright E2E split sync tests (`node test_split_sync.js`).

### 2026-06-27 (Part 10): Standardized Secret Storage on `.env`
* **Goal**: Stop scattering secrets across `config.json`, sidecar JSON files, and ad hoc runtime paths by making `.env` the single secret store.
* **Implementation**:
  * **Central env helper**: Added `server/config/env.js` to load `.env`, read environment variables consistently, and persist updated keys back to the same file with quoted serialization.
  * **Config hardening**: Updated `server/config/configLoader.js` so secret-like keys in `config.json` are ignored with a warning instead of being treated as supported configuration.
  * **Credential migration**:
    * `USEAPI_TOKEN`, `TUMBLR_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `NASA_API_KEY` are now read from `.env`.
    * Google Photos credentials no longer persist to `server/config/.google_credentials.json`; they are written to `.env` through the shared helper.
  * **Admin UI alignment**: Added a Tumblr API key field in `client/src/components/remote/SystemSettingsTab.jsx` and updated Google/UseAPI copy so the operator-facing UI reflects the `.env` policy.
  * **Documentation and examples**: Added a tracked `.env.example`, updated `README.md`, and removed secret fields from `config.json.example`.
  * **Regression coverage**: Added an env-helper unit test proving secret values are appended/replaced safely with quoted serialization.
* **Verification**: `npm test` passed. `npm run lint` passed cleanly. The existing smoke-test sandbox limitation still logs `listen EPERM` when binding ephemeral localhost ports.

### 2026-06-27 (Part 11): Direct Control Portrait Zoom Sync Hardening
* **Goal**: Make per-image zoom changes from the Direct Control slider show up immediately on the TV for split portrait layouts and stay persisted on the correct image.
* **Implementation**:
  * **Live photo resolution**: Updated `client/src/components/Dashboard.jsx` and `client/src/components/RemoteControl.jsx` to resolve crop metadata by image URL from the current frame, active photo pointers, and live feed list before falling back to stale slide snapshots.
  * **Split-frame crop refresh**: Hardened the dashboard's in-place active-slide crop refresh so paired portrait updates read from the resolved live secondary photo instead of whichever `activeSecondPhoto` object happened to be cached.
  * **Regression coverage**: Added a reducer test proving `set-photo-crop` updates flow through both the active portrait and its derived split partner frame metadata.
* **Verification**: `npm test` passed, including the new crop regression. `npm --prefix client run build` passed. In this sandbox, the existing live-endpoint smoke section still logs `listen EPERM` when it attempts an ephemeral localhost bind.

### 2026-06-28: Frame-Selector Cleanup for Zoom/Crop State
* **Goal**: Reduce the client-side state ambiguity around `activePhoto`, `activeSecondPhoto`, `photosList`, and `currentFrame` so zoom/crop rendering follows one consistent execution path.
* **Implementation**:
  * **Single client selector layer**: Added `client/src/state/frameSelectors.js` to normalize transport snapshots and expose helpers for current-frame lookup, split-layout detection, frame orientation, URL-based photo lookup, and effective crop state resolution.
  * **TV renderer cleanup**: Refactored `client/src/components/Dashboard.jsx` to drive active slide updates and rendered crop math from the frame selectors instead of mixing `activePhoto`, `activeSecondPhoto`, local orientation guesses, and feed scans.
  * **Remote control cleanup**: Refactored `client/src/components/RemoteControl.jsx`, `client/src/hooks/useActivePhotoSync.js`, and `client/src/hooks/useCropDrag.js` so the Direct Control tab resolves the focused image and crop values from the same frame-based selectors the TV uses.
  * **UI-path regression**: Updated `test_split_sync.js` so the integration test moves the actual Direct Control slider UI for both split portrait and single-landscape flows rather than bypassing the UI with a raw socket emit.
* **Verification**: `npm test`, `npm run lint`, and `npm --prefix client run build` passed. In this sandbox, `node test_split_sync.js` still exits after the known ephemeral localhost bind warning (`listen EPERM`) before producing usable browser-stage logs, so the UI-path assertions could not be fully observed here.
### 2026-06-29: Google Photos Picker API Migration
* **Goal**: Fix the 403 Forbidden errors when listing media items due to Google's deprecation of broad `photoslibrary.readonly` scopes on March 31, 2025, and transition to the secure, privacy-respecting Google Photos Picker API.
* **Implementation**:
  * **OAuth Scopes**: Updated scopes in `server/services/googlePhotos.js` to request `https://www.googleapis.com/auth/photospicker.mediaitems.readonly`.
  * **Picker Session Manager**: Implemented `createPickerSession()`, `getPickerSession()`, `listPickerMediaItems()`, and `deletePickerSession()` to manage user-initiated photo picking sessions.
  * **Dynamic Redirect URI**: Modified `server/routes.js` to build `redirectUri` dynamically from `req.headers.host` for localhost SSH tunneling.
  * **Background Polling & Sync**: Added a background polling process in `routes.js` that checks for session selection completion, pulls the selected private photo metadata, updates the display feed, and cleans up the session resources.
* **Verification**: `npm test` passed successfully. Tested systemd service restarts and verified service is active.

### 2026-06-29: Google Photos Admin Preview Proxy Repair
* **Issue**: Google Photos items in the admin Image Feeds panel were showing "Source link is broken or restricted."
* **Root cause**:
  * The Picker sync layer was reading `item.baseUrl` even though the Picker API returns image data under `item.mediaFile.baseUrl`, so Lumina cached `url: "undefined=w2560-h1440-c"` entries in `server/config/google_photos_cache.json`.
  * Even with a valid Picker `baseUrl`, the browser cannot fetch Google Photos image bytes directly from CSS/`Image()` because the Picker guide requires the app to attach an OAuth bearer token when requesting that URL.
* **Fix**:
  * Refactored `server/services/googlePhotos.js` to normalize cached Google Photos items into Lumina-owned proxy URLs (`/api/google-photos/media/:id`), while storing the actual Picker `mediaFile.baseUrl`, MIME type, dimensions, and picker session id separately for server-side fetches.
  * Added a protected proxy route in `server/routes.js` that fetches the Google image bytes with the server's OAuth token and returns them to the browser as same-origin media.
  * Kept completed picker sessions instead of deleting them immediately so Lumina can rehydrate stale Google base URLs later instead of treating the initial cached response as permanent.
  * Persisted `GOOGLE_REFRESH_TOKEN` in Lumina's shared `.env` store and taught the service to mint a fresh access token on demand at startup, so Google Photos access now survives daemon restarts instead of living only in process memory.
  * Added regression coverage in `run-tests.js` for the nested `mediaFile` shape and the proxy URL contract.
* **Verification**: `npm test` passed. `npm run lint` passed. `systemctl --user restart lumina` succeeded and `GET /api/photos?category=Google Photos` now returns proxy URLs under `/api/google-photos/media/...`.

---

## 🧬 Crucial Gotchas & Design Rules

To prevent regressions, all visiting developers must strictly abide by the following architectural constraints:

### 1. React useEffect Hook Cleanup for Preloaders
When writing components that preload images dynamically in response to state changes:
* **Rule**: Always maintain an `active = true` local flag and return a cleanup function in the `useEffect` that sets `active = false` and cancels event handlers (`onload`/`onerror`). Verify this flag before executing any callbacks or emitting socket actions.
* **Why**: Outstanding background preloaders from previous renders will otherwise trigger state updates or error cascades (e.g. next-photo skips) when they complete, leading to rapid slideshow rotation cycles.

### 2. Always Bind Image Event Handlers Before Setting `src`
When preloading wallpaper images dynamically via Javascript (`new Image()`), **always** assign `onload` and `onerror` handlers *before* setting the `src` property:
```javascript
const img = new Image();
img.onload = () => { /* Handle load */ };
img.onerror = () => { /* Handle error */ };
img.src = imageUrl;
```
* **Why**: For cached images, browsers may execute the load handler synchronously upon setting `src`. Setting `src` first can cause these events to fire before the handlers are attached, resulting in frozen preloader spinners.

### 2. Double-Buffer Slideshow (DOM Memory Guard)
Chromium kiosk sessions running high-resolution (2K/4K) images can experience huge memory leaks if multiple slides linger in the DOM.
* **Architecture**: The screensaver uses a double-buffering scheme keeping **at most two slide elements** in the DOM (one active, one fading out). Preloading is done off-screen in memory. Do not refactor the slideshow to keep large arrays of images in the DOM.

### 3. Target Active Slides in Automated Integration/E2E Tests
* **Gotcha**: Because the slideshow uses cross-fades, the old slide remains in the DOM temporarily while fading out.
* **Rule**: When writing UI automation tests or selecting image elements, always qualify selectors with the active class (e.g. `.slide.active img`) to ensure you do not query an obsolete, transitioning-out element.

### 4. Atmospheric Weather & News Sentiment Alignment
The screensaver automatically maps live conditions and global sentiment to active wallpaper choices:
* Meteorological rain/snow overrides everything, forcing rainy or snowy wallpapers.
* If weather is clear, news sentiment RSS feeds are parsed: highly positive sentiment prioritizes sunny/golden wallpapers, while highly negative sentiment prioritizes stormy/rainy wallpapers.

### 5. API / Crawler Test Tolerance
* **Gotcha**: The crawler relies on keyless third-party APIs (Lexica, Bing, Wallhaven). Lexica can occasionally throw transient HTTP 500 errors.
* **Rule**: The integration test suite tolerates single crawler failures (e.g., Lexica 500) as long as backup crawler pools return at least one valid image, preventing the entire suite from failing due to external network instability. Do not disable or break tests due to transient endpoint errors.

### 6. Target Host Execution Only (Never Copy to Gateway)
* **Failed Assumption**: Attempting to run tests, build the client, or start server daemons locally on the gateway host environment (`filament`) instead of the target TV host (`playwright`).
* **Why it Fails**: The local gateway lacks graphical libraries, Wayland/X11 displays, Chromium dependencies, and the DBus session connections required by Mutter.
* **Rule**: Perform all edits through the sshfs mount, but execute all commands, tests, and server processes strictly on the `playwright` host (`alex@playwright`).

### 2026-06-29 (Phase 12): Proxy-backed Google Photos Exposed Two Separate Jump Loops
- **Issue**: After Google Photos started rendering on the TV again, the slideshow still appeared to "jump" rapidly as if many photos were broken or inaccessible.
- **Root Causes**:
  - `Dashboard.jsx` treated a slide as uninitialized unless `primaryPhoto.url.startsWith('http')`. That was accidentally true for older third-party feeds, but false for the new same-origin Google Photos proxy URLs (`/api/google-photos/media/...`), so the client kept re-fetching and re-randomizing the category.
  - Separately, the idle daemon loop in `server/app.js` combined `isAudioPlaying()` with `isSessionInhibited()`. Once Lumina launched its own Chromium kiosk, the running browser session could trip the inhibition check and make the daemon dismiss the kiosk it had just spawned, then relaunch it again on the next idle poll.
- **Fix**:
  - `Dashboard.jsx` now treats any truthy `primaryPhoto.url` as initialized instead of assuming valid slide URLs must begin with `http`.
  - `server/app.js` now only considers session inhibition when the kiosk browser is not already running, which stops Lumina from using its own kiosk session as a reason to tear itself down.
  - `server/services/system.js` also defaults Chromium back to a safer acceleration profile, with the more aggressive GPU flags available only through `LUMINA_CHROMIUM_ACCELERATION_PROFILE=aggressive`.
- **Verification**:
  - Live probe on `2026-06-29` showed the same `activePhoto.url` remaining stable across six 4-second samples on `Scenic Nature`.
  - After switching the live category back to `Google Photos`, the same proxy URL remained stable across six 4-second samples instead of rotating every few seconds.
  - `journalctl --user -u lumina` stopped showing the prior rapid `Spawning Fullscreen Kiosk Screensaver...` / `Dismissing Kiosk Browser...` oscillation after the service restart with the daemon fix.

### 2026-06-30 (Phase 13): Resolved Fullscreen Chromium Error Pages & Spurious Dismissals
- **Issue**: The HTPC would sometimes show a default Chromium connection error page full screen on the TV, and once displayed, the screensaver would not restart or recover automatically. Additionally, when the screensaver did launch, it would often immediately dismiss itself.
- **Root Causes**:
  - **Startup Race Condition**: When the server restarts (e.g. during a port collision), it takes up to 1 second to bind to the fallback port. Meanwhile, if the system is already idle, the Mutter daemon polls and spawns Chromium immediately, before the server is actually listening on the port.
  - **No Auto-Reload**: Chromium doesn't try to auto-retry page loads by default, leaving the error screen displayed indefinitely.
  - **Stuck Daemon State**: The launch callback in `launchChromiumKiosk` was broken. Normal exits (code 0) didn't call `onUnexpectedExit`, leaving `isBrowserRunning = true` stuck in the daemon. Post-launch crashes tried to run X11/Wayland startup fallbacks instead of just notifying the daemon.
  - **Synthetic mousemove Dismissal**: The TV dashboard listened to any `mousemove` event to dismiss the screensaver, but Chromium fires synthetic `mousemove` events when elements are mounted/updated in the DOM, causing immediate self-dismissal.
- **Fix**:
  - **Kiosk Launch Guard**: Added `server.listening` check in `app.js` to defer spawning the kiosk browser if the server is not yet fully listening.
  - **Auto-Reload**: Added `--enable-offline-auto-reload` to `BASE_CHROMIUM_FLAGS` in `system.js` so Chromium auto-retries on connection failures.
  - **Robust Exit Monitoring**: Refactored `launchChromiumKiosk` to run a clean launch sequence. Checked process running duration: if a process exits after >5 seconds (crashes or normal exits), call `onUnexpectedExit` directly.
  - **Synthetic Event Filter**: Added `lastMousePosRef` in `Dashboard.jsx` to store coordinates, ignoring `mousemove` events unless coordinates have actually changed.
- **Verification**:
  - All 77 unit and integration tests successfully passed.
  - Manually verified that the screensaver successfully handles manual activation, respects audio playing/movie guards, and filters out synthetic mouse moves.

### 2026-07-03 (Phase 14): Direct Control Preview Now Uses the TV's Real Viewport
- **Issue**: The `TV Gesture Controller` preview on the remote used the full swipe-pad aspect ratio, which is wider than the actual TV viewport on the phone-sized card. That made the preview show misleading side borders and made crop/zoom adjustments harder to judge.
- **Fix**:
  - `Dashboard.jsx` now reports the live TV viewport size (`window.innerWidth` / `window.innerHeight`) back to the server after mount and resize.
  - `server/sockets.js` stores that ephemeral `tvViewport` payload in live state and broadcasts it to remotes.
  - `RemoteControl.jsx` now fits the preview into a traced inner TV frame using the reported aspect ratio, with `16:9` only as fallback before the TV reports in.
  - `DirectControlTab.jsx` renders the active image inside that centered frame instead of stretching it across the entire gesture pad, and the crop drag math now targets the traced frame height rather than the wider outer card.
- **Verification**:
  - `npm test`, `npm run lint`, and `npm --prefix client run build` passed.
  - Restarted the real `systemd --user` `lumina` service on `playwright`; `systemctl --user is-active lumina` returned `active`.
### 2026-07-04 (Phase 15): Refactored TV Preview Resolution Labels, Layout Cleanups, and Enhanced Diagnostics
- **Issue**:
  - The TV-frame previews had a resolution note overlaid directly on the picture preview, cluttering the UI. The word "display" was used generically when HDMI device make/model couldn't be resolved, and the swipe instructions on the TV Gesture Controller pad had a heavy dark gradient and bouncing icons.
  - The diagnostic check script `/scripts/diagnose.sh` was unable to detect running chromium processes correctly on the TV host due to a pattern matching only `chrome` instead of `chromium-browser` or `chromium`.
- **Fix**:
  - **Resolution metadata**: Refactored `formatTvPreviewMetaLabel` in `RemoteControl.jsx` to return `null` if generic display names (such as "display", "unknown", "default", adapters, or raw port names) are found. If display info has a valid vendor or model name, it formats the make/model and resolution dimensions.
  - **Layout Refactor**: Moved the resolution note off the TV preview frame onto the card's outer subtitle layout in `DirectControlTab.jsx` and `ImageFeedsTab.jsx`.
  - **Gesture pad updates**: Removed the dark gradient overlay and bouncing icon from the TV Gesture Controller pad. Placed the `swipeStatus` instructions underneath the swipe pad for a cleaner look.
  - **Diagnostics & Health checks**: Replaced `pgrep -f "chrome.*kiosk.*mode=tv"` in `diagnose.sh` with `pgrep -f "chrom.*(kiosk|mode=tv)"` and filtered out search utility processes, enabling accurate detection of active `chromium-browser` processes. Added checks to verify the installation of `chromium`/`chromium-browser` and verify the presence/accessibility of the active Wayland display socket `/run/user/1000/wayland-0`.
- **Verification**:
  - All 84 unit and integration tests passed.
  - Diagnostics script ran successfully, verifying the correct active status of the Wayland socket and path availability.

### 2026-07-05 (Phase 16): Documentation Overhaul & Local Screensaver Previews Added
- **Goal**: Bring the main project `README.md` fully up to date with the actual features and backend behaviors, and add local screenshots for direct visual reference.
- **Changes**:
  - Downloaded high-resolution screenshots of the TV weather display dashboard and the mobile remote control interface directly into the repository under a new `screenshots/` directory.
  - Overhauled `README.md` to feature the two local screenshots side-by-side.
  - Updated the Features section to cover Reddit crawls, Lorem Picsum, Bing Image of the Day, the Lexica/Wallhaven fallback AI creation aggregation, and detailed weather-news sentiment alignment logic.
  - Documented mobile remote control updates (swipe pad, system switchboard, mood themes) and Chromium kiosk acceleration profiles (Wayland display resolution, max V8 space size).
- **Verification**:
  - Commits were structured clean and conventional: `docs(readme): overhaul features, architecture, and add screenshots`.
  - Verified files and relative links to `screenshots/remote_control.png` and `screenshots/tv_dashboard.png`.

### 2026-07-07 (Phase 17): Refactored `server/routes.js` Into a Functional HTTP Adapter
- **Goal**: Make `server/routes.js` read like an intentional functional adapter instead of a mixed transport/domain module.
- **Changes**:
  - Replaced the old positional route-registration call with an object-based environment contract, keeping route dependencies grouped by concern instead of argument order.
  - Added shared higher-order route helpers in `server/routes.js` for async routes, single-command routes, and sequential batch-command routes, so the recurring `decode -> dispatch -> present` flow is expressed once.
  - Removed the route-local balanced-feed/category-selection implementation and now build HTTP photo responses through `server/domain/selectors.js`, including Google Photos via `externalCollections`.
  - Added `decodeStatePatchCommand` plus a reducer-backed `patch-state` command so `PATCH /api/state` no longer mutates legacy state inline. Weather refresh now flows through a reducer effect interpreted by `server/domain/dispatch.js`.
  - Collapsed the photo-next/photo-prev handlers into one partially applied factory and moved photo/pool patch batching onto sequential command dispatch instead of ad hoc inline branching.
  - Added domain tests for the new state-patch and screensaver decoders/reducer path, and route smoke coverage for raw-state `PATCH /api/state` responses plus combined `PATCH /api/photos` batching.
- **Learning**:
  - The real FP win was not inventing more small helpers inside the route file; it was deleting route-owned business rules and making the route layer structurally incapable of performing domain mutations outside the reducer.
  - Sequential batch dispatch is the safer default for Lumina command routes because command order matters, and `Promise.all` hides stateful coupling instead of reducing it.
- **Verification**:
  - `npm test` passed.
  - `npm run lint` passed.

### 2026-07-07 (Phase 18): Added Functional Refactor Roadmap Artifact
- **Goal**: Capture the next architectural cleanup sequence in one dedicated artifact that explicitly states Lumina's functional programming objectives and the intended order of refactors.
- **Changes**:
  - Added `FUNCTIONAL_REFACTOR_ROADMAP.md` at the repository root.
  - Documented the coding philosophy, conventions, style rules, and objectives for the refactor program, with explicit bias toward composition, currying, partial application, pure reducers/selectors, and explicit effects.
  - Expanded the roadmap into a step-by-step sequence, starting with `server/sockets.js`, then the remaining domain command surface, `server/app.js`, the command/effect pipeline, the client control surface, and the TypeScript-ready boundary pass.
- **Learning**:
  - The roadmap needed its own artifact instead of being merged into the product roadmap because the product roadmap answers "what Lumina should become," while this artifact answers "how the code should be reshaped to get there cleanly."

### 2026-07-09 (Phase 19): Cross-linked the Global Roadmap to the Functional Refactor Roadmap
- **Goal**: Make the engineering cleanup track discoverable from the main roadmap without collapsing product planning and refactor planning into one document.
- **Changes**:
  - Updated `ROADMAP.md` near the top with an `Implementation Companion` section linking to `FUNCTIONAL_REFACTOR_ROADMAP.md`.
  - Clarified that `ROADMAP.md` remains the product/platform direction document, while the functional roadmap carries the ordered refactor sequence and coding philosophy for the architecture cleanup program.

### 2026-07-10 (Phase 20): Collapsed TV Mood Aesthetics Panel
- **Goal**: Minimize the "TV Mood Aesthetics" panel on the Remote Control interface since the user doesn't change it frequently.
- **Changes**:
  - Wrapped the TV Mood Aesthetics section in a native HTML `<details>` element with a `<summary>` header showing the currently selected theme.
  - Added custom CSS to `client/src/index.css` to remove the default browser details marker and style the summary tag inline.
- **Learning**:
  - Using native HTML `<details>` and `<summary>` elements allows clean, state-free collapsible layout adjustments without introducing extra React state variables.

### 2026-07-14 (Phase 21): Resolved Stuck Permanent Collection Toggle
- **Goal**: Resolve the issue where the "Permanent Collection" loved photo toggle on the Remote Control remained stuck in the off position.
- **Changes**:
  - Identified that the backend daemon running in the background was executing an outdated process from July 12th, prior to the loved-photo feature implementation.
  - Restarted the system-wide systemd user daemon using `systemctl --user restart lumina` to pick up the latest code.
  - Verified that PATCH requests to `/api/photos` for `loved: true` and `loved: false` succeed and are written correctly to `curated_collections.json` on disk.
- **Learning**:
  - Always remember to restart background daemons and system-wide services when deploying new backend code or REST endpoints to ensure runtime compatibility.

### 2026-07-18 (Phase 22): Overhauled Repository Documentation for Major Features
- **Goal**: Update `README.md`, `AGENTS.md`, and workspace documentation to comprehensively reflect major features implemented across recent phases.
- **Changes**:
  - **Ecowitt Indoor Sensor Suite**: Documented Ecowitt GW1200 gateway integration, quiet indoor telemetry line on TV View, persistent SQLite snapshot logging (`sensor_history.db`), Grafana Infinity CSV export (`GET /api/environment/history/export?format=csv`), and Remote Control gateway/unit configuration.
  - **Permanent Collection**: Documented loved photo support (`loved: true`) and eviction-proof rotating pool behavior.
  - **QR Code Widget**: Added QR badge toggle documentation across TV View, Remote Control, and state schema.
  - **REST API Endpoints**: Documented expanded REST control surface (`/api/environment`, `/api/environment/history`, `/api/environment/history/export`, `/api/environment/settings`, `/api/photos`, `/api/state/screensaver`).
  - **Architecture & System Diagrams**: Updated Mermaid data flow diagram in `AGENTS.md` and project structure tree to include modular `server/` hierarchy, `sensor_history.db`, and local gateway polling.
- **Verification**:
  - Ran `node run-tests.js` to ensure all unit, domain, and integration tests pass without regression.

---

## 🧪 Verification & Diagnostics

To run the regression suite, run:
```bash
node run-tests.js
```

A local diagnostic utility script is available at `.agents/skills/lumina-diagnostics/scripts/diagnose.sh` to check port status, daemon status, Mutter DBus connection, and PulseAudio streams.
