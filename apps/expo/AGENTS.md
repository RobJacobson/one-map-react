# Expo example contributor guide

[`index.ts`](index.ts) registers [`App`](src/app.tsx). The app switches between the basemap and the development acceptance workspace in React state. Metro selects the platform modules for backend setup and acceptance. Shared screens and scenarios live in [`packages/example-map`](../../packages/example-map/src).

Set native permissions, plugins, and SDK pins in [`app.config.ts`](app.config.ts). Expo generates the iOS and Android projects from this config. Read the documentation for the Expo SDK version in [`package.json`](package.json) before changing Expo APIs. Install Expo dependencies with `bunx expo install <package>` from this directory.

Run `bun run check` and `bun run typecheck:apps` from the repository root for routine verification. See the [example commands and launch settings](../../README.md#examples) for development. Follow the [renderer approval rules](../../docs/testing.md#on-a-device-or-in-a-browser) before starting Metro or building or installing a native app. Use a development build to exercise the native map wrappers.
