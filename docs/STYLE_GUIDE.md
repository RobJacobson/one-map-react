# one-map-react documentation style guide

Write for software developers who know React and the Node ecosystem but may be unfamiliar with Mapbox, MapLibre, and their mapping SDKs. Help them understand the design, compare APIs, and assess how their application would behave when they change platforms or backends.

This guide applies to all Markdown documents in this directory, including the architecture, API references, testing plan, index, and agent instructions. Use it during drafting and review. Keep the technical meaning intact when editing for readability.

## Audience and terminology

Explain unfamiliar mapping concepts when they first become necessary. Introduce a source as the data supplied to a map and a layer as the rules for drawing that data before discussing source and layer properties. Explain camera state through center, zoom, bearing, and pitch.

Distinguish these parts of the system:

- The rendering SDK draws and manages the map.
- The React wrapper connects a rendering SDK to React or React Native.
- The one-map-react adapter translates the common API into a wrapper's API.
- A service supplies resources such as styles, tiles, or geocoding results.

Use **backend** for the implementation selected by an application. Use **platform** for web, iOS, or Android. Name the specific SDK when a statement concerns renderer behavior. Avoid using “provider” for several different things; specify “tile provider,” “service provider,” or “backend” as appropriate.

Use these names consistently: one-map-react, RNMapbox (`@rnmapbox/maps`), MapLibre React Native (`@maplibre/maplibre-react-native`), react-map-gl, Mapbox GL JS, and MapLibre GL JS. Preserve the upstream spelling and casing of API identifiers.

Explain abbreviations on first use when readers need them. Assume familiarity with React props, hooks, components, promises, and package dependencies. Explain mapping-specific meaning without teaching React from scratch.

## Voice and explanations

Write as an experienced colleague explaining an implementation choice. Use concrete subjects, direct verbs, and connected paragraphs. State what happens, why it happens, and what it means for application code.

Avoid promotional claims, dramatic reveals, rhetorical questions, invented terminology, and generic statements about flexibility or productivity. Replace “one-map-react makes development seamless” with a specific account of the branching or translation it removes.

Use the same term for the same concept instead of rotating synonyms. Preserve qualifications that affect behavior. An asynchronous query, a bitmap annotation, and a controlled camera each need their own explanation.

Use lists for steps or distinct items, tables for comparisons, and headings for sections readers will look up. Keep headings descriptive. Avoid decorative formatting, repeated summaries, and conclusions that merely repeat the preceding section.

The “one ring” origin can appear briefly in the project introduction. Use concrete descriptions of the library elsewhere.

## Markdown paragraph formatting

Write each prose paragraph on one physical line in the Markdown source. Separate paragraphs with a blank line. Do not insert manual line breaks within a paragraph, even to meet a line-width preference; use the editor's soft wrapping for readability.

Keep the prose within each list item on one physical line as well. Preserve structural line breaks for headings, separate list items, nested lists, table rows, link definitions, and fenced code or diagram blocks. Code examples may use multiple lines and retain their language-specific formatting.

Do not use trailing spaces, a trailing backslash, or `<br>` tags to force line breaks in prose. Configure Markdown formatters to preserve single-line paragraphs rather than rewrap them. Before delivery, check that prose has no manual wrapping and that separate paragraphs have a blank line between them.

## Architecture and reference structure

The architecture document explains motivation, the SDK and wrapper relationships, the adapter design, dependency ownership, representative incompatibilities, portability boundaries, and unresolved design choices. Use a simple diagram to show the four adapter paths. Keep exhaustive inventories in the references.

Organize references by task: maps and camera; sources and layers; markers and controls; capabilities and extensions. Cross-link explanations rather than copying them into multiple files.

Each component or operation should explain the developer's goal, compare the existing interfaces, describe the proposed one-map-react contract, and explain how adapters would fulfill it. Include limitations and unresolved decisions where they affect that contract.

Comparison tables must have these four columns, in this order:

1. RNMapbox
2. MapLibre React Native
3. react-map-gl
4. Proposed one-map-react API

Use separate tables for small groups of related fields, methods, or events. Identify the compared concept within the cells or surrounding text; do not add a fifth column. Keep long explanations and code blocks outside table cells.

Include links to the specific upstream documentation or implementation in the relevant cells. The one-map-react column should state the proposed interface and whether it requires a rename, data conversion, behavioral adaptation, documented fallback, or unsupported-feature decision.

## Facts and proposal status

Separate existing upstream behavior from the one-map-react design. Use these status labels where needed:

- **Existing API:** behavior established by the inspected upstream documentation or source.
- **Agreed design:** a one-map-react decision accepted by the project owner, with implementation status stated separately.
- **Proposed API:** an interface under consideration.
- **Open question:** a decision or behavioral claim that still needs investigation.

A section-level label is sufficient when it clearly applies to everything beneath it. Do not label each sentence. Describe a one-map-react feature as implemented only when an implementation exists.

Distinguish a wrapper omission from an underlying SDK limitation. A missing React component does not establish that the renderer lacks the capability. Similar names or compatible TypeScript types do not establish equivalent runtime behavior.

Keep property-name coverage, API coverage, and runtime compatibility separate. Any percentage must identify its denominator and method. Do not turn an estimate into a measured finding.

When discussing portability, identify differences in defaults, return values, events, timing, updates, and interaction behavior. Use exact promises such as “returns a promise of a feature array” rather than vague statements that methods are compatible.

## Code examples

For nontrivial differences, show RNMapbox, MapLibre React Native, react-map-gl, and the proposed one-map-react API accomplishing the same task. Reuse coordinates, data, identifiers, and styling so readers can compare the implementations directly.

Include imports and setup that affect the example. Use TypeScript and TSX fences, short lines, and consistent formatting. Mark omitted setup with a language-appropriate comment. Explain the purpose before the example and the behavioral differences afterward.

Use DOM children in web examples and native children in React Native examples. If child content cannot be shared, explain that boundary. Distinguish initial camera configuration from controlled state and imperative movement.

Label one-map-react examples as proposed until their API is implemented. Do not present illustrative code as runnable. For upstream examples, record the versions against which they were checked. Type-check examples where practical; reserve claims about runtime behavior for evidence from the implementation or relevant execution.

For difficult cases, explain the adapter mechanism as well as the caller's syntax. Cover asynchronous queries, controlled camera feedback, marker interaction, style updates and removal, and feature-state semantics where relevant. A method rename alone is not an explanation of those cases.

## Sources and links

Prefer official documentation and the inspected source code. Record package versions, commits or release tags, and the inspection date in each reference document's research basis. Explain version differences only when they affect the comparison.

Use GitHub links pinned to a commit or release tag for implementation evidence. Link to the specific file and lines when useful. Pair implementation links with readable API documentation where available. Check that the linked version supports the associated claim.

Use relative links between documents in this directory. Keep citations near the claim or table entry they support. Historical research memos provide context; verify version-sensitive claims before carrying them into current references.

## Portability and errors

For unsupported features, document whether one-map-react can preserve behavior through a fallback, needs an explicit degradation policy, or must report `UnsupportedFeatureError`. Keep invalid arguments and runtime failures separate from unsupported functionality.

Explain observable consequences. Ignoring a presentation option differs from ignoring a filter, a camera constraint, or marker dragging. A query failure must not be described as an empty successful result.

Distinguish installed packages, JavaScript bundle contents, and linked native SDKs when discussing dependencies or size. Explain whether changing a backend requires configuration changes or rebuilding the native application.

## Writing references

Use the [Google developer documentation style guide](https://developers.google.com/style) for technical prose and formatting. Use [Diátaxis](https://diataxis.fr/) to distinguish architectural explanation from lookup-oriented reference material.

The [doc-coauthoring workflow](https://github.com/anthropics/skills/blob/main/skills/doc-coauthoring/SKILL.md) offers useful refinement and reader-review methods. Apply them without repeating intake questions that the project context already answers.

Use [no-ai-slop](https://github.com/petergyang/no-ai-slop) for the final editorial pass when available. Protect API names, quoted source material, technical qualifications, and useful examples. An editorial pass must not change the proposed contract or strengthen a claim beyond its evidence.

## Review before delivery

Check that a reader can:

- Trace each wrapper to its rendering SDK and understand where one-map-react fits.
- Distinguish existing behavior, agreed decisions, proposals, and open questions.
- Compare examples that perform the same task.
- Understand behavioral differences without the conversation history.
- Find the source supporting each material upstream claim.
- Determine what happens when a requested feature is unsupported.

Check links, table structure, API spelling, example consistency, and proposal labels. Remove filler after checking technical accuracy. Finish by checking that the architecture and reference documents describe the same one-map-react contract.
