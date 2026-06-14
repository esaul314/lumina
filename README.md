# 🌌 Lumina

Lumina is an elegant, ambient smart display dashboard and Chromecast-style screensaver built for Linux (GNOME/Mutter desktops). Designed to run continuously on dedicated HTPC or home theater setups (such as living room TV PCs), Lumina fuses real-time atmospheric conditions, generative AI art, and classical art feeds with native system power control and smart media detection.

---

## ✨ Features

* **🎭 Dynamic Visual Feeds**: Combined feeds including Scenic Nature (Unsplash, Wallhaven), Cosmic Space (NASA APOD), Abstract Art, Liminal Spaces, and AI-Generated Creations (Lexica Art fallback / Midjourney via UseAPI).
* **🌦️ Meteorological Atmospheric Fusion**: Adapts displayed image selections automatically according to current outdoor weather conditions (rain, snow, sunny, cloudy) and news sentiment.
* **📱 Mobile Remote Control**: Real-time Socket.IO remote command deck for changing display themes, rating/favoriting wallpapers, adjusting intervals, and overriding coordinates manually.
* **🎵 Smart Media Playback Guard**: Actively monitors PulseAudio/PipeWire sink streams. If a movie is playing or music is active (e.g., Plex, YouTube, Spotify), screensaver activation is automatically bypassed to prevent interruption.
* **⚡ CPU Governor Orchestration**: Automatically scales the CPU governor to `performance` when transitions or particle systems are active, and throttles back down to `schedutil` or `powersave` when the screensaver is dismissed (achieving 0% background CPU impact).
* **🧠 Under 80MB RAM Footprint**: Implements strict V8 engine heap limitations (`--max-old-space-size=256`) and client-side image double-buffering to avoid typical Chromium memory leaks during endless runs.

---

## 🛠️ Architecture

Lumina utilizes a decoupled client-server architecture tied together with real-time Socket.IO events.

* **Server (Node.js/Express)**: Manages centralized geolocated API weather fusion, schedules image background pre-loading adapters, handles Mutter idle state DBus monitoring, and manages CPU orchestration.
* **Client (React/Vite/Vanilla CSS)**: Renders a fluid, glassmorphic layout displaying high-definition imagery with subtle Ken Burns panning, customizable floating widgets (weather, clock), and atmospheric overlay shaders (snowdrift, rainwash, auraglow).

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
Lumina uses a dynamic JSON config file. Copy the example configuration to create your local `config.json` overrides:
```bash
cp config.json.example config.json
```
Edit `config.json` to define your target coordinates, email alerts, or optional API tokens:
```json
{
  "port": 5000,
  "alertEmail": "admin@localhost",
  "nasaApiKey": "DEMO_KEY",
  "location": {
    "lat": 45.45,
    "lon": -73.56,
    "city": "Verdun",
    "regionName": "Quebec",
    "country": "Canada"
  }
}
```
*(Note: `config.json` is gitignored and will never be committed to your repository).*

### 4. Running Lumina
Launch the server daemon in the background using the automated launcher script:
```bash
./launch.sh
```
* Access the **Screensaver/TV Display** at: `http://localhost:5000/?mode=tv`
* Access the **Mobile Remote Control** at: `http://localhost:5000/`

---

## 🧪 Testing

Lumina includes a custom, zero-dependency unit and integration test runner. Execute the suite to verify system health:
```bash
npm test
```

---

## 🛡️ License

Distributed under the MIT License. See `LICENSE` for details (if applicable). Made for home theater enthusiasts and autonomous developers.
