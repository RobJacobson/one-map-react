import { type ComponentType, forwardRef, type RefAttributes } from "react";

import { createNativeSceneComponents } from "../../example-map/src/scenarios/native-scene-components.js";
import type { NativeSceneComponents } from "../../example-map/src/scenarios/scene-components.js";
import type { MapRef } from "../src/contracts/camera-types.js";
import type { NativeMapInputs } from "../src/contracts/native-types.js";
import type { SourceProps } from "../src/contracts/source-types.js";
import { createNativeMapBinding } from "../src/facade/native-map.js";

const MapWithChildren = forwardRef<MapRef, NativeMapInputs>(
  ({ children }, _ref) => <>{children}</>
);
const SourceWithChildren = ({ children }: SourceProps) => <>{children}</>;
const Layer = () => <></>;

/**
 * Supplies mounted native bindings with a mocked renderer to example scenarios.
 *
 * @param renderer - Fake map that receives map props and exposes test methods.
 * @returns The selected components, map lookup, and scene extensions.
 */
export const createNativeSceneFixture = (
  renderer: ComponentType<
    NativeMapInputs & RefAttributes<MapRef>
  > = MapWithChildren
): NativeSceneComponents =>
  createNativeSceneComponents("mapbox-native", {
    ...createNativeMapBinding(renderer, {
      backend: "mapbox-native",
      Source: SourceWithChildren,
      Layer,
      Images: () => null,
      Marker: () => null,
    }),
    Layer,
  });
