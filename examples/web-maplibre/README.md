# MapLibre web example

Vite+ shell around the shared Seattle route map, using `one-map-react/maplibre-web`. From the repository root, `bun run build` writes the package `dist/` this shell imports.

```sh
bun install
bun run dev
```

This install is not part of `validate` and is not the packed-consumer isolation check. Runtime smoke in a browser is acceptance work; do not launch it from routine checks.
