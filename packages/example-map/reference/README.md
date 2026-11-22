# Shared vessel map reference

Mount this example with `bun run vp dev packages/example-map/reference` from the workspace root. The browser shell uses stock MapLibre and includes its CSS and local worker. Click the route to select feature 1 or the vessel circle to select feature 2. Toggle **Highlight vessel** to change route width, circle radius, and circle stroke width. **Fly to vessel** moves the map and the readout follows its zoom.

`VesselMap.tsx` owns the map and interactions. `main.tsx` passes DOM buttons through the `MarkerContent` and `Controls` props and sets the host layout. A React Native shell can supply the same controls using its own host components with either selected native entry.

Run `bun run build` to produce the native package declarations, then run `bun run typecheck:reference`. The four TypeScript projects compile the same `VesselMap.tsx` against stock `react-map-gl/maplibre`, stock `react-map-gl/mapbox`, `one-map-react/mapbox-native`, and `one-map-react/maplibre-native`. Each project resolves its platform import directly to the selected package.

To use the browser shell with Mapbox, use the re-exports from `maps.mapbox.ts` in `maps.ts`. Swap the shell stylesheet to `mapbox-gl/dist/mapbox-gl.css` and remove the MapLibre worker setup. Supply any Mapbox service credentials through your browser shell. The checked-in style and GeoJSON have no tile or image service dependency.
