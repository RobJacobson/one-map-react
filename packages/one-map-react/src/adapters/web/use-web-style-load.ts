import { useLayoutEffect } from "react";

import type { StyleLoadTarget } from "./contracts.js";

/** Owns style-completion subscriptions for one logical map and style content. */
export const useWebStyleLoad = (
  styleMap: StyleLoadTarget | null,
  styleKey: string,
  onStyleLoad: () => void
): void => {
  // style.load is style completion. react-map-gl onStyleData is activity
  // and is not this callback. A fresh map can finish style.load before
  // this commit, while isStyleLoaded() is still false; the map load that
  // follows then reports once. reuse() can fire that load before this
  // listener exists and still leave isStyleLoaded() false, so the next
  // idle reports once when the style is loaded. A later mapStyle
  // input change re-runs this effect so a no-op SDK diff without
  // style.load still reports once the current style is loaded. The listener
  // is facade-owned, so logical unmount removes
  // it even when reuseMaps keeps the renderer.
  useLayoutEffect(() => {
    if (!styleMap) {
      return;
    }

    let sawStyleLoad = false;
    const onStyleLoadEvent = () => {
      sawStyleLoad = true;
      onStyleLoad();
    };
    const reportMissedStyleLoad = () => {
      if (sawStyleLoad || !styleMap.isStyleLoaded()) {
        return;
      }

      sawStyleLoad = true;
      onStyleLoad();
    };

    styleMap.on("style.load", onStyleLoadEvent);

    if (styleMap.isStyleLoaded()) {
      sawStyleLoad = true;
      onStyleLoad();
    } else {
      styleMap.on("load", reportMissedStyleLoad);
      styleMap.on("idle", reportMissedStyleLoad);
    }

    return () => {
      styleMap.off("style.load", onStyleLoadEvent);
      styleMap.off("load", reportMissedStyleLoad);
      styleMap.off("idle", reportMissedStyleLoad);
    };
  }, [styleMap, styleKey, onStyleLoad]);
};
