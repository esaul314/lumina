# Ecowitt GW1200 Integration Plan

Status: initial implementation complete. The live payload shape and the
Playwright-served API path are verified; no gateway address or device identity
is recorded here.

## Context

Lumina is primarily a picture gallery and ambient aesthetic experience, not a
general-purpose dashboard. The GW1200 should enrich that experience quietly
without competing with the photography or turning the TV view into an
instrument panel.

The product roadmap already identifies Ecowitt as the first adapter in a
normalized local-sensor platform. This integration should establish that
boundary without introducing a generalized IoT framework, MQTT, Home
Assistant, a database, or Socket.IO telemetry.

The current implementation checkpoint remains the selective Phase 1 Step 4
command/effect readability pass. This read-only sensor feature should remain
at the service, runtime, API, and presentation boundaries rather than entering
the durable command/reducer pipeline.

## Phase 0: Verify the device

Before implementation:

1. Configure a DHCP reservation for the GW1200.
2. Add its private HTTP endpoint only to ignored local configuration.
3. Query `GET /get_livedata_info` directly from Playwright.
4. Capture an anonymized fixture from the real response.
5. Confirm the actual payload shape, especially the built-in indoor sensor
   record and its units.

Do not record the gateway IP, MAC address, SSID, or network topology in the
repository. The live endpoint was subsequently verified from Playwright. Its
response has top-level `common_list`, `debug`, and `wh25` fields. The current
built-in indoor record is represented by `wh25[0]` and returns temperature as
a Fahrenheit string, humidity with a percent suffix, and absolute/relative
pressure with an inHg suffix. The endpoint currently provides no outdoor
observation, so Open-Meteo remains the independent source for outdoor weather
and forecast data.

## Server adapter

Add a narrow `server/services/ecowitt.js` adapter with a pure parsing and
normalization core. The adapter should be based on the captured device payload,
not only on assumed vendor documentation. The expected `wh25[0]` shape is a
useful starting hypothesis, not a contract.

The service boundary should expose only Lumina-owned fields:

```js
{
  temperatureC: number | null,
  humidityPercent: number | null,
  pressureAbsoluteHpa: number | null,
  pressureRelativeHpa: number | null
}
```

The parser should defensively normalize Celsius/Fahrenheit and hPa/inHg,
reject malformed numeric values, and prevent vendor strings, suffixes, and
field names from reaching routes or React components.

Use native Node `fetch` with an injected fetch implementation and a short
timeout. Keep the parser and unit conversions pure; use small compositional
helpers where they improve readability, but do not build an abstraction merely
to demonstrate functional programming.

## Configuration and runtime reliability

Add documented placeholders to `config.json.example` for:

```json
"ecowitt": {
  "enabled": false,
  "baseUrl": "http://ecowitt.local",
  "pollIntervalMs": 60000,
  "timeoutMs": 3000
}
```

The real endpoint belongs only in ignored local configuration. Configuration
normalization must account for the loader's current shallow top-level merge so
partial nested overrides do not accidentally discard defaults.

Expose a read-only `GET /api/environment` endpoint with a stable response such
as:

```json
{
  "indoor": {
    "temperatureC": 22.8,
    "humidityPercent": 47,
    "pressureAbsoluteHpa": 1001.4,
    "pressureRelativeHpa": 1018.7
  },
  "source": "ecowitt-gw1200",
  "observedAt": "2026-07-18T21:30:00.000Z",
  "stale": false
}
```

When enabled, poll independently from Open-Meteo at approximately one-minute
intervals. Preserve the last known good reading during temporary failures and
return it with `stale: true` and its original `observedAt`. A disabled or
never-successful integration should return a safe empty result without
breaking the route.

Log only availability transitions: available, unavailable, and recovered.
Ecowitt failures must never affect Open-Meteo weather, weather/photo
alignment, startup, or screensaver activation.

## Presentation design

Keep the existing outdoor weather display visually dominant. Do not add a
second large glass card or a dashboard-like sensor panel.

The recommended default is a quiet subordinate line inside the existing
weather card:

```text
Indoor  22.8° · 47% humidity · 1018 hPa
```

Display rules:

- Label indoor and outdoor information explicitly.
- Show relative pressure by default; retain absolute pressure in the API for
  future consumers.
- Keep stale readings visible with reduced opacity and no layout reflow.
- Hide the indoor line when disabled or when no reading has ever succeeded.
- Keep the typography, spacing, and visual weight subordinate to the gallery.

The initial slice adds one remote-control visibility setting rather than
another top-level widget:

- Off: no indoor information.
- On: one restrained compact line; the default.

A future presentation refinement may add a detailed mode if real TV viewing
shows that it remains aesthetically quiet. It should not become a second
dashboard panel.

The existing outdoor weather toggle remains independent and unchanged.

## Tests

Add pure service tests covering:

- the anonymized real GW1200 fixture;
- missing `wh25` data;
- malformed or missing numeric values;
- Celsius and Fahrenheit normalization;
- hPa and inHg normalization;
- disabled configuration;
- timeout and network failure;
- last-known-good fallback;
- stale metadata and observation age;
- the stable `/api/environment` response shape.

Add focused client coverage for compact/detailed rendering, stale readings,
disabled state, missing readings, and unchanged outdoor weather rendering.

Run the full regression suite, inspect the diff for private information, rebuild
the served client bundle, and verify the exact live TV weather path on
Playwright before calling the implementation complete.

## Documentation and completion

The initial implementation updates `ROADMAP.md` to record that the local
sensor platform has started with Ecowitt, and adds a privacy-safe entry to
`DEVELOPER_LOG.md` describing the normalized contract, failure policy, and
presentation decision. The actual endpoint and device details remain outside
tracked documentation.
