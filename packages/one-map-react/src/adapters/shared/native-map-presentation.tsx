import {
  createContext,
  forwardRef,
  type ForwardRefExoticComponent,
  type ReactNode,
  type PropsWithoutRef,
  type RefAttributes,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

import type { MapRef, ViewState } from "../../contracts/camera-types.js";
import type { MapProps } from "../../contracts/map-types.js";
import type { ControlPosition } from "../../contracts/ui-types.js";
import { useOptionalMapSession } from "../../facade/map-context.js";

/** Native control placement; children retain their original React ancestry. */
export interface NativeOverlay {
  readonly id: string;
  readonly position: ControlPosition;
  readonly height: number;
}

/** Native-only presentation owned by the selected adapter's map. */
export interface NativeMapPresentation {
  readonly gestureLocked: boolean;
  readonly overlayHostName: string;
  readonly nativeLocationFollowing: boolean;
  readonly nativeLayout?: { readonly width: number; readonly height: number };
  /** Placement requested by the mounted attribution control. */
  readonly attributionPosition: ControlPosition | undefined;
  requestGestureLock(locked: boolean): void;
  setNativeLayout(width: number, height: number): void;
  /** Clears the control override with undefined, restoring selected SDK options. */
  setAttributionPosition(position: ControlPosition | undefined): void;
  setOverlay(
    id: string,
    position: ControlPosition | null,
    height?: number
  ): void;
}

export const NativeMapPresentationContext =
  createContext<NativeMapPresentation | null>(null);
export const NativeOverlayContext = createContext<readonly NativeOverlay[]>([]);

/** Effective camera configuration and movement observed from the native wrapper. */
interface NativeCameraState {
  /** Authoritative target when controlled, otherwise the observed camera. */
  readonly viewState: ViewState;
  /** Invalidates scale projection even when the controlled target stays unchanged. */
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
        controlled={props.viewState}
      >
        <Implementation {...(props as Props)} ref={ref} />
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
  const [gestureLocked, requestGestureLock] = useState(false);
  const [nativeLayout, storeNativeLayout] =
    useState<NativeMapPresentation["nativeLayout"]>();
  const [attributionPosition, setAttributionPosition] =
    useState<ControlPosition>();
  const [overlays, setOverlays] = useState<ReadonlyMap<string, NativeOverlay>>(
    () => new Map()
  );
  const [{ setNativeLayout, setOverlay }] = useState(() => ({
    setNativeLayout: (width: number, height: number): void => {
      storeNativeLayout((previous) =>
        previous?.width === width && previous.height === height
          ? previous
          : { width, height }
      );
    },
    setOverlay: (
      id: string,
      position: ControlPosition | null,
      height?: number
    ) => {
      setOverlays((current) => {
        const previous = current.get(id);
        if (position === null && !previous) return current;
        const nextHeight = height ?? previous?.height ?? 0;
        if (previous?.position === position && previous.height === nextHeight)
          return current;
        const next = new Map(current);
        if (position === null) next.delete(id);
        else next.set(id, { id, height: nextHeight, position });
        return next;
      });
    },
  }));
  const presentation = useMemo(
    () => ({
      gestureLocked,
      requestGestureLock,
      overlayHostName,
      nativeLocationFollowing: following,
      nativeLayout,
      attributionPosition,
      setNativeLayout,
      setAttributionPosition,
      setOverlay,
    }),
    [
      gestureLocked,
      overlayHostName,
      following,
      nativeLayout,
      attributionPosition,
      setNativeLayout,
      setAttributionPosition,
      setOverlay,
    ]
  );
  const placement = useMemo(() => [...overlays.values()], [overlays]);
  return (
    <NativeMapPresentationContext.Provider value={presentation}>
      <NativeOverlayContext.Provider value={placement}>
        {children}
      </NativeOverlayContext.Provider>
    </NativeMapPresentationContext.Provider>
  );
};

const NativeCameraProvider = ({
  initial,
  controlled,
  children,
}: {
  readonly initial: ViewState;
  readonly controlled?: ViewState;
  readonly children: ReactNode;
}) => {
  const session = useOptionalMapSession();
  const subscribe = session?.subscribe;
  const [observed, setObserved] = useState(initial);
  useLayoutEffect(
    () =>
      subscribe?.("move", (event) => {
        if ("viewState" in event) setObserved(event.viewState);
      }),
    [subscribe]
  );
  const camera = useMemo(
    () => ({ viewState: controlled ?? observed, observedViewState: observed }),
    [controlled, observed]
  );
  return (
    <NativeCameraContext.Provider value={camera}>
      {children}
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
