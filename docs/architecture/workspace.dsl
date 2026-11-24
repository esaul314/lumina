workspace "Lumina architecture" "Current observations and proposed internal boundaries; not two running backends." {
    !impliedRelationships false
    model {
        user = person "Operator / viewer" "Uses the remote controls and ambient display."
        images = softwareSystem "Image sources and CDNs" "Public feeds and media delivery."
        environment = softwareSystem "Weather and news" "Forecast, location lookup and sentiment inputs."
        sensor = softwareSystem "Local sensor" "Selected environmental-device adapter."
        desktop = softwareSystem "Linux desktop services" "Idle/audio checks, kiosk launch and CPU policy."
        vision = softwareSystem "Optional vision endpoint" "Configured enrichment; may be unavailable."
        google = softwareSystem "Google Photos" "Optional authenticated collection and signed media."
        lumina = softwareSystem "Lumina" "Ambient display and exemplar functional/declarative application." {
            !docs .
            web = container "Web UI" "One bundle with TV and remote roles; browser-local transient effects." "React / Chromium or remote browser"
            daemon = container "Daemon" "One native service; current and proposed components below are alternative views." "Node.js / Express / Socket.IO" {
                boot = component "Explicit construction and startup" "server/app.js; lazy default facade and createApplication assembly; startServer opens history and starts schedules/listening; teardown remains pending." "CommonJS" "Current"
                transport = component "REST and socket adapters" "server/routes.js; server/sockets.js. Commands plus source-specific endpoints." "Express / Socket.IO" "Current"
                legacy = component "Legacy socket fallback" "server/socketLegacyCompatibility.js; used without the shared dispatcher." "CommonJS" "Current"
                dispatch = component "Command/effect shell" "dispatch.js plus snapshot apply/replace/sync helpers; mutates state, runs ordered effects and writers." "JavaScript" "Current"
                core = component "Functional core" "Reducers, selectors and snapshot build projections; excludes mutable apply helpers. Time/RNG need explicit inputs." "Reducers / selectors / codecs" "Current"
                workflows = component "Jobs and runtimes" "server/jobs and server/runtime; one vision execution home, injected effects, timers and shared state." "JavaScript" "Current"
                adapters = component "External adapters" "server/services except history; HTTP, desktop and device effects." "JavaScript" "Current"
                persistence = component "Persistence and codecs" "server/config and sensorHistory; codecs plus file/SQLite writers." "Files / node:sqlite" "Current"
                state = component "Shared mutable shell state" "screensaverState, collections and runtime caches; domain snapshots are projections." "In-process data, not a new store" "Current"

                targetBoot = component "PROPOSED: composition root" "Same service; explicit start/stop and injected dependencies; no import-time scheduling." "CommonJS" "Proposed"
                targetTransport = component "PROPOSED: boundary adapters" "Existing REST/socket contracts; fallback receives callbacks instead of requiring app." "Express / Socket.IO" "Proposed"
                targetDispatch = component "PROPOSED: command/effect shell" "Same shared state, mutable snapshot application and ordered effects; writers supplied by composition." "JavaScript" "Proposed"
                targetCore = component "PROPOSED: functional core" "Keep reducers/selectors and pure projections; exclude mutable application and I/O." "Pure functions + explicit time/RNG" "Proposed"
                targetWorkflows = component "PROPOSED: bounded workflows" "Existing jobs/runtimes own vision and refresh work; one lifecycle, run-local failure facts." "JavaScript" "Proposed"
                targetAdapters = component "PROPOSED: external adapters" "Existing providers/OS/device boundaries; extend proved request policy only where needed." "JavaScript" "Proposed"
                targetPersistence = component "PROPOSED: persistence adapters" "Existing JSON/SQLite formats and atomic merge behavior; no migration or new database." "Files / node:sqlite" "Proposed"
            }
            json = container "Local files" "Settings, collections, active categories and source metadata; existing formats." "JSON / private environment files" "Store"
            history = container "Sensor history" "Existing local telemetry database; no separate database server." "SQLite file" "Store"
        }

        user -> lumina "Views and controls" "Browser interaction"
        lumina -> images "Fetches media and feed data" "HTTP(S)"
        lumina -> environment "Reads forecasts and news" "HTTP(S)"
        lumina -> sensor "Polls selected device" "LAN HTTP"
        lumina -> desktop "Reads session activity and controls kiosk" "D-Bus / process commands"
        lumina -> vision "Optionally enriches photos" "Configured HTTP(S)"
        lumina -> google "Optionally reads authenticated photos" "OAuth / HTTPS"

        user -> web "Uses TV or remote role" "Browser interaction"
        web -> daemon "REST mutations/queries; Socket.IO live events" "HTTP / WebSocket"
        web -> images "Loads media" "HTTP(S)"
        daemon -> json "Read-merge-write existing snapshots" "Filesystem"
        daemon -> history "Record and query telemetry" "node:sqlite"
        daemon -> images "Crawls feeds" "HTTP(S)"
        daemon -> environment "Reads forecast/news" "HTTP(S)"
        daemon -> sensor "Polls adapter" "LAN HTTP"
        daemon -> desktop "Checks idle/audio; launches tracked kiosk" "D-Bus / process commands"
        daemon -> vision "Optional enrichment" "Configured HTTP(S)"
        daemon -> google "Authenticated source operations" "OAuth / HTTPS"

        boot -> core "Uses selectors and policy" "In-process call"
        boot -> transport "Registers" "In-process call / reference"
        boot -> dispatch "Constructs" "In-process call / reference"
        boot -> workflows "Constructs; starts only on explicit startup" "In-process call / reference"
        boot -> adapters "Configures and invokes" "In-process call / reference"
        boot -> persistence "Loads and saves" "In-process call / reference"
        boot -> state "Initializes and mutates" "In-process call / reference"
        transport -> legacy "Fallback without dispatcher" "In-process call / reference"
        legacy -> workflows "Invokes supplied analysis runner; no entrypoint import" "Injected in-process callback"
        transport -> dispatch "Dispatches decoded commands" "In-process call / reference"
        transport -> core "Decodes and projects" "In-process call / reference"
        transport -> adapters "Source-local queries / compatibility" "In-process call / reference"
        legacy -> persistence "Legacy writes" "In-process call / reference"
        legacy -> adapters "Legacy crawl / source operations" "In-process call / reference"
        dispatch -> core "Reduces and projects" "In-process call / reference"
        dispatch -> state "Applies snapshot" "In-process call / reference"
        dispatch -> persistence "Imports collection/env writers" "In-process call / reference"
        dispatch -> workflows "Invokes injected effect callbacks" "In-process call / reference"
        workflows -> core "Derives policy and selection" "In-process call / reference"
        workflows -> state "Updates feeds and runtime values" "In-process call / reference"
        workflows -> adapters "Calls external effects" "In-process call / reference"
        workflows -> persistence "Persists results" "In-process call / reference"
        persistence -> core "Uses normalization/policy" "In-process call / reference"
        persistence -> json "Reads / writes" "Filesystem"
        persistence -> history "Records / queries" "node:sqlite"
        web -> transport "Current HTTP / live channel" "HTTP / WebSocket"

        targetBoot -> targetTransport "Registers with explicit callbacks" "In-process call / reference"
        targetBoot -> targetDispatch "Injects shared state and effects" "In-process call / reference"
        targetBoot -> targetWorkflows "Owns start/stop" "In-process call / reference"
        targetBoot -> targetAdapters "Supplies concrete adapters" "In-process call / reference"
        targetBoot -> targetPersistence "Supplies existing stores" "In-process call / reference"
        targetTransport -> targetDispatch "Durable command dispatch" "In-process call / reference"
        targetTransport -> targetCore "Decode / project" "In-process call / reference"
        targetTransport -> targetAdapters "Source-local read/auth operations" "In-process call / reference"
        targetDispatch -> targetCore "Reduce / project" "In-process call / reference"
        targetDispatch -> targetWorkflows "Invoke supplied workflow callbacks" "In-process call / reference"
        targetDispatch -> targetPersistence "Invoke supplied writer callbacks" "In-process call / reference"
        targetWorkflows -> targetCore "Plan / select / normalize" "In-process call / reference"
        targetWorkflows -> targetAdapters "Execute bounded external work" "In-process call / reference"
        targetWorkflows -> targetPersistence "Persist accepted results" "In-process call / reference"
        targetPersistence -> targetCore "Use existing codecs and policy" "In-process call / reference"
        targetPersistence -> json "Same formats / merge semantics" "Filesystem"
        targetPersistence -> history "Same telemetry store" "node:sqlite"
        web -> targetTransport "Same wire contracts" "HTTP / WebSocket"
    }
    configuration {
        scope softwaresystem
    }
    views {
        systemContext lumina "context" {
            title "CURRENT - Lumina system context"
            include user lumina images environment sensor desktop vision google
            autoLayout lr
        }
        container lumina "containers" {
            title "CURRENT AND TARGET - unchanged containers"
            include user web daemon json history images environment sensor desktop vision google
            autoLayout lr
        }
        component daemon "current-components" {
            title "CURRENT - explicit construction and owned startup; teardown pending"
            include boot transport legacy dispatch core workflows adapters persistence state
            autoLayout lr
        }
        component daemon "target-components" {
            title "PROPOSED - same daemon, one-way internal dependencies"
            include targetBoot targetTransport targetDispatch targetCore targetWorkflows targetAdapters targetPersistence
            autoLayout lr
        }
        styles {
            element "Element" {
                background #274c77
                color #ffffff
                fontSize 20
            }
            element "Person" {
                shape Person
            }
            element "Store" {
                shape Cylinder
            }
            element "Proposed" {
                background #23664a
            }
        }
    }
}