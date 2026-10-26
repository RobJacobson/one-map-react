import { useEffect } from "react";

import type { Backend } from "../../contracts/adapter.js";
import type { ImagesProps } from "../../contracts/images-types.js";
import type { WebImageMap, WebWrapper } from "./contracts.js";

interface WebImageProps {
  readonly map: WebImageMap | undefined;
  readonly name: string;
  readonly url: string;
  readonly sdf: boolean | undefined;
}

/**
 * Builds a web Images polyfill with independent entry effects.
 *
 * @param wrapper - Selected react-map-gl entry and image loader.
 * @returns Images for a style whose replacement the application owns.
 */
export const createWebImages = <
  Name extends Extract<Backend, "mapbox-web" | "maplibre-web">,
>(
  wrapper: WebWrapper<Name>
) => {
  const WebImages = ({ images }: ImagesProps) => {
    const map = wrapper.useMap().current?.getMap();

    return (
      <>
        {Object.entries(images).map(([name, entry]) => (
          <WebImage
            key={name}
            map={map}
            name={name}
            url={typeof entry === "string" ? entry : entry.url}
            sdf={typeof entry === "string" ? undefined : entry.sdf}
          />
        ))}
      </>
    );
  };

  const WebImage = ({ map, name, url, sdf }: WebImageProps) => {
    useEffect(() => {
      if (!map) return;

      let released = false;
      let started = false;
      let installed = false;
      let adding = false;
      const reportFailure = (cleanup = false): void => {
        if (!released || cleanup)
          map.fire("error", {
            error: new Error("Style image registration failed."),
          });
      };
      const remove = (): void => {
        if (!installed) return;
        installed = false;
        try {
          if (!map.hasImage(name)) return;
        } catch {
          // An absent or destroyed style cannot expose the owned registration.
          return;
        }
        try {
          map.removeImage(name);
        } catch {
          reportFailure(true);
        }
      };
      const stopWaiting = (): void => {
        map.off("styledata", start);
        map.off("style.load", start);
        map.off("load", start);
        map.off("idle", start);
      };
      const options = sdf === undefined ? {} : { sdf };
      const load = async (): Promise<void> => {
        try {
          const data = await wrapper.loadWebImage(map, url);
          if (released) return;
          if (data == null) {
            reportFailure();
            return;
          }
          if (map.hasImage(name)) {
            reportFailure();
            return;
          }
          if (released) return;

          // SDKs install before styledata; see the reentrant SourcesMap case in
          // test/web-followup-regressions.tsx for cleanup during addImage.
          adding = true;
          let failed = false;
          try {
            map.addImage(name, data, options);
          } catch {
            failed = true;
          }
          adding = false;
          if (released) return;

          try {
            installed = map.hasImage(name);
          } catch {
            failed = true;
          }
          if (failed) remove();
          if (failed) reportFailure();
          else if (!installed) reportFailure();
        } catch {
          reportFailure();
        }
      };
      const start = (): void => {
        if (released || started) return;
        try {
          if (map.isStyleLoaded() !== true) return;
        } catch {
          return;
        }
        started = true;
        stopWaiting();
        void load();
      };

      map.on("styledata", start);
      map.on("style.load", start);
      map.on("load", start);
      map.on("idle", start);
      start();

      return () => {
        released = true;
        stopWaiting();
        if (adding) {
          try {
            installed = map.hasImage(name);
          } catch {
            // A failed add may release the entry before any image exists.
          }
        }
        remove();
      };
    }, [map, name, url, sdf]);

    return null;
  };

  return WebImages;
};
