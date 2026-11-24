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
import type { NativeMapInputs } from "../../contracts/native-types.js";
import type {
  NativeMoveCallbacks,
  NativeViewportBounds,
} from "./move-event.js";
import {
  nativeCameraTarget,
  nativeInitialCamera,
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

/** Keeps native layout and camera updates out of the common map-access context. */
export const withNativeMapPresentation = <
  Handle extends MapRef,
  Props extends NativeMapInputs,
>(
  Implementation: ForwardRefExoticComponent<Props & RefAttributes<Handle>>
): ForwardRefExoticComponent<PropsWithoutRef<Props> & RefAttributes<Handle>> =>
  forwardRef<Handle, Props>((props, ref) => (
    <NativePresentationProvider>
      <NativeCameraProvider
        initial={props.initialViewState ?? nativeCameraTarget(props)}
        onMove={props.onMove}
        onMoveEnd={props.onMoveEnd}
      >
        {(callbacks) => (
          <Implementation {...(props as Props)} {...callbacks} ref={ref} />
        )}
      </NativeCameraProvider>
    </NativePresentationProvider>
  ));

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
  onMove,
  onMoveEnd,
  children,
}: {
  readonly initial: NativeMapInputs["initialViewState"];
  readonly onMove?: MapProps["onMove"];
  readonly onMoveEnd?: MapProps["onMoveEnd"];
  readonly children: (callbacks: NativeMoveCallbacks) => ReactNode;
}) => {
  const [observed, setObserved] = useState<NativeCameraState>(() => ({
    viewState: nativeInitialCamera(initial),
  }));
  const callbacks = useMemo<NativeMoveCallbacks>(() => {
    const observeCamera = (
      viewState: ViewState,
      bounds?: NativeViewportBounds
    ): void => {
      setObserved((previous) => {
        if (
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
  }, [onMove, onMoveEnd]);
  // Observations update camera consumers without recreating the renderer child.
  const content = useMemo(() => children(callbacks), [children, callbacks]);
  return (
    <NativeCameraContext.Provider value={observed}>
      {content}
    </NativeCameraContext.Provider>
  );
};

const isSameCamera = (previous: ViewState, next: ViewState): boolean =>
  previous.longitude === next.longitude &&
  previous.latitude === next.latitude &&
  previous.zoom === next.zoom &&
  previous.bearing === next.bearing &&
  previous.pitch === next.pitch;

const isSameBounds = (
  previous: NativeViewportBounds | undefined,
  next: NativeViewportBounds | undefined
): boolean =>
  previous?.[0] === next?.[0] &&
  previous?.[1] === next?.[1] &&
  previous?.[2] === next?.[2] &&
  previous?.[3] === next?.[3];
