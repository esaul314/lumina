# 🌌 Lumina

Lumina is an elegant, ambient smart display dashboard and Chromecast-style screensaver built for Linux (GNOME/Mutter desktops). Designed to run continuously on dedicated HTPC or home theater setups (such as living room TV PCs), Lumina fuses real-time atmospheric conditions, generative AI art, and classical art feeds with native system power control and smart media detection.

---

## ✨ Features

* **🎭 Dynamic Visual Feeds**: Combined feeds including Scenic Nature (Unsplash, Wallhaven), Cosmic Space (NASA APOD), Abstract Art, Liminal Spaces, and AI-Generated Creations (Lexica Art fallback / Midjourney via UseAPI).
* **🌦️ Meteorological Atmospheric Fusion**: Adapts displayed image selections automatically according to current outdoor weather conditions (rain, snow, sunny, cloudy) and news sentiment.
* **📱 Mobile Remote Control**: A REST-capable control surface with real-time Socket.IO live sync for changing display themes, rating/favoriting wallpapers, adjusting intervals, and overriding coordinates manually.
* **🎵 Smart Media Playback Guard**: Actively monitors PulseAudio/PipeWire sink streams. If a movie is playing or music is active (e.g., Plex, YouTube, Spotify), screensaver activation is automatically bypassed to prevent interruption.
* **⚡ CPU Governor Orchestration**: Automatically scales the CPU governor to `performance` when transitions or particle systems are active, and throttles back down to `schedutil` or `powersave` when the screensaver is dismissed (achieving 0% background CPU impact).
* **🧠 Under 80MB RAM Footprint**: Implements strict V8 engine heap limitations (`--max-old-space-size=256`) and client-side image double-buffering to avoid typical Chromium memory leaks during endless runs.

---

## 🛠️ Architecture

Lumina uses a decoupled client-server architecture. The backend is moving toward a REST-first control surface, while Socket.IO remains the live sync and low-latency event channel.

* **Server (Node.js/Express)**: Manages centralized geolocated API weather fusion, schedules image background pre-loading adapters, handles Mutter idle state DBus monitoring, and manages CPU orchestration.
* **Client (React/Vite/Vanilla CSS)**: Renders a fluid, glassmorphic layout displaying high-definition imagery with subtle Ken Burns panning, customizable floating widgets (weather, clock), and atmospheric overlay shaders (snowdrift, rainwash, auraglow).

See [ROADMAP.md](./ROADMAP.md) for the phased product and architecture plan.

---

## 🚀 Quick Start

### 1. Requirements
Ensure you have Node.js (v18+) and standard Linux utilities (`chromium-browser` or `chromium`, `busctl`, `pactl`) installed on your target machine.

### 2. Installation
Clone this repository and install the dependencies:
```bash
git clone https://github.com/esaul314/lumina.git
cd lumina
npm install
```

### 3. Setup Configuration
Lumina uses two local configuration files:

1. `config.json` for non-secret runtime settings such as port, alerts, and location.
2. `.env` for all secrets and API credentials.

Copy the example configuration to create your local `config.json` overrides:
```bash
cp config.json.example config.json
```
Edit `config.json` to define your target coordinates and email alerts:
```json
{
  "port": 5000,
  "alertEmail": "admin@localhost",
  "location": {
    "lat": 45.45,
    "lon": -73.56,
    "city": "Verdun",
    "regionName": "Quebec",
    "country": "Canada"
  }
}
```
Then create your secret store from the tracked example:
```bash
cp .env.example .env
```

Edit `.env` for any secrets you need:
```dotenv
NASA_API_KEY="DEMO_KEY"
USEAPI_TOKEN=""
TUMBLR_API_KEY=""
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
```
*(Both `config.json` and `.env` are gitignored and will never be committed to your repository.)*

### 4. Running Lumina
Launch the server daemon in the background using the automated launcher script:
```bash
./launch.sh
```
* Access the **Screensaver/TV Display** at: `http://localhost:5000/?mode=tv`
* Access the **Mobile Remote Control** at: `http://localhost:5000/`

### 5. Installing As A Persistent `systemd` User Service
For the dedicated `playwright` host, Lumina should run under the logged-in user's `systemd --user` manager so it can access the GNOME session, Mutter DBus, PulseAudio/PipeWire, and kiosk browser environment.

Install and start the user service:
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

The installer materializes `~/.config/systemd/user/lumina.service` from the tracked template in `systemd/lumina.service.template`, resolving the current repo path, user, UID, and `node` binary at install time.

---

## 🧪 Testing

Lumina includes a custom, zero-dependency unit and integration test runner. Execute the suite to verify system health:
```bash
npm test
```

---

## 🛡️ License

Distributed under the MIT License. See `LICENSE` for details (if applicable). Made for home theater enthusiasts and autonomous developers.
