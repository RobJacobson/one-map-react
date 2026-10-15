# Native control portals

Status: implemented in the TF07 audit correction; routine verification and native integration acceptance are separate gates.

## Demonstrated gap

The first TF07 control implementation stored React elements in the map facade and rendered them beside the native renderer. A mocked reproduction placed a context provider between `Map` and `Control`; its child received the outside context default. Updating that provider could not restore the child’s original ancestry. Web `createPortal` preserves that ancestry.

The pinned RNMapbox 10.3.7 and MapLibre React Native 11.5.0 map wrappers provide map features and geographic annotations, with no public portal for an arbitrary screen overlay. RNMapbox Android’s `addFeature` does not attach an ordinary child `ViewGroup` as a control. Geographic markers cannot provide fixed screen placement during camera movement. React Native 0.87.1 exposes no public portal API for an existing child view. Hoisting providers would require application code to know about this adapter difference.

## Implementation

Use the public `Portal`, `PortalHost`, and `PortalProvider` components from `react-native-teleport@1.2.1`. Its [Portal API](https://kirillzyusko.github.io/react-native-teleport/docs/api/components/portal) moves native views while preserving the React tree. The adapter supplies a host above each map; generated host names keep maps separate. Controls render their children at their original React location and register only corner placement and measured height. Heights retain the existing eight-point gap and stacking order in each corner. Default native SDK ornaments use those measured rows to avoid control overlap; removing rows restores eight-point margins. Explicit selected SDK positions remain application-owned.

RNMapbox 10.3.7's iOS scale-position setter stores new margins without marking the scale for application. The adapter commits changed margins with the scale disabled, then restores its configured visibility on a later animation frame. Native size changes also trigger this refresh, and obsolete frames are cancelled. The enabled setter applies those margins. A configured disabled scale stays disabled, and Android retains ordinary position forwarding. This correction uses existing public wrapper props and requires no linked dependency change.

The runtime repair also uses each map's host for common live markers and standalone popups. Actual iOS presses were cancelled when child touches changed SDK gesture props inside geographic marker hosts. Projecting the coordinate through the public map ref and measuring the content anchor places those children outside SDK recognizers. Camera movement and native layout changes update projection; stale asynchronous results are discarded. The children stay in their original React tree. Static annotations and direct selected SDK marker exports remain delegated to their wrappers. This reuse adds no linked dependency; its physical touch acceptance remains pending.

This adds an optional native peer and a root development dependency. Native example manifests include it, and selected-peer checks install it with either native wrapper. Common and web entries remain independent of the peer. The library adds no native bridge, renderer lifecycle controller, or private React context inspection.

Teleport 1.2.1 also declares React DOM as a peer. The native examples override its resolution to the existing React 19.2.3 baseline, and isolated native consumers pin React DOM 19.2.3 during installation. This prevents Bun from resolving a newer incompatible React DOM peer. Metro selects Teleport’s native files; its browser implementation is outside the native import path.

The [installation guide](https://kirillzyusko.github.io/react-native-teleport/docs/installation) requires the Fabric architecture and native linking. The project’s React Native 0.87.1 baseline uses Fabric. Applications must install the peer and rebuild; declaration checks do not establish native compatibility.

## Verification

Routine regressions check nested context, provider updates, child state and effects, measured stacking, host-prop composition, and removal. The existing map and UI suites still apply. Packed-consumer and selected-peer checks cover optional-peer isolation and declarations.

The native peer changes the linked artifact. Both native engines on iOS and Android need approved builds and interaction checks before acceptance is recorded. Those checks must verify portal attachment, context-dependent controls, resize, touch passthrough, multiple maps, stacking, style replacement, and unmount. Historical TF02–TF06 evidence does not certify the new portal integration. Acceptance remains unverified under the [testing policy](../testing-policy.md#acceptance-timing-and-user-permission).

Android focused acceptance exposed text displacement after the portal host resized: accessibility labels survived while control text moved outside its map. Keeping a concrete control root did not correct it. RNMapbox Android does not attach the original portal view, and the peer suppresses native layout-state updates for a detached source. Android controls pass each map's measured viewport dimensions through the public portal style prop, forcing corner layout to update without remounting children. The iOS wrapper attaches its source view and retains the peer's native host sizing. A missed iOS Map B press was traced to a development warning banner covering the child, and a later landscape observation used stale test-button coordinates. Both failures remain recorded. After correcting physical input, the [iOS follow-up](../tf07-ui.md#runtime-checkpoint) passed provider updates, child state, per-map access, Resize, landscape and restored portrait drawing and touches. Mapbox Android’s full focused flow also passed. MapLibre’s native core and focused acceptance remain pending.
