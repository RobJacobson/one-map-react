# Map fixtures

`map.json` preserves the previous local empty style, initial view state, route GeoJSON, and marker coordinates as data. TF02 can use the style and route to render a line without depending on a tile service. Marker data is retained for later examples.

These are inputs, not expected renderer output or acceptance results. No renderer scenario runs in TF01. Package-selection tests use temporary isolated consumers and remove them afterward.
