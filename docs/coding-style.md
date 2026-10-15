# one-map-react coding style

The [thin-facade requirements](requirements.md) govern architecture and ownership; the [testing policy](testing-policy.md) governs verification. This guide preserves contributor conventions without requiring the previous session, driver, configuration, or native-bridge design.

These rules apply to contributors and agents working on first-party source, native bridges, scripts, tests, and code examples. Write code that a developer familiar with React and TypeScript can understand without the project's conversation history. Follow the [documentation style guide](STYLE_GUIDE.md) for Markdown prose.

“Must” states a requirement. “Prefer” states the default; use another approach only for a concrete readability, correctness, platform, or performance reason. Explain non-obvious exceptions near the code. Existing deviations are migration work; this guide does not authorize unrelated rewrites or changes to public behavior. Generated code and upstream source retain their generator or upstream conventions.

## Functional programming and collection operations

- Prefer pure functions for validation, normalization, conversion, and selection. Keep SDK calls, subscriptions, DOM changes, and native operations at explicit boundaries.
- Prefer `map` for transformation, `filter` for selection, and `reduce` for accumulation over `forEach` with an externally mutated result. Use `find`, `some`, and `every` when they express the operation directly.
- Prefer one readable pipeline for a related sequence of transformations. Put each operation on its own line when the chain does not fit the configured width.
- Extract callbacks with branching, validation, domain rules, or multiple steps into named arrow functions. Place pure helpers at module scope when they do not depend on component state. Short property selection or a single obvious comparison may remain inline.
- A pipeline callback must describe its input and result through its name and types. Pass changing dependencies as arguments or create a clearly named callback factory; do not hide them in mutable module state.
- Do not use `map` when its result is discarded, or `reduce` solely to perform side effects. Use `for...of` for ordered side effects, early exits, sequential `await`, and cleanup. Use an indexed loop when an algorithm requires index control.
- Avoid `forEach(async ...)`. Use sequential `for...of` or explicitly concurrent promise composition according to the operation's ordering requirements.
- Keep inputs unchanged unless mutation is part of the documented contract. Prefer `const` and readonly collection types. A reducer may mutate an accumulator that it alone owns; do not repeatedly copy a growing array or object merely to appear functional.
- Do not replace a readable pipeline with a custom utility or dependency for functional composition. Use named intermediate results when they clarify a boundary or avoid repeated work.

For example, put the main pipeline before its selection and transformation helpers:

```ts
interface MapDescriptor {
  readonly id: string;
  readonly ready: boolean;
}

const readyMapIdentifiers = (maps: readonly MapDescriptor[]): string[] =>
  maps.filter(isReadyMap).map(mapIdentifier);

const isReadyMap = (map: MapDescriptor): boolean => map.ready;

const mapIdentifier = (map: MapDescriptor): string => map.id;
```

## Functions and helpers

- Prefer arrow functions assigned to `const` for named functions, exported functions, React components, hooks, and callbacks.
- Prefer expression bodies for helpers that return one expression, including one-line arrow functions. Use parentheses around an object literal returned by an expression body.
- Use a block body for guards, multiple steps, explicit side effects, or error handling. Do not compress those responsibilities into nested ternaries or comma expressions to avoid `return`.
- Put module entry points, public components, hooks, and factories before their supporting functions. Imports, relevant types, and required shared state may come first. Classify functions by responsibility: a function exported for internal sharing can still be a helper.
- Preserve the relative order of independent entry points. Below them, put callers before callees and order sibling helpers by their first call in the caller. Place shared helpers below their callers where possible; keep mutually recursive helpers together.
- In classes, put constructors and public operations before private methods. Preserve field initialization dependencies and required base-class ordering.
- Keep arrow-function helpers below callers when the calls run after module initialization. If eager setup requires a helper before its caller, retain that order and explain why. Do not move a `const` helper below a return or an immediate invocation.
- Preserve React hook order, nested closure setup, lifecycle subscriptions, and eager side effects. These dependencies take precedence over declaration order; explain non-obvious exceptions near the code.
- Keep helpers in their owning module unless they represent a separate responsibility or are shared. Function ordering alone is not a reason to extract a module.
- Function expressions are allowed when dynamic `this`, generator syntax, or a platform API requires them. Document the reason when it is not evident from the surrounding code. Class constructors and methods may use ordinary method syntax; do not convert them mechanically.
- Prefer small functions with one responsibility. Extract a helper when it gives a meaningful name to a domain operation, removes repeated logic, or separates an effect from a transformation. Do not create wrappers that merely rename an obvious expression.
- Specify parameter and return types on public functions and methods. Internal helpers may infer obvious return types; annotate lifecycle, bridge, and normalization boundaries when inference would hide their contract.

```ts
const hasPositiveSize = (width: number, height: number): boolean =>
  width > 0 && height > 0;

const createMapIdentity = (id: string) => ({ id });
```

## Names

- Use descriptive names that identify the domain object, operation, unit, or lifecycle phase. Prefer `mapSession`, `hostElement`, `attachmentGeneration`, and `initialCamera` over `item`, `obj`, `gen`, or `data` when those names would be ambiguous.
- Name predicates with `is`, `has`, `can`, or another clear question. Distinguish an observed event such as `loadObserved` from a notification such as `loadReported`.
- Name functions for what they do: `normalizeFeatureArray`, `validateHostProps`, `releaseMapLease`. Use a noun for a function that selects a value only when that convention is clear in its module.
- Include units where the surrounding type does not establish them, for example `durationMs`, `logicalWidth`, and `pixelWidth`. Document public units even when an upstream-compatible identifier cannot change.
- Short names such as `id`, `ref`, `map`, and `props` are acceptable in a small scope with one clear referent. Single-letter loop indices are acceptable for index arithmetic. Avoid abbreviations that require a reader to decode project terminology.
- Use `camelCase` for values and functions and `PascalCase` for types, classes, and React components. Preserve required upstream and native API spellings.
- Use kebab-case operation filenames. Prefer `validate-`, `normalize-`, `create-`, and `use-` prefixes when they describe the operation.
- Do not shadow restricted global names. Alias the facade's `Map` import to `OneMap` in application examples and other scopes where lint rules require it.

## Formatting and logical separation

- Use the repository's Vite+ formatting configuration in `vite.config.ts` for supported files: two spaces, an 80-column target, double quotes, semicolons, and the configured trailing commas. Do not hand-format against the formatter.
- Put one blank line between top-level declarations, type declarations, and class methods. Consecutive re-exports or constants forming one obvious group may stay together.
- Inside a function, separate distinct phases with one blank line: input validation, derived values, state transitions, external effects, and result construction. Keep a state assignment and its directly related notification together.
- Separate independent hooks and effects with a blank line. Group related state and refs; separate different ownership or lifecycle concerns.
- Use braces for multiline conditionals and loops, including a branch whose single statement wraps across lines. A short single-line guard may omit braces.
- Avoid nested ternaries. Use named predicates, an `if` sequence, or a small selector helper when selection has more than two outcomes.
- Preserve logical blank lines after running the formatter. A formatter pass does not replace a readability review.
- Format handwritten native code as well: separate phases and methods, expand dense guards, and put separate statements on separate lines. Until native formatter configuration exists, follow the surrounding language conventions without compressing control flow.

## Types and their ownership

- Prefer named contracts when inline types contain nested objects, repeat a shape, need member documentation, or obscure a function's purpose; retain small, obvious local types inline.
- Define a type in the module that owns its meaning. Keep function options, results, component props, and module-specific interfaces beside their implementation by default.
- Group shared portable contracts by domain, such as geometry, camera, features, capabilities, events, map refs, and adapters. Keep renderer SDK imports outside these contracts, including type-only imports. React host compatibility is a separate boundary.
- Extract a dedicated contract module when multiple implementations depend on it and colocating it would create a dependency cycle or mix unrelated responsibilities. Name it for the domain, such as `camera-types.ts` or `lifecycle-contracts.ts`, rather than creating another miscellaneous `types.ts`.
- Keep implementation-only types unexported. Export an internal type from its owning module only when another implementation module needs it. That export does not require a package-level re-export.
- Use `import type` and `export type` for type-only dependencies, following the configured import organization. Import from the owning module within a domain; a consumer outside that domain may use its explicit index. Retain the project's `.js` specifiers for TypeScript modules.
- Use interfaces for named object contracts that benefit from extension; use type aliases for unions, tuples, mapped types, and compositions. Do not change equivalent declarations solely to enforce one syntax everywhere.
- Accept `unknown` at untrusted runtime boundaries and narrow or validate it. Do not introduce `any`, non-null assertions, or casts to bypass unresolved lifecycle or backend contract questions. Explain necessary casts at the boundary.
- Reuse the owning type instead of copying its declaration into another module. Avoid a broad shared utility module that couples unrelated domains.

## Index files and public exports

- Treat `src/index.ts` and each selected adapter entry as deliberate public boundaries. Use explicit named exports and type exports for new or changed exports. Existing wildcard exports require review before removal because consumers may depend on them.
- Keep `index.ts` focused on explicit exports from named implementation files. Use `export type` for contracts so type consumers do not load runtime dependencies.
- Give a coherent domain an index when it provides a useful interface to its consumers. Review each exported name; do not expose private state or caller-specific helpers to fill out an index. A folder containing one operation and its options or props normally belongs in a single named module instead.
- Internal modules must not import through the package root. Within a domain, import the owning file directly to keep initialization and cycles visible. Across domains, use the reviewed index where it preserves dependency isolation; direct imports remain appropriate when the index would load unrelated runtime code.
- Keep the common entry free of backend SDK and wrapper dependencies. Expose backend-specific options and helpers through the selected adapter entry. Verify that an export change preserves optional-peer isolation and conditional resolution.
- A public re-export is an API decision. Do not expose a helper merely because a test or another implementation module needs it. An `@internal` comment does not remove a runtime export.

## TSDoc and implementation comments

- Every supported public function, method, component, class, and named type must have a `/** ... */` documentation comment at its owning declaration. Document each project-owned public property or interface member; use short comments for straightforward fields.
- Multiline documentation comments must use standalone `/**` and `*/` delimiters with a leading `*` on each content line. Separate the summary from tags with one blank starred line. Keep consecutive `@param` tags together without intervening blank lines. Retain short one-line documentation for straightforward fields and simple responsibilities. These conventions do not prescribe tag order, inline-link syntax, or naming for destructured parameters.
- Public callable documentation must include a brief summary, `@param` for every parameter, and `@returns` for every non-void result. For `Promise<void>`, describe what resolution acknowledges. A synchronous `void` function needs no empty return tag. React components may document their output in the summary and describe inputs through the props type.
- Use `@param name - description` and `@returns description`. Keep TypeScript types in the signature; do not duplicate them with JSDoc `{Type}` annotations. See the official [parameter](https://tsdoc.org/pages/tags/param/) and [return](https://tsdoc.org/pages/tags/returns/) references.
- Document object parameter fields on their named options type. Explain defaults, valid ranges, units, ownership, initialization-only values, and reset behavior wherever they affect use.
- Use `@remarks` for lifecycle details and longer explanations. Describe meaningful thrown errors or promise rejection conditions with `@throws`; distinguish invalid input, missing readiness, unsupported features, pending implementation, and backend failure.
- Describe asynchronous semantics precisely. State whether resolution acknowledges dispatch, observed completion, or a returned result. Document what happens if the renderer detaches while the operation is pending.
- Keep API documentation on the owning contract. Avoid copying it into implementations and re-export files; use a brief implementation comment or an explicit reference when needed. Check that public declaration output preserves the documentation when changing exports or the build.
- Complex internal functions and hooks need a short documentation comment explaining responsibility and non-obvious input, output, ownership, or ordering rules. Simple local selectors need no ceremonial documentation.
- Use local `//` comments to explain invariants, race protection, workarounds, unusual cleanup order, and platform differences. State the reason and observable consequence; do not narrate an assignment or repeat a function name.
- A workaround comment must identify the affected wrapper or SDK and link to a source, decision, or regression test when available. Describe the condition under which the workaround can be removed.
- Update comments when behavior changes. Do not add dates, author signatures, commented-out code, or historical debugging narratives. A TODO must identify concrete remaining work and link to an issue or stage.
- A declaration is not an implementation claim. Document pending methods as pending and link to their owning stage; do not present agreed future behavior as currently working.

For example, this historical map-selection hook illustrates documentation of selection and errors. Its provider, readiness model, and error classes are not requirements for the replacement:

```ts
/**
 * Selects a map from the current OneMapProvider.
 *
 * @param id - Registered map ID. Omit to select the enclosing Map.
 * @returns A stable map ref whose `ready` flag reflects renderer readiness.
 * @throws InvalidMapOptionError when the required provider or enclosing
 * Map is missing.
 * @throws MapNotReadyError when the named map is not registered.
 */
```

## Modules and architecture

- Give each module one identifiable responsibility. Its filename must describe its contents. A module handling resize, initial style, camera setup, and accessibility should be named for lifecycle integration or split by responsibility.
- An implementation module normally exports one main function, component, class, or narrowly scoped state owner. Keep private supporting helpers beside their caller. Multiple exports are appropriate at deliberate public entry points and in coherent contract modules; a resource-owning class may have multiple methods.
- Split an overstuffed module into a subfolder when its responsibilities warrant several independently meaningful implementations. Keep a single operation, its local helpers, and its operation-specific types together. Neither a type declaration nor a short helper alone warrants another file or folder; use the responsibility and dependency boundaries to decide.
- Validation checks a contract; normalization constructs a canonical representation. Keep them together in a domain module when that makes the operation easier to follow. Separate them when reuse or responsibility warrants it. Preserve supported behavior and copying rules; incidental validation order is not a compatibility requirement.
- Give shared mutable state one authoritative owner. Expose operations on that owner instead of raw mutable collections for other modules to manipulate.
- Use explicit domain indexes according to the export policy above. Do not retain compatibility barrels at superseded private implementation paths. Stable public package and platform-tool entry paths remain deliberate boundaries.
- Preserve the common API, selected adapter, wrapper, and SDK boundaries. Adapters own conversion and facade-added resources; wrappers normally own renderer lifecycle and SDK integration. Introduce sessions, dispatchers, or native bridges only for a demonstrated requirement under the thin-facade design.
- Extract shared code only after confirming that the participating backends have equivalent behavior and ordering. Keep meaningful platform differences explicit.
- Keep pure transformations outside components where possible. Extract focused hooks or helpers when a component combines independent ownership, initialization, subscriptions, and error reporting. File length alone is not a reason to split a module.
- Document lifecycle state with named types. Explain what each flag or generation means, which transitions establish readiness, and which callbacks can outlive an attachment.
- Document each owned resource's acquisition, release, and lifetime. Cleanup must be safe when repeated and must suppress stale callbacks. Keep paired setup and cleanup close enough to review together.
- Preserve existing classes when they provide useful state or resource ownership. Prefer functions for new transformations and factories; functional style does not require removing classes.
- React render paths must not dispatch SDK operations or mutate external resources. Put those effects in the appropriate effect, event handler, or lifecycle boundary. Follow hook rules and explain deliberate timing dependencies.

## Errors, tests, and validation

- Distinguish invalid input, unavailable readiness, unsupported functionality, and backend failure where callers need that distinction. The previous error classes are not mandatory for the replacement. Pending work must remain explicit; do not describe it as an SDK limitation.
- Do not swallow failures, return successful empty results for failed queries, or silently ignore unsupported portable behavior. An allowed degradation must follow its documented policy and diagnostics.
- Keep credentials out of diagnostics, logs, retained error causes, and examples. Preserve the existing token-redaction behavior during refactors.
- Write behavioral tests with descriptive scenario names. Test meaningful failure and cleanup paths where behavior changes. Avoid tests that only repeat an implementation's statements or snapshots.
- Run checks appropriate to the change. For documentation, run `bun run check` and `bun run check:docs` and review links and technical claims. For TypeScript behavior, also run type checking and the affected unit or adapter tests. Export changes require build and relevant packed-package and selection checks.
- Acceptance tests can take over an hour. Agents must obtain explicit user permission before running them and defer them until implementation, structural/comment review, and applicable routine checks are complete, with no known substantive changes remaining. Follow the [acceptance timing policy](testing-policy.md#acceptance-timing-and-user-permission); implementation requests and acceptance criteria alone are not permission. This includes scoped real-renderer runs and native acceptance builds, not just the full matrix.
- Native bridge or lifecycle changes require affected native builds and runtime scenarios before renewing runtime acceptance, subject to the timing and permission rule above. Mocked tests establish JavaScript behavior only. Keep implementation and runtime evidence separate. Select reruns by affected behavior; a changed artifact hash alone does not invalidate unaffected behavior or authorize another full run. Until the user authorizes acceptance, report the runtime gate as unverified or awaiting permission rather than running it automatically.
- Review public examples against current exports and implemented behavior. Label excerpts with omitted setup or pending functionality; do not add fictional declarations to make them compile.
- The existing Vite+ and documentation checks enforce only part of this guide. Contributors and agents must review naming, spacing, architecture, comments, and public documentation manually until dedicated checks exist.

## Changes and commits

Keep each change focused on the requested task. Preserve unrelated work. Add new files only for a meaningful responsibility or documented boundary, and update README navigation when introducing contributor guidance.

When a commit is requested, use a one-line Conventional Commit subject, a blank line, and a bullet-point summary of the major improvements and changes:

```text
docs: document coding conventions and map architecture

- Define functional programming and TSDoc conventions
- Explain adapter boundaries and contributor validation
```
