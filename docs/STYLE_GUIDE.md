# one-map-react documentation conventions

Follow the [shared documentation style](https://github.com/RobJacobson/react-style-guide/blob/v0.1.0/documentation-style.md) for Markdown layout and the `technical-writing` skill for substantive technical prose. These conventions add mapping-specific terminology, comparison, and evidence requirements.

## Audience and terms

Write for developers familiar with React and Node who may be new to mapping SDKs. Explain source, layer, and camera concepts before relying on them. Distinguish the rendering SDK, its React wrapper, the one-map-react adapter, and services that supply tiles or geocoding. Use **backend** for the selected implementation and **platform** for web, iOS, or Android. Name a specific SDK when describing renderer behavior.

Use the canonical names one-map-react, RNMapbox (`@rnmapbox/maps`), MapLibre React Native (`@maplibre/maplibre-react-native`), react-map-gl, Mapbox GL JS, and MapLibre GL JS. Preserve upstream API spelling.

## Architecture and API references

The architecture document explains wrapper relationships, adapter paths, dependency ownership, portability boundaries, and unresolved design choices. Organize references by developer task and cross-link explanations instead of duplicating them.

For nontrivial API differences, compare RNMapbox, MapLibre React Native, react-map-gl, and the proposed one-map-react API in that order. Use four-column tables, with the compared concept in a cell or nearby prose. The one-map-react column states the proposed interface and whether it needs a rename, data conversion, behavioral adaptation, fallback, or unsupported-feature decision. Link relevant upstream documentation or inspected source near each material claim.

Separate **existing API**, **agreed design**, **proposed API**, and **open question**. State implementation and runtime verification separately. A missing React wrapper component does not prove the renderer lacks the capability. Keep property coverage, API coverage, and runtime compatibility distinct; give any percentage its denominator and method.

Use equivalent data and setup in side-by-side examples. Include imports, distinguish web and native children, and label examples as proposed until implemented. Explain asynchronous queries, controlled camera feedback, marker interaction, style updates, and feature-state behavior where a method rename alone is insufficient.

## Evidence and portability

Prefer official documentation and inspected source. Record versions, commits or release tags, and inspection dates in each reference's research basis. Use pinned implementation links for version-sensitive claims. Verify historical research memos before carrying claims into current references.

Explain differences in defaults, return values, events, timing, updates, and interaction behavior. For unsupported features, document the fallback, explicit degradation policy, or `UnsupportedFeatureError`. Distinguish invalid arguments and runtime failures from unsupported functionality. Separate installed packages, JavaScript bundle contents, and linked native SDKs when discussing dependency size.

Before delivery, check links, table structure, API names, example consistency, proposal status, and alignment between the architecture and reference documents.
