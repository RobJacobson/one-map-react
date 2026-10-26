import { type Adapter, MapSetup } from "one-map-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AppState,
  Dimensions,
  PixelRatio,
  Platform,
  SafeAreaView,
  Text,
  View,
} from "react-native";

import {
  type Tf08AcceptanceProbe,
  Tf08AcceptanceScene,
} from "./tf08-acceptance-scene.js";

/** Explicit application test commands; no portable offline service is exposed. */
export interface Tf08OfflineCommands {
  /** Performs an explicitly requested test action with raw selected SDK output. */
  readonly command: (
    action: string,
    value?: Record<string, unknown>
  ) => Promise<unknown>;
  /** Releases only this screen's observer, including pending setup. */
  readonly dispose: () => void;
}

/** Native TF08 shell; the runner sends application actions over local HTTP. */
export const NativeTf08Screen = ({
  adapter,
  getLocationDiagnostic,
  setNetworkConnected,
  offlineOperations,
  createOfflineCommands,
  createSnapshot,
  startDetached = false,
  nativePuck,
}: {
  readonly adapter: Adapter;
  readonly getLocationDiagnostic?: () => Promise<unknown>;
  readonly setNetworkConnected?: (connected: boolean) => Promise<boolean>;
  readonly offlineOperations?: Readonly<
    Record<string, (value: Record<string, unknown>) => unknown>
  >;
  readonly createOfflineCommands?: () => Tf08OfflineCommands;
  readonly createSnapshot?: (
    value: Record<string, unknown>
  ) => Promise<{ uri: string }>;
  readonly startDetached?: boolean;
  readonly nativePuck?: ReactNode;
}) => {
  const offlineCommands = useRef<Tf08OfflineCommands | undefined>(undefined);
  useEffect(() => {
    const commands = createOfflineCommands?.();
    offlineCommands.current = commands;
    return () => {
      offlineCommands.current = undefined;
      commands?.dispose();
    };
  }, [createOfflineCommands]);

  const [sceneMounted, setSceneMounted] = useState(!startDetached);
  const probe = useRef<Tf08AcceptanceProbe | null>(null);
  const [status, setStatus] = useState("TF08 awaiting runner");
  const attach = useCallback((value: Tf08AcceptanceProbe | null) => {
    probe.current = value;
  }, []);
  useEffect(() => {
    let active = true;
    let busy = false;
    let last = "";
    const poll = async (): Promise<void> => {
      if (busy || !active) return;
      busy = true;
      try {
        const request = (await fetch("http://127.0.0.1:8798/command").then(
          (response) => response.json()
        )) as {
          id?: string;
          environment?: string;
          action: string;
          value?: Record<string, unknown>;
        };
        const environment = `${adapter.backend.replace("-native", "")}-${Platform.OS}`;
        if (
          !active ||
          !request.id ||
          request.id === last ||
          request.environment !== environment
        )
          return;
        last = request.id;
        setStatus(`TF08 ${request.action}`);
        let result: unknown;
        try {
          if (!probe.current && request.action === "configure")
            setSceneMounted(true);
          if (
            !probe.current &&
            !request.action.startsWith("offline-") &&
            !["configure", "device-info", "named-offline", "network"].includes(
              request.action
            )
          )
            throw new Error("Acceptance map has not mounted.");
          result = {
            id: request.id,
            environment,
            ok: true,
            value:
              request.action === "snapshot" && createSnapshot
                ? await createSnapshot(request.value ?? {})
                : request.action.startsWith("offline-") &&
                    offlineCommands.current
                  ? await offlineCommands.current.command(
                      request.action,
                      request.value
                    )
                  : request.action === "device-info"
                    ? {
                        scale: PixelRatio.get(),
                        window: Dimensions.get("window"),
                      }
                    : request.action === "named-offline"
                      ? await runOfflineOperation(
                          offlineOperations,
                          String(request.value?.operation),
                          request.value ?? {}
                        )
                      : request.action === "network" && setNetworkConnected
                        ? await setNetworkConnected(
                            request.value?.connected === true
                          )
                        : !probe.current && request.action === "configure"
                          ? null
                          : await probe.current?.command(
                              request.action,
                              request.value
                            ),
          };
        } catch (error) {
          result = {
            id: request.id,
            environment,
            ok: false,
            error: error instanceof Error ? error.name : "OperationError",
            diagnostic:
              request.action === "position"
                ? {
                    appState: AppState.currentState,
                    nativeCachedPosition: await getLocationDiagnostic?.().catch(
                      () => undefined
                    ),
                  }
                : undefined,
            message:
              error instanceof Error
                ? error.message
                    .replace(/\b(?:pk|sk)\.[A-Za-z0-9._-]+/g, "[redacted]")
                    .replace(
                      /([?&](?:access_token|sku|key)=)[^&\s]+/gi,
                      "$1[redacted]"
                    )
                    .slice(0, 500)
                : "Operation failed.",
          };
        }
        if (active)
          await fetch("http://127.0.0.1:8798/result", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(result),
          });
      } catch {
        if (active) setStatus("TF08 awaiting runner transport");
      } finally {
        busy = false;
      }
    };
    const timer = setInterval(() => {
      void poll();
    }, 200);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [
    adapter.backend,
    getLocationDiagnostic,
    setNetworkConnected,
    offlineOperations,
    createSnapshot,
  ]);
  return (
    <MapSetup adapter={adapter}>
      <SafeAreaView style={{ flex: 1 }}>
        <Text testID="tf08-status">{status}</Text>
        {sceneMounted && (
          <Tf08AcceptanceScene
            backend={adapter.backend}
            services={adapter.services}
            style={{ flex: 1 }}
            attach={attach}
            fixtureUrl="http://127.0.0.1:8798"
            nativePuck={nativePuck}
            overlay={
              <View
                style={{ width: 40, height: 40, backgroundColor: "#00ff00" }}
              />
            }
          />
        )}
      </SafeAreaView>
    </MapSetup>
  );
};

const runOfflineOperation = async (
  operations:
    | Readonly<Record<string, (value: Record<string, unknown>) => unknown>>
    | undefined,
  operation: string,
  input: Record<string, unknown>
): Promise<unknown> => {
  if (!operations || !Object.hasOwn(operations, operation))
    throw new Error("Unknown named offline operation.");
  const warnings: string[] = [];
  const warn = console.warn;
  console.warn = (...values: unknown[]) =>
    warnings.push(values.map(String).join(" "));
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const value = await Promise.race([
      Promise.resolve().then(() => operations[operation](input)),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error("Named offline operation timed out.")),
          10000
        );
      }),
    ]);
    return { value: value ?? null, warnings };
  } finally {
    clearTimeout(timer);
    console.warn = warn;
  }
};
