# Coding style

Follow the [shared coding style](https://github.com/RobJacobson/react-style-guide/blob/v0.1.0/coding-style.md) for first-party code, tests, scripts, and examples.

The [thin-facade requirements](requirements.md) define architecture and ownership; the [testing policy](testing-policy.md) defines verification and acceptance. Mapping-specific documentation rules are in [STYLE_GUIDE.md](STYLE_GUIDE.md).

- Keep the common package entry free of backend SDK and wrapper dependencies. Put backend-specific options and helpers behind the selected adapter entry, and verify optional-peer isolation and conditional resolution when exports change.
- Preserve the common API, selected adapter, wrapper, and SDK boundaries. Adapters own conversion and facade-added resources; wrappers normally own renderer lifecycle and SDK integration. Share code only after checking equivalent behavior and ordering across backends.
- Keep renderer SDK imports out of portable contracts, including type-only imports. Preserve this project's `.js` specifiers for TypeScript modules. Alias the facade's `Map` import to `OneMap` where restricted-global lint rules require it.
- Document native lifecycle state, readiness transitions, callbacks that can outlive an attachment, and each resource's acquisition and release. Repeated cleanup must be safe and stale callbacks suppressed. React render paths must not dispatch SDK operations.
- Distinguish invalid input, unavailable readiness, unsupported functionality, and backend failure. Preserve token redaction and documented degradation policies. A failed query must not become an empty success.
- For documentation, run `bun run check` and `bun run check:docs`; for TypeScript behavior, add type checking and affected unit or adapter tests. Export changes also require the build and relevant packed-package and selection checks. Follow the [acceptance permission policy](testing-policy.md#acceptance-timing-and-user-permission) before real-renderer or native acceptance work.
