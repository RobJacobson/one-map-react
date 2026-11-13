interface CameraDispatch {
  readonly sequence: number;
  readonly phase: "dispatch" | "acknowledged" | "rejected";
  readonly id: number;
  readonly center: unknown;
  readonly pending: readonly number[];
}

/** Test-only SDK camera observations; the installed package remains unchanged. */
export const cameraDispatchObservation = {
  events: [] as CameraDispatch[],
  pending: new Set<number>(),
  nextId: 0,
};

/**
 * Observes the real wrapper camera ref without changing its arguments or return value.
 * @param camera - Selected wrapper's memo or forwardRef Camera component.
 * @param method - The wrapper method used by the frozen adapter's jumpTo.
 * @returns Cleanup that restores the selected wrapper and retires late observations.
 */
export const observeCameraDispatch = (
  camera: object,
  method: string
): (() => void) => {
  let active = true;
  const implementation: unknown = Reflect.get(camera, "type") ?? camera;
  const observeRef =
    (ref: unknown) =>
    (instance: object | null): void => {
      const observed =
        instance &&
        new Proxy(instance, {
          get: (target, key) => {
            const value = Reflect.get(target, key);
            if (key !== method || typeof value !== "function") return value;
            return (options: Record<string, unknown>) => {
              if (!active) return Reflect.apply(value, target, [options]);
              const state = cameraDispatchObservation;
              const id = ++state.nextId;
              const center = options.centerCoordinate ?? options.center;
              const record = (phase: CameraDispatch["phase"]): void => {
                if (!active) return;
                state.events.push({
                  sequence: state.events.length + 1,
                  phase,
                  id,
                  center,
                  pending: [...state.pending],
                });
              };
              record("dispatch");
              state.pending.add(id);
              try {
                const result: unknown = Reflect.apply(value, target, [options]);
                void Promise.resolve(result).then(
                  () => {
                    record("acknowledged");
                    state.pending.delete(id);
                  },
                  () => {
                    record("rejected");
                    state.pending.delete(id);
                  }
                );
                return result;
              } catch (error) {
                record("rejected");
                state.pending.delete(id);
                throw error;
              }
            };
          },
        });
      if (typeof ref === "function") ref(observed);
      else if (ref && typeof ref === "object")
        Reflect.set(ref, "current", observed);
    };
  if (
    typeof implementation === "function" &&
    Reflect.get(camera, "type") === implementation
  ) {
    // MapLibre accepts the ref as a React 19 prop; RNMapbox uses forwardRef.
    Reflect.set(camera, "type", (props: Record<string, unknown>) =>
      implementation({ ...props, ref: observeRef(props.ref) })
    );
    return () => {
      if (!active) return;
      active = false;
      Reflect.set(camera, "type", implementation);
    };
  }
  const original: unknown =
    implementation && typeof implementation === "object"
      ? Reflect.get(implementation, "render")
      : undefined;
  if (typeof original !== "function")
    throw new Error(
      "Expected the selected wrapper's memo or forwardRef Camera."
    );
  Reflect.set(
    implementation as object,
    "render",
    (props: unknown, ref: unknown) => original(props, observeRef(ref))
  );
  return () => {
    if (!active) return;
    active = false;
    Reflect.set(implementation as object, "render", original);
  };
};

/**
 * Installs observations only for the selected advanced native scenario.
 * @param scenario - Scenario about to mount.
 * @param engine - Its selected engine.
 * @param cameras - The actual installed wrapper camera components.
 * @returns Cleanup to call before replacing the scenario.
 */
export const observeAcceptanceCamera = (
  scenario: string,
  engine: "mapbox" | "maplibre",
  cameras: Readonly<Partial<Record<"mapbox" | "maplibre", object>>>
): (() => void) => {
  if (scenario !== "tf09") return () => {};
  const camera = cameras[engine];
  if (!camera) throw new Error("Selected acceptance camera is not attached.");
  cameraDispatchObservation.events = [];
  cameraDispatchObservation.pending.clear();
  return observeCameraDispatch(
    camera,
    engine === "mapbox" ? "setCamera" : "jumpTo"
  );
};
