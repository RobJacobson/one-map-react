import {
  Callout,
  LayerAnnotation,
  Marker as NativeMarker,
  ViewAnnotation,
  type ViewAnnotationRef,
} from "@maplibre/maplibre-react-native";
import {
  type ComponentProps,
  forwardRef,
  type ReactElement,
  useImperativeHandle,
  useRef,
} from "react";

import type { MarkerRef } from "../../contracts/ui-types.js";
import { NativeMarkerOverlay } from "../shared/native-marker-overlay.js";
import {
  createNativeUI,
  type NativeMarkerHostProps,
} from "../shared/native-ui.js";
import {
  lngLatFromWrapper,
  pointFromWrapper,
} from "../shared/wrapper-values.js";

/** Native MapLibre annotations and controls used by the selected adapter. */
export const maplibreNativeUI = createNativeUI({
  Marker: NativeMarkerOverlay,
  Annotation: forwardRef<MarkerRef, NativeMarkerHostProps>((props, ref) => (
    <MaplibreAnnotationHost {...props} ref={ref} />
  )),
  backend: "maplibre-native",
});

/** Direct live native marker, including animatable-ref access. */
export const MarkerView = NativeMarker;
export { Callout, LayerAnnotation, ViewAnnotation };

type AnnotationEvent = Parameters<
  NonNullable<ComponentProps<typeof ViewAnnotation>["onPress"]>
>[0];

const MaplibreAnnotationHost = forwardRef<MarkerRef, NativeMarkerHostProps>(
  (props, ref): ReactElement => {
    const annotationRef = useRef<ViewAnnotationRef>(null);

    useImperativeHandle(ref, () => ({
      refresh: async () => {
        const annotation = annotationRef.current;
        if (!annotation) throw new Error("MapLibre annotation is detached.");
        annotation.refresh();
      },
    }));

    const normalize = (event: AnnotationEvent) => ({
      lngLat: lngLatFromWrapper(event.nativeEvent.lngLat),
      point: pointFromWrapper(event.nativeEvent.point),
    });

    return (
      <ViewAnnotation
        ref={annotationRef}
        id={props.id}
        lngLat={[props.lngLat[0], props.lngLat[1]]}
        anchor={props.anchor}
        offset={[props.offset[0], props.offset[1]]}
        onPress={(event: AnnotationEvent) => {
          event.stopPropagation();
          props.onClick?.(normalize(event));
        }}
      >
        {props.children}
      </ViewAnnotation>
    );
  }
);
