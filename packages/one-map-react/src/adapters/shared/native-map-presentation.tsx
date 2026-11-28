import {
  createContext,
  forwardRef,
  type ForwardRefExoticComponent,
  type ReactNode,
  type PropsWithoutRef,
  type RefAttributes,
  useContext,
  useId,
  useMemo,
  useState,
} from "react";

import type { MapRef, ViewState } from "../../contracts/camera-types.js";
import type { MapProps } from "../../contracts/map-types.js";
import type {
  NativeCameraTarget,
  NativeMapInputs,
} from "../../contracts/native-types.js";
import { MapSessionContext } from "../../facade/map-context.js";
import type {
  NativeMoveCallbacks,
  NativeViewportBounds,
} from "./move-event.js";
import {
  nativeCameraCenter,
  nativeCameraTarget,
  nativeInitialCamera,
  snapshotNativeInitialCamera,
} from "./native-camera-inputs.js";
import {
  type NativeLayoutSize,
  normalizePadding,
  updateLayoutSize,
} from "./wrapper-values.js";

/** Camera payload selected for the adapter's declarative Camera stop. */
export interface NativeCameraPresentationProps extends NativeMoveCallbacks {
  readonly cameraStop: CameraStop;
}

type CameraStop =
  | { readonly kind: "apply"; readonly target: NativeCameraTarget }
  | {
      readonly kind: "idle";
      readonly padding: NativeCameraTarget["padding"];
    };

/** Native-only presentation owned by the selected adapter's map. */
export interface NativeMapPresentation {
  readonly overlayHostName: string;
  readonly nativeLayout?: NativeLayoutSize;
  setNativeLayout(width: number, height: number): void;
}

export const NativeMapPresentationContext =
  createContext<NativeMapPresentation | null>(null);

/** Camera movement observed from the native wrapper. */
interface NativeCameraState {
  /** Observed native camera. */
  readonly viewState: ViewState;
  /** Visible native viewport, which can change independently of the camera fields. */
  readonly bounds?: NativeViewportBounds;
}

export const NativeCameraContext = createContext<NativeCameraState | null>(
  null
);

/**
 * Resolves the camera inputs and keeps native layout and observations map-local.
 *
 * @param Implementation - Selected native map renderer.
 * @returns The map with native presentation and camera providers.
 */
export const withNativeMapPresentation = <
  Handle extends MapRef,
  Props extends NativeMapInputs,
>(
  Implementation: ForwardRefExoticComponent<
    Props & NativeCameraPresentationProps & RefAttributes<Handle>
  >
): ForwardRefExoticComponent<PropsWithoutRef<Props> & RefAttributes<Handle>> =>
  forwardRef<Handle, Props>((props, ref) => {
    const viewState = nativeCameraTarget(props);
    const padding =
      viewState?.padding ??
      (props.padding === undefined
        ? undefined
        : normalizePadding(props.padding));
    const [initialViewState] = useState(() =>
      snapshotNativeInitialCamera(props.initialViewState ?? viewState)
    );
    return (
      <NativePresentationProvider>
        <NativeCameraProvider
          initial={initialViewState}
          target={viewState}
          padding={padding}
          onMove={props.onMove}
          onMoveEnd={props.onMoveEnd}
        >
          {(callbacks, cameraStop) => (
            <Implementation
              {...(props as Props)}
              {...callbacks}
              viewState={viewState}
              cameraStop={cameraStop}
              initialViewState={initialViewState}
              ref={ref}
            />
          )}
        </NativeCameraProvider>
      </NativePresentationProvider>
    );
  });

/** Returns the enclosing native map's presentation owner. */
export const useNativeMapPresentation = (): NativeMapPresentation => {
  const presentation = useContext(NativeMapPresentationContext);
  if (!presentation)
    throw new Error("This component must render inside a native Map.");
  return presentation;
};

const NativePresentationProvider = ({
  children,
}: {
  readonly children: ReactNode;
}) => {
  const overlayHostName = useId();
  const [nativeLayout, storeNativeLayout] =
    useState<NativeMapPresentation["nativeLayout"]>();
  const [{ setNativeLayout }] = useState(() => ({
    setNativeLayout: (width: number, height: number): void => {
      storeNativeLayout((previous) =>
        updateLayoutSize(previous, width, height)
      );
    },
  }));
  const presentation = useMemo(
    () => ({
      overlayHostName,
      nativeLayout,
      setNativeLayout,
    }),
    [overlayHostName, nativeLayout, setNativeLayout]
  );
  return (
    <NativeMapPresentationContext.Provider value={presentation}>
      {children}
    </NativeMapPresentationContext.Provider>
  );
};

const NativeCameraProvider = ({
  initial,
  target,
  padding,
  onMove,
  onMoveEnd,
  children,
}: {
  readonly initial: NativeMapInputs["initialViewState"];
  readonly target: NativeCameraTarget | undefined;
  readonly padding: NativeCameraTarget["padding"];
  readonly onMove?: MapProps["onMove"];
  readonly onMoveEnd?: MapProps["onMoveEnd"];
  readonly children: (
    callbacks: NativeMoveCallbacks,
    stop: CameraStop
  ) => ReactNode;
}) => {
  const loaded = Boolean(useContext(MapSessionContext)?.loadedAttachment);
  const [initialCamera] = useState<NativeCameraState>(() => ({
    viewState: nativeInitialCamera(initial),
  }));
  const [observed, setObserved] = useState(initialCamera);
  const hasObserved = observed !== initialCamera;
  const waitsForInitialFit = initial?.bounds !== undefined;
  const currentCamera =
    waitsForInitialFit && !hasObserved ? undefined : observed.viewState;
  const ready = loaded || hasObserved;

  const [selection, setSelection] = useState(() =>
    selectCameraStop({ target, padding, observed: currentCamera, ready })
  );
  const next = selectCameraStop({
    target,
    padding,
    observed: currentCamera,
    ready,
    previous: selection,
  });
  if (next !== selection) setSelection(next);

  const callbacks = useMemo<NativeMoveCallbacks>(() => {
    const observeCamera = (
      viewState: ViewState,
      bounds?: NativeViewportBounds
    ): void => {
      setObserved((previous) => {
        if (
          previous !== initialCamera &&
          isSameCamera(previous.viewState, viewState) &&
          isSameBounds(previous.bounds, bounds)
        ) {
          return previous;
        }
        return { viewState, bounds };
      });
    };

    return {
      onMove: (event, bounds) => {
        observeCamera(event.viewState, bounds);
        onMove?.(event);
      },
      onMoveEnd: (event, bounds) => {
        observeCamera(event.viewState, bounds);
        onMoveEnd?.(event);
      },
    };
  }, [initialCamera, onMove, onMoveEnd]);
  // Observations update camera consumers without recreating the renderer child.
  const content = useMemo(
    () => children(callbacks, selection.stop),
    [children, callbacks, selection.stop]
  );
  return (
    <NativeCameraContext.Provider value={observed}>
      {content}
    </NativeCameraContext.Provider>
  );
};

interface CameraSelection {
  readonly target: NativeCameraTarget | undefined;
  readonly padding: NativeCameraTarget["padding"];
  readonly waitsForCenter: boolean;
  readonly stop: CameraStop;
}

const selectCameraStop = ({
  target,
  padding,
  observed,
  ready,
  previous,
}: {
  readonly target: NativeCameraTarget | undefined;
  readonly padding: NativeCameraTarget["padding"];
  readonly observed: ViewState | undefined;
  readonly ready: boolean;
  readonly previous?: CameraSelection;
}): CameraSelection => {
  const poseChanged =
    !isSameCamera(previous?.target ?? {}, target ?? {}) ||
    (previous?.waitsForCenter === true && observed !== undefined);
  const paddingChanged = !isSamePadding(previous?.padding, padding);
  if (previous && !poseChanged && !paddingChanged) return previous;

  const outputPadding = paddingChanged
    ? (padding ?? normalizePadding())
    : padding;
  // Keep the pose available until the wrapper initializes its camera.
  const applyPose = poseChanged || (!ready && paddingChanged);
  if (!applyPose || !target || isSameCamera(target, {})) {
    return {
      target,
      padding,
      waitsForCenter: !poseChanged && previous?.waitsForCenter === true,
      stop: paddingChanged
        ? { kind: "apply", target: { padding: outputPadding } }
        : { kind: "idle", padding },
    };
  }

  // Resolve a partial center once for each pose request, independently of padding.
  const center = nativeCameraCenter(target, observed);
  return {
    target,
    padding,
    waitsForCenter:
      center === undefined &&
      (target.longitude !== undefined || target.latitude !== undefined),
    stop: {
      kind: "apply",
      target: {
        ...target,
        longitude: center?.[0],
        latitude: center?.[1],
        padding: outputPadding,
      },
    },
  };
};

const isSamePadding = (
  previous: NativeCameraTarget["padding"],
  next: NativeCameraTarget["padding"]
): boolean =>
  isSameNumber(previous?.top, next?.top) &&
  isSameNumber(previous?.right, next?.right) &&
  isSameNumber(previous?.bottom, next?.bottom) &&
  isSameNumber(previous?.left, next?.left);

const isSameCamera = (
  previous: Partial<ViewState>,
  next: Partial<ViewState>
): boolean =>
  isSameNumber(previous.longitude, next.longitude) &&
  isSameNumber(previous.latitude, next.latitude) &&
  isSameNumber(previous.zoom, next.zoom) &&
  isSameNumber(previous.bearing, next.bearing) &&
  isSameNumber(previous.pitch, next.pitch);

const isSameNumber = (
  previous: number | undefined,
  next: number | undefined
): boolean => previous === next || Object.is(previous, next);

const isSameBounds = (
  previous: NativeViewportBounds | undefined,
  next: NativeViewportBounds | undefined
): boolean =>
  previous?.[0] === next?.[0] &&
  previous?.[1] === next?.[1] &&
  previous?.[2] === next?.[2] &&
  previous?.[3] === next?.[3];
