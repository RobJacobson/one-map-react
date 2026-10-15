import { type Adapter, MapSetup } from "one-map-react";
import { useCallback, useEffect, useRef } from "react";
import { Platform, View } from "react-native";

import { Tf09Scene, type Tf09Probe } from "./tf09-scene.js";

/** Native runner transport; does not start until this acceptance screen mounts. */
export const NativeTf09Screen = ({
  adapter,
}: {
  readonly adapter: Adapter;
}) => {
  const probe = useRef<Tf09Probe | null>(null);
  const attach = useCallback((value: Tf09Probe | null) => {
    probe.current = value;
  }, []);
  useEffect(() => {
    let active = true;
    let busy = false;
    let previous = "";
    const poll = async (): Promise<void> => {
      if (!active || busy) return;
      busy = true;
      try {
        const command = (await fetch("http://127.0.0.1:8798/command").then(
          (response) => response.json()
        )) as {
          id?: string;
          environment: string;
          action: string;
          value?: Record<string, unknown>;
        };
        if (
          !active ||
          !command.id ||
          command.id === previous ||
          !probe.current ||
          command.environment !==
            `${adapter.backend.replace("-native", "")}-${Platform.OS}`
        )
          return;
        previous = command.id;
        let result: unknown;
        let error: string | undefined;
        try {
          result = await probe.current.command(command.action, command.value);
        } catch (failure) {
          error = String(failure);
        }
        if (active)
          await fetch("http://127.0.0.1:8798/result", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: command.id, result, error }),
          });
      } catch {
        /* Runner may start after the application. */
      } finally {
        busy = false;
      }
    };
    const timer = setInterval(() => {
      void poll();
    }, 400);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [adapter.backend]);
  return (
    <View style={{ flex: 1 }}>
      <MapSetup adapter={adapter}>
        <Tf09Scene
          backend={adapter.backend}
          attach={attach}
          style={{ flex: 1 }}
        />
      </MapSetup>
    </View>
  );
};
