import { type Adapter, MapSetup } from "one-map-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform, SafeAreaView, Text, View } from "react-native";

import {
  type Tf08AcceptanceProbe,
  Tf08AcceptanceScene,
} from "./tf08-acceptance-scene.js";

/** Native TF08 shell; the runner sends application actions over local HTTP. */
export const NativeTf08Screen = ({
  adapter,
  getLocationDiagnostic,
}: {
  readonly adapter: Adapter;
  readonly getLocationDiagnostic?: () => Promise<unknown>;
}) => {
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
      if (busy || !active || !probe.current) return;
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
          !request.id ||
          request.id === last ||
          request.environment !== environment
        )
          return;
        last = request.id;
        setStatus(`TF08 ${request.action}`);
        let result: unknown;
        try {
          result = {
            id: request.id,
            environment,
            ok: true,
            value: await probe.current.command(request.action, request.value),
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
  }, [adapter.backend, getLocationDiagnostic]);
  return (
    <MapSetup adapter={adapter}>
      <SafeAreaView style={{ flex: 1 }}>
        <Text testID="tf08-status">{status}</Text>
        <Tf08AcceptanceScene
          backend={adapter.backend}
          services={adapter.services}
          style={{ flex: 1 }}
          attach={attach}
          fixtureUrl="http://127.0.0.1:8798"
          overlay={
            <View
              style={{ width: 40, height: 40, backgroundColor: "#00ff00" }}
            />
          }
        />
      </SafeAreaView>
    </MapSetup>
  );
};
