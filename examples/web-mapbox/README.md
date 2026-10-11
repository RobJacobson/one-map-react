# Mapbox web example

Vite shell around the shared Seattle route map, using `one-map-react/mapbox-web`.

From the repository root, `bun run build` writes the package `dist/` this shell imports. Set the public Mapbox token in the shell or a gitignored `.env` file. The shell variable `MAPBOX_ACCESS_TOKEN` wins. Otherwise Vite reads `.env` in this directory, then `.env` at the repository root. Copy the root `.env.example` to either place and set the token there, or export the variable before `bun run dev`. Do not commit a token. This shell embeds that public value in the local bundle, so a secret token must not be used. Restart Vite after changing it.

```sh
bun install
bun run dev
```

This install is not part of `validate` and is not the packed-consumer isolation check. Runtime smoke in a browser is acceptance work; do not launch it from routine checks.
