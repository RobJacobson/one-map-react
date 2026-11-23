# Example applications

The maintained applications are [apps/web](../apps/web) for Vite and [apps/expo](../apps/expo) for Expo web, iOS, and Android. Both import the private [shared example package](../packages/example-map), which owns the basemap and acceptance scenarios.

Run `bun install` at the repository root, then `bun run dev:web` or `bun run dev:expo`. The [repository guide](../README.md#examples) covers token configuration, scenario selection, and the pinned native SDKs. `validate` does not generate, compile, install, or run a native app.

The [focused native screen](../packages/example-map/src/scenarios/native-tf07-focused-screen.tsx) places its Map A and Map B buttons beside their maps. Each button owns its count and uses its explicit map ref. The [mocked screen regression](../packages/example-map/test/native-focused-location.web.test.tsx) checks provider updates, count retention across a simulated resize, and separate map activation.

Independent native image observations use the shared example package's [Mapbox snapshot module](../packages/example-map/src/scenarios/mapbox-snapshot.ts) or [MapLibre snapshot module](../packages/example-map/src/scenarios/maplibre-snapshot.ts). Each calls its selected raw manager and adapts the returned output for the application observer.

The engine-specific shells and their native setup generator are retired. Use the maintained apps for development. Historical outcomes stay in `records/`.
