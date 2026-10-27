import * as Mapbox from "@rnmapbox/maps";
import {
  type ComponentProps,
  forwardRef,
  type ReactElement,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { type LayoutChangeEvent, Platform, View } from "react-native";

import type { Anchor, MarkerRef } from "../../contracts/ui-types.js";
import { NativeMarkerOverlay } from "../shared/native-marker-overlay.js";
import {
  createNativeUI,
  type NativeMarkerHostProps,
} from "../shared/native-ui.js";
import { useActiveCallback } from "../shared/use-active-callback.js";
import {
  lngLatFromWrapper,
  pointFromWrapper,
} from "../shared/wrapper-values.js";

/** Native Mapbox annotations and controls used by the selected adapter. */
export const mapboxNativeUI = createNativeUI({
  Marker: NativeMarkerOverlay,
  Annotation: forwardRef<MarkerRef, NativeMarkerHostProps>((props, ref) => (
    <MapboxAnnotationHost {...props} ref={ref} />
  )),
  backend: "mapbox-native",
});

/** Direct live native marker, including wrapper-specific collision options. */
export const MarkerView = Mapbox.MarkerView;
/** Direct snapshot annotation, selection, callout, and native drag facilities. */
export const PointAnnotation = Mapbox.PointAnnotation;
/** Native annotation callout content. */
export const Callout = Mapbox.Callout;
/** Native layer annotation for animated and rotated marker imagery. */
export const Annotation = Mapbox.Annotation;

type AnnotationEvent = Parameters<
  NonNullable<ComponentProps<typeof Mapbox.PointAnnotation>["onSelected"]>
>[0];

const MapboxAnnotationHost = forwardRef<MarkerRef, NativeMarkerHostProps>(
  (props, ref): ReactElement => {
    // PointAnnotation's class handler reads props even during a suspended render.
    const click = useActiveCallback(props.onClick);
    const annotationRef =
      useRef<InstanceType<typeof Mapbox.PointAnnotation>>(null);
    const [size, setSize] = useState({ width: 0, height: 0 });
    const fraction = anchorFraction(props.anchor);
    const horizontal = Math.abs(props.offset[0]);
    const vertical = Math.abs(props.offset[1]);
    const width = size.width + horizontal * 2;
    const height = size.height + vertical * 2;
    const anchor = {
      x:
        width > 0
          ? (fraction[0] * size.width + horizontal) / width
          : fraction[0],
      y:
        height > 0
          ? (fraction[1] * size.height + vertical) / height
          : fraction[1],
    };

    useImperativeHandle(ref, () => ({
      refresh: async () => {
        const annotation = annotationRef.current;
        if (!annotation) throw new Error("RNMapbox annotation is detached.");
        annotation.refresh();
      },
    }));

    const measure = (event: LayoutChangeEvent): void => {
      const { width: measuredWidth, height: measuredHeight } =
        event.nativeEvent.layout;
      setSize((previous) =>
        previous.width === measuredWidth && previous.height === measuredHeight
          ? previous
          : { width: measuredWidth, height: measuredHeight }
      );
    };
    const content = (
      <View
        collapsable={false}
        style={{
          // Symmetric anchor padding plus directional content padding moves hit bounds too.
          paddingLeft: Math.max(0, props.offset[0] * 2),
          paddingRight: Math.max(0, -props.offset[0] * 2),
          paddingTop: Math.max(0, props.offset[1] * 2),
          paddingBottom: Math.max(0, -props.offset[1] * 2),
        }}
      >
        <View collapsable={false} onLayout={measure}>
          {props.children}
        </View>
      </View>
    );
    const normalize = (event: AnnotationEvent) => ({
      lngLat: lngLatFromWrapper(event.geometry.coordinates),
      // Pinned RNMapbox iOS reports window coordinates for annotation screen points.
      ...(Platform.OS === "ios"
        ? {}
        : {
            point: pointFromWrapper({
              x: event.properties.screenPointX,
              y: event.properties.screenPointY,
            }),
          }),
    });

    return (
      <Mapbox.PointAnnotation
        ref={annotationRef}
        id={props.id}
        coordinate={[props.lngLat[0], props.lngLat[1]]}
        anchor={anchor}
        onSelected={(event: AnnotationEvent) => click(normalize(event))}
      >
        {content}
      </Mapbox.PointAnnotation>
    );
  }
);

const anchorFraction = (anchor: Anchor): readonly [number, number] => {
  const x = anchor.includes("left") ? 0 : anchor.includes("right") ? 1 : 0.5;
  const y = anchor.includes("top") ? 0 : anchor.includes("bottom") ? 1 : 0.5;
  return [x, y];
};
