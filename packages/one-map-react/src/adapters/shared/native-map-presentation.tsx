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
import type { MoveEvent } from "../../contracts/event-types.js";
import type { MapProps } from "../../contracts/map-types.js";

/** Native-only presentation owned by the selected adapter's map. */
export interface NativeMapPresentation {
  readonly overlayHostName: string;
  readonly nativeLocationFollowing: boolean;
  readonly nativeLayout?: { readonly width: number; readonly height: number };
  setNativeLayout(width: number, height: number): void;
}

export const NativeMapPresentationContext =
  createContext<NativeMapPresentation | null>(null);

/** Camera movement observed from the native wrapper. */
interface NativeCameraState {
  /** Observed native camera. */
  readonly viewState: ViewState;
  /** Invalidates marker projection when the native target stays unchanged. */
  readonly observedViewState: ViewState;
}

export const NativeCameraContext = createContext<NativeCameraState | null>(
  null
);

/** Keeps native layout and camera updates out of the common map-access context. */
export const withNativeMapPresentation = <Props extends MapProps>(
  Implementation: ForwardRefExoticComponent<Props & RefAttributes<MapRef>>
): ForwardRefExoticComponent<PropsWithoutRef<Props> & RefAttributes<MapRef>> =>
  forwardRef<MapRef, Props>((props, ref) => (
    <NativePresentationProvider following={selectedLocationFollowing(props)}>
      <NativeCameraProvider
        initial={props.initialViewState}
        onMove={props.onMove}
        onMoveEnd={props.onMoveEnd}
      >
        {(callbacks) => (
          <Implementation {...(props as Props)} {...callbacks} ref={ref} />
        )}
      </NativeCameraProvider>
    </NativePresentationProvider>
  ));

/** Reads native presentation where a browser implementation may also call the hook. */
export const useOptionalNativeMapPresentation =
  (): NativeMapPresentation | null => useContext(NativeMapPresentationContext);

/** Returns the enclosing native map's presentation owner. */
export const useNativeMapPresentation = (): NativeMapPresentation => {
  const presentation = useOptionalNativeMapPresentation();
  if (!presentation)
    throw new Error("This component must render inside a native Map.");
  return presentation;
};

const NativePresentationProvider = ({
  following,
  children,
}: {
  readonly following: boolean;
  readonly children: ReactNode;
}) => {
  const overlayHostName = useId();
  const [nativeLayout, storeNativeLayout] =
    useState<NativeMapPresentation["nativeLayout"]>();
  const [{ setNativeLayout }] = useState(() => ({
    setNativeLayout: (width: number, height: number): void => {
      storeNativeLayout((previous) =>
        previous?.width === width && previous.height === height
          ? previous
          : { width, height }
      );
    },
  }));
  const presentation = useMemo(
    () => ({
      overlayHostName,
      nativeLocationFollowing: following,
      nativeLayout,
      setNativeLayout,
    }),
    [overlayHostName, following, nativeLayout, setNativeLayout]
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
  readonly initial: ViewState;
  readonly onMove?: MapProps["onMove"];
  readonly onMoveEnd?: MapProps["onMoveEnd"];
  readonly children: (
    callbacks: Required<Pick<MapProps, "onMove" | "onMoveEnd">>
  ) => ReactNode;
}) => {
  const [observed, setObserved] = useState(initial);
  const callbacks = useMemo(
    () => ({
      onMove: (event: MoveEvent) => {
        setObserved(event.viewState);
        onMove?.(event);
      },
      onMoveEnd: (event: MoveEvent) => {
        setObserved(event.viewState);
        onMoveEnd?.(event);
      },
    }),
    [onMove, onMoveEnd]
  );
  // Observations update camera consumers without recreating the renderer child.
  const content = useMemo(() => children(callbacks), [children, callbacks]);
  const camera = useMemo(
    () => ({ viewState: observed, observedViewState: observed }),
    [observed]
  );
  return (
    <NativeCameraContext.Provider value={camera}>
      {content}
    </NativeCameraContext.Provider>
  );
};

const selectedLocationFollowing = (props: MapProps): boolean => {
  if (
    !("locationOptions" in props) ||
    !props.locationOptions ||
    typeof props.locationOptions !== "object"
  )
    return false;
  const options = props.locationOptions as {
    followUserLocation?: boolean;
    trackUserLocation?: unknown;
  };
  return (
    options.followUserLocation === true ||
    options.trackUserLocation !== undefined
  );
};
