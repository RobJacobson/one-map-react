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
import { type NativeLayoutSize, updateLayoutSize } from "./wrapper-values.js";

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
  Implementation: ForwardRefExoticComponent<Props & RefAttributes<Handle>>
): ForwardRefExoticComponent<PropsWithoutRef<Props> & RefAttributes<Handle>> =>
  forwardRef<Handle, Props>((props, ref) => {
    const viewState = nativeCameraTarget(props);
    const [initialViewState] = useState(() =>
      snapshotNativeInitialCamera(props.initialViewState ?? viewState)
    );
    return (
      <NativePresentationProvider>
        <NativeCameraProvider
          initial={initialViewState}
          target={viewState}
          onMove={props.onMove}
          onMoveEnd={props.onMoveEnd}
        >
          {(callbacks, resolvedTarget) => (
            <Implementation
              {...(props as Props)}
              {...callbacks}
              viewState={resolvedTarget}
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
  onMove,
  onMoveEnd,
  children,
}: {
  readonly initial: NativeMapInputs["initialViewState"];
  readonly target: NativeCameraTarget | undefined;
  readonly onMove?: MapProps["onMove"];
  readonly onMoveEnd?: MapProps["onMoveEnd"];
  readonly children: (
    callbacks: NativeMoveCallbacks,
    target: NativeCameraTarget | undefined
  ) => ReactNode;
}) => {
  const [initialCamera] = useState<NativeCameraState>(() => ({
    viewState: nativeInitialCamera(initial),
  }));
  const [observed, setObserved] = useState(initialCamera);
  const waitsForInitialFit = initial?.bounds !== undefined;
  const currentCamera =
    waitsForInitialFit && observed === initialCamera
      ? undefined
      : observed.viewState;

  // A changed target samples the camera once so subsequent gestures cannot replay it.
  const [selection, setSelection] = useState(() =>
    selectCameraTarget(target, currentCamera)
  );
  if (
    !isSameCameraTarget(selection.target, target) ||
    (selection.waitsForCenter && currentCamera !== undefined)
  ) {
    setSelection(selectCameraTarget(target, currentCamera));
  }

  const callbacks = useMemo<NativeMoveCallbacks>(() => {
    const observeCamera = (
      viewState: ViewState,
      bounds?: NativeViewportBounds
    ): void => {
      setObserved((previous) => {
        if (
          !(waitsForInitialFit && previous === initialCamera) &&
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
  }, [initialCamera, onMove, onMoveEnd, waitsForInitialFit]);
  // Observations update camera consumers without recreating the renderer child.
  const content = useMemo(
    () => children(callbacks, selection.resolved),
    [children, callbacks, selection.resolved]
  );
  return (
    <NativeCameraContext.Provider value={observed}>
      {content}
    </NativeCameraContext.Provider>
  );
};

const selectCameraTarget = (
  target: NativeCameraTarget | undefined,
  observed: ViewState | undefined
) => {
  const center = target && nativeCameraCenter(target, observed);
  return {
    target,
    waitsForCenter:
      center === undefined &&
      (target?.longitude !== undefined || target?.latitude !== undefined),
    resolved: center
      ? { ...target, longitude: center[0], latitude: center[1] }
      : target,
  };
};

const isSameCameraTarget = (
  previous: NativeCameraTarget | undefined,
  next: NativeCameraTarget | undefined
): boolean => {
  if (!previous || !next) return previous === next;

  const from = previous.padding;
  const to = next.padding;
  return (
    isSameCamera(previous, next) &&
    isSameNumber(from?.top, to?.top) &&
    isSameNumber(from?.right, to?.right) &&
    isSameNumber(from?.bottom, to?.bottom) &&
    isSameNumber(from?.left, to?.left)
  );
};

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
