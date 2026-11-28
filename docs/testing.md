# Testing

Test the behavior this library owns: forwarding, conversions, lifecycle, packaging, and the compatibility it advertises. Upstream libraries own their own regression suites. The [library boundary](architecture.md) is the contract.

## During development

Run the checks that match the change. `bun run validate` checks formatting and lint, runs `bun run check:docs`, builds the packages, and then runs type checks, unit and component tests, and packed-package selection. It does not open a browser, start Metro, or build a native app.

GitHub Actions runs `bun run validate` when a pull request opens, reopens, or receives new commits. The job uses macOS for the Swift and Objective-C++ regression checks. See the [pull request validation workflow](../.github/workflows/validate.yml).

The workflow installs JDK 17 and verifies the SHA-256 of the Kotlin 2.2.0 compiler archive. The Kotlin regressions require the configured compiler in CI.

To run the Kotlin regressions locally, install JDK 17 and extract the compiler archive from the [Kotlin 2.2.0 release](https://github.com/JetBrains/kotlin/releases/tag/v2.2.0). Set `ONE_MAP_KOTLINC` to the absolute path of the extracted `kotlinc/bin/kotlinc` launcher when you run `bun run validate`. Local runs with the variable unset report a skip for the Kotlin portions. The camera-bounds and layer-order regressions require macOS and Xcode for their Swift and Objective-C++ checks.

`bun run check:docs` checks Markdown structure and local links in tracked files and unignored new files in the Git checkout. Use the referenced source and examples to verify the claims in the text.

| Change | Checks |
| --- | --- |
| Documentation or comments | Formatting, links, and the types or examples the text describes. Build when declaration output changes. |
| Prop or method forwarding | Types, plus a test of the target call, its arguments, its return value, and its errors. |
| Value, event, style, or coordinate conversion | Input and output tests, including invalid input and reset. |
| Adapter lifecycle | Component tests for callbacks, refs, cleanup, failure, and stale work. |
| Exports, peers, or the build | Packed-consumer, declaration, and selection checks. |
| A native SDK or bridge change | The static and component tests for that change. Run a native build when you need to see the renderer. |

A mock can prove a conversion and a lifecycle. A real renderer is what shows that a feature, camera, gesture, or picture actually appeared. Keep tests that need tiles or a token separate from ordinary translation tests.

Keep a regression for a failure you fixed. When you simplify an implementation, keep the test that protects the visible behavior and drop an assertion that only pins an internal sequence.

## On a device or in a browser

Ask before a real-renderer browser suite, a Metro session that talks to a map SDK, or a native build or install. Finish the change and the matching routine checks first. An instruction to implement a feature is not permission to launch those runs.

If you did not run the renderer, say so. A passing unit test does not mean the map rendered.

Remove generated app binaries, temporary installs, and logs when the run is finished.
