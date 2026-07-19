# 🌌 Lumina

Lumina is an elegant, ambient smart display dashboard and Chromecast-style screensaver built for Linux (GNOME/Mutter desktops). Designed to run continuously on dedicated HTPC or home theater setups (such as living room TV PCs), Lumina fuses real-time atmospheric conditions, Google News RSS sentiment analysis, generative AI art, and classical art feeds with native system power control and smart media detection.

It features a dynamically coupled mobile remote control web app that allows full control, swipe-to-navigate gesture pads, and widgets management.

---

## 📸 Screenshots

| 📺 TV Dashboard Display | 📱 Mobile Remote Control |
| :---: | :---: |
| ![TV Dashboard](screenshots/tv_dashboard.png) | ![Mobile Remote](screenshots/remote_control.png) |

---

## ✨ Features

* **🎭 Dynamic Multi-Source Visual Feeds**: Pulls wallpapers dynamically from a rich array of keyless and API aggregators:
  * **Unsplash Search API** (NAPI direct CDN resolution to prevent broken links).
  * **Reddit Subreddits** (including `/r/EarthPorn`, `/r/spaceporn`, `/r/astrophotography`, `/r/AbstractArt`, `/r/Generative`, `/r/LiminalSpace`).
  * **Bing Image of the Day API** (high-definition curated daily photography).
  * **NASA Astronomy Picture of the Day (APOD)**.
  * **Lorem Picsum** random HD photography.
  * **AI Creations fallback**: Automatically uses Lexica.art (surreal dreamscapes) and Wallhaven.cc (cyberpunk) keyless pipelines if no paid `USEAPI_TOKEN` is configured.
  * **Public Art Museums**: Imports classical artworks from the Metropolitan Museum of Art and Art Institute of Chicago (AIC).
* **🌦️ Fused Meteorological & RSS News Sentiment Alignment**:
  * Scrapes Google News RSS top headlines in real-time, matching words against heuristic positive and negative lexicons to calculate a net emotional score.
  * Positive headlines map to sunny/golden wallpapers, negative to stormy/rainy, and neutral to cloudy/moody.
  * Integrates active weather conditions (via Open-Meteo) so that active precipitation (snow, rain) overrides news sentiment.
  * Wallpaper candidates matching these states are served with an **80% preference weight**.
* **🌡️ Local Indoor Environment & Sensor Telemetry Platform**:
  * **Ecowitt-compatible Local HTTP Adapter**: Connects directly to a family of local weather gateways and consoles to read indoor temperature, humidity, barometric pressure, and sensor telemetry without third-party cloud dependencies. GW1200 is the first verified device, not the adapter boundary.
  * **Quiet TV Display Overlay**: Renders a subtle, non-intrusive indoor environmental data line inside the weather widget on the TV View.
  * **SQLite Persistent Sensor Storage**: Logs hourly sensor snapshots into `sensor_history.db`, retaining full raw telemetry payloads (`gateway_metrics`).
  * **Grafana & CSV Export API**: Exposes `GET /api/environment/history/export?format=csv` (as well as JSON endpoints) for seamless Grafana Infinity plugin integration, spreadsheet analytics, and long-term storage.
  * **Adaptive Device Manager**: Admin controls under Remote Control → System → Environment provide a phone-friendly and expanded desktop layout for adding, naming, editing, retaining, and selecting compatible sources. Lumina polls one active device profile at a time.
* **❤️ Permanent Collection & Loved Photos**:
  * Flag favorite wallpapers into a permanent collection (`loved: true`). Loved items bypass standard rotating pool eviction caps, ensuring user favorites stay in active slideshow rotation permanently.
* **🔳 Dynamic QR Code Badge Widget**:
  * On-demand QR code widget toggle on both TV View and Remote Control for fast mobile device coupling.
* **📱 Touch-Optimized Mobile Remote Control**:
  * Interactive swipe pad featuring a darkened real-time preview of the active TV background image.
  * Widgets Switchboard: Toggle TV overlays (clock, particles, weather, QR code badge, aura backlights, Ken Burns pan-and-zoom) on the fly.
  * Mood Theme Selector: Change color schemes instantly (Zen Retreat, Cosmic Night, Art Museum, Cyberpunk Rain).
  * System & Environment Controls: Manage local gateway settings, sensor display units, location settings, and screensaver overrides over REST.
  * Google Photos casting control (direct configuration for OAuth client credentials).
* **🎵 Smart Media Playback Guard**:
  * Actively monitors PulseAudio/PipeWire sink streams via `pactl list sink-inputs`.
  * If a movie is playing or music is active (e.g. Plex, YouTube, Spotify), screensaver activation is automatically bypassed to avoid interrupting entertainment.
* **⚡ CPU Governor Orchestration**:
  * Scales the CPU governor to `performance` when screensaver transitions or particle systems are active for fluid 60fps animations.
  * Restores governor to energy-saving `schedutil` (or powersave) when the screensaver is dismissed (achieving near 0% background CPU impact).
* **🧠 Under 80MB RAM Footprint**:
  * Implements strict V8 engine heap limits (`--max-old-space-size=256`).
  * Uses a client-side image double-buffer slideshow system that preloads incoming wallpapers in the background and mounts at most two slide elements in the DOM, eliminating typical memory locks.
  * Downscales the canvas particles engine by 0.25x (scaled back up via CSS GPU compositor) to halve CPU rendering usage.
* **🔒 Safe Read-Merge-Write Persistence & Ratings Engine**:
  * Perform read-merge-write operations to prevent crawler runs from overwriting manually curated metadata, rating configurations, and search keywords.
  * Banning a photo (rating "1") instantly prunes it from the feed and triggers an immediate transition on all active displays.

---

## 🛠️ Architecture

Lumina uses a decoupled client-server architecture with a REST-first control surface and Socket.IO live event synchronization:
* **Server (Node.js/Express)**: Spawns the GNOME Mutter idle state DBus monitor (running every 2s, dynamically querying `uid` and `homedir`), manages local network discovery, processes news sentiment and weather geolocated coordinates, polls local Ecowitt sensor gateways, logs hourly environmental history to SQLite (`sensor_history.db`), orchestrates CPU governors, and serves REST API endpoints.
* **Client (React/Vite/Vanilla CSS)**: Auto-detects device type (loading Mobile Remote Control or TV Dashboard Kiosk) and renders layouts with glassmorphic styles, bokeh particle canvas systems, customized weather overlays, and quiet indoor environmental telemetry line.

### 🌐 Key REST API Endpoints

* `GET /api/environment`: Current normalized indoor environment reading and gateway status.
* `GET /api/environment/history`: Returns historical hourly environment snapshots (supports `from`, `to`, `limit`).
* `GET /api/environment/history/export?format=csv`: Exports environment history as CSV (or JSON without `format=csv`) for Grafana or spreadsheets.
* `GET /api/environment/settings` / `POST /api/environment/settings`: Read/update saved sensor device profiles, the active source, connection timing, and display unit preferences. Legacy flat Ecowitt settings remain accepted.
* `GET /api/environment/adapters`: List registered protocol adapters and compatibility metadata for the device manager.
* `GET /api/weather`: Outdoor weather forecast & conditions from Open-Meteo.
* `GET /api/photos?category=...`: Returns current photos list for the category.
* `PATCH /api/photos`: Batch update photo ratings, loved status, crops, or pairing rules.
* `POST /api/state/screensaver`: Remote trigger or dismissal of the screensaver kiosk.

## 🗺️ Roadmap

The source of truth for Lumina's product and platform direction is [ROADMAP.md](./ROADMAP.md).

- `ROADMAP.md` tracks the real delivery phases, checkpoints, and acceptance criteria.
- `FUNCTIONAL_REFACTOR_ROADMAP.md` is a supporting Phase 1 implementation companion for the engineering cleanup sequence behind that roadmap. Its step numbering is local to that refactor track.

---

## 🚀 Quick Start

### 1. Requirements
Ensure you have Node.js (v18+) and standard Linux utilities (`chromium`, `busctl`, `pactl`) installed on your target machine.

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/esaul314/lumina.git
cd lumina
npm run install-all
```

### 3. Setup Configuration
Lumina uses two local configuration files:
1. `config.json` for non-secret runtime overrides (port, geolocated coordinates, etc.).
2. `.env` for secrets and API keys.

The quickest setup path is Remote Control → System → Environment → **Add device**. Give the source a friendly name, choose **Ecowitt-compatible LAN gateway**, and enter its local address. Adding the first source makes it active; additional profiles remain saved so they can be selected without re-entering connection details. Lumina deliberately polls one active device at a time.

The same settings are persisted locally under `ecowitt` in the gitignored `config.json`. Existing flat `enabled`/`baseUrl` configurations migrate into one device profile automatically, and the API continues projecting the active profile into those legacy fields for compatibility. Lumina stores canonical sensor values in metric units, while configured units control the TV and remote displays.

Compatibility is based on Ecowitt’s published local HTTP API, specifically `GET /get_livedata_info`. Consult the [official Ecowitt HTTP API protocol](https://oss.ecowitt.net/uploads/20260109/HTTP%20API%20interface%20Protocol%20%28Generic%29-%28V1.0.5-2025-10-08%29.pdf) to check whether a gateway exposes the sensor payloads you need.

The Advanced settings JSON disclosure exposes the same profile document for repeatable setup. JSON is validated configuration only; it cannot install or execute adapter code.

Initialize default configurations:
```bash
cp config.json.example config.json
cp .env.example .env
```

*(Both `config.json` and `.env` are gitignored and will never be committed to your repository.)*

### 4. Running Lumina
For development mode:
```bash
npm run dev
```

For production daemon:
```bash
chmod +x launch.sh
./launch.sh
```
* **Screensaver/TV Display**: `http://localhost:5000/?mode=tv`
* **Mobile Remote Control**: `http://localhost:5000/`

### 5. Installing as a Persistent `systemd` User Service
For the dedicated host, run the service under the logged-in user's systemd manager to grant access to the active GNOME session, Mutter DBus, PulseAudio, and kiosk display:
```bash
./scripts/install-systemd-user-service.sh
loginctl enable-linger "$(id -un)"
```

Common service commands:
```bash
systemctl --user status lumina
systemctl --user restart lumina
journalctl --user -u lumina -n 100 --no-pager
```

---

## 🧪 Testing

Lumina includes a custom, zero-dependency unit and integration regression test suite:
```bash
npm test
```

---

## 🛡️ License

Distributed under the MIT License. See `LICENSE` for details (if applicable). Made for home theater enthusiasts and autonomous developers.
