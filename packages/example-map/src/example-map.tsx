import type { MapLayoutStyle, ViewState } from "one-map-react";
import type { ComponentType, ReactElement, RefCallback } from "react";

import type { CameraMap } from "./camera.js";
import type { Engine, useExampleMap } from "./use-example-map.js";

interface ExampleMapViewProps {
  readonly ref: RefCallback<CameraMap>;
  readonly mapStyle: string;
  readonly projection: "mercator";
  readonly initialViewState: ViewState;
  readonly style: MapLayoutStyle;
  readonly interactive?: boolean;
  readonly boxZoom?: boolean;
  readonly doubleClickZoom?: boolean;
  readonly dragPan?: boolean;
  readonly dragRotate?: boolean;
  readonly keyboard?: boolean;
  readonly scrollZoom?: boolean;
  readonly touchPitch?: boolean;
  readonly touchZoomRotate?: boolean;
  readonly onLoad: () => void;
  readonly onMove: (event: { readonly viewState: ViewState }) => void;
  readonly onMoveEnd: (event: { readonly viewState: ViewState }) => void;
  readonly onError: () => void;
}

/** The two platform map components used by the basemap. */
export type ExampleMaps = Readonly<
  Record<Engine, ComponentType<ExampleMapViewProps>>
>;

interface ExampleMapProps {
  readonly model: ReturnType<typeof useExampleMap>;
  readonly maps: ExampleMaps;
  readonly native?: boolean;
  readonly style: MapLayoutStyle;
}

/**
 * Renders the basemap with the platform's selected component.
 *
 * @param props - Map model, platform components, and host layout.
 * @returns Keyed map attachment that retires on switch or retry.
 */
export const ExampleMap = ({
  model,
  maps,
  native,
  style,
}: ExampleMapProps): ReactElement => {
  const MapView = maps[model.attachment.engine];
  const interactive = model.status === "ready";
  return (
    <MapView
      key={model.attachment.generation}
      ref={model.attachMap}
      initialViewState={
        // eslint-disable-next-line react/refs -- The attachment camera is React state.
        model.attachment.camera
      }
      mapStyle="https://tiles.openfreemap.org/styles/liberty"
      projection="mercator"
      style={style}
      {...(native
        ? { interactive }
        : {
            boxZoom: interactive,
            doubleClickZoom: interactive,
            dragPan: interactive,
            dragRotate: interactive,
            keyboard: interactive,
            scrollZoom: interactive,
            touchPitch: interactive,
            touchZoomRotate: interactive,
          })}
      onLoad={() => {
        void model.onLoad();
      }}
      onMove={model.onMove}
      onMoveEnd={model.onMove}
      onError={model.onError}
    />
  );
};
