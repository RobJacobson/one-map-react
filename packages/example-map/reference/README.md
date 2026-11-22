# Desktop vessel map reference

Mount this example with `bun run vp dev packages/example-map/reference` from the workspace root. The browser shell uses stock MapLibre and includes its CSS and local worker. Click the route to select feature 1 or the vessel circle to select feature 2. Toggle **Highlight vessel** to change route width, circle radius, and circle stroke width. **Fly to vessel** moves the map and the readout follows its zoom.

`VesselMap.tsx` owns the map and interactions. `main.tsx` passes DOM buttons through the `MarkerContent` and `Controls` props and sets the host layout. A React Native shell can supply the same controls using its own host components once a native entry implements the contract.

Run `bun run typecheck:reference` to compile the reference separately for both desktop engines. The default project resolves `maps.ts` to stock `react-map-gl/maplibre`. The Mapbox project selects `maps.mapbox.ts` and uses stock `react-map-gl/mapbox`. Both projects compile the same `VesselMap.tsx` with the selected entry's inferred types.

To use the browser shell with Mapbox, use the re-exports from `maps.mapbox.ts` in `maps.ts`. Swap the shell stylesheet to `mapbox-gl/dist/mapbox-gl.css` and remove the MapLibre worker setup. Supply any Mapbox service credentials through your browser shell. The checked-in style and GeoJSON have no tile or image service dependency.
