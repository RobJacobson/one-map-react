import { useEffect, useRef } from "react";

import type { Backend } from "../../contracts/adapter.js";
import type { ImageEntry, ImagesProps } from "../../contracts/images-types.js";
import type { WebWrapper } from "./contracts.js";

interface ImageRegistration {
  readonly url: string;
  readonly sdf?: boolean;
}

const imageRegistration = (entry: ImageEntry): ImageRegistration =>
  typeof entry === "string"
    ? { url: entry }
    : {
        url: entry.url,
        ...(entry.sdf === undefined ? {} : { sdf: entry.sdf }),
      };

const registrationEquals = (
  left: ImageRegistration | undefined,
  right: ImageRegistration
): boolean =>
  left !== undefined && left.url === right.url && left.sdf === right.sdf;

/**
 * Builds a web Images component that registers style images on the enclosing
 * react-map-gl map.
 *
 * @param wrapper - Selected react-map-gl entry components.
 * @returns An Images component for the web adapter record.
 */
export const createWebImages = <
  Name extends Extract<Backend, "mapbox-web" | "maplibre-web">,
>(
  wrapper: WebWrapper<Name>
) => {
  const WebImages = ({ images }: ImagesProps) => {
    const map = wrapper.useMap().current?.getMap();
    const imagesRef = useRef(images);
    const syncRef = useRef<(next: ImagesProps["images"]) => void>(() => {});

    // Map identity owns the registration session. Image contents sync through
    // the ref so a new `images` object with the same entries does not remove
    // and reload every icon.
    useEffect(() => {
      if (!map) {
        return;
      }

      let released = false;
      let waitingForStyle = false;
      let revision = 0;
      const owned = new Map<string, ImageRegistration>();
      const inFlight = new Map<string, ImageRegistration>();
      const pendingRemovals = new Set<string>();

      const reportFailure = (): void => {
        if (!released)
          map.fire("error", {
            error: new Error("Style image registration failed."),
          });
      };

      // Wait for style completion before starting registration. Image removal
      // remains available during loading on both pinned renderers; an absent
      // or destroyed style is guarded at each image-method call.
      const styleReady = (): boolean => {
        try {
          return map.isStyleLoaded() === true;
        } catch {
          return false;
        }
      };

      const readSpriteKey = (): string | undefined => {
        try {
          return JSON.stringify(map.getSprite?.());
        } catch {
          return undefined;
        }
      };
      let spriteKey = readSpriteKey();

      const register = (name: string, fields: ImageRegistration): void => {
        if (released || inFlight.has(name) || !styleReady()) {
          return;
        }

        let present = false;

        try {
          present = map.hasImage(name);
        } catch {
          return;
        }

        if (present && registrationEquals(owned.get(name), fields)) {
          return;
        }

        // Image methods emit synchronous style events that can replace this request.
        inFlight.set(name, fields);
        if (present) {
          owned.delete(name);
          try {
            map.removeImage(name);
          } catch {
            if (inFlight.get(name) === fields) inFlight.delete(name);
            return;
          }
        }

        if (released || inFlight.get(name) !== fields) return;

        void wrapper.loadWebImage(map, fields.url).then(
          (data) => {
            if (inFlight.get(name) !== fields) {
              return;
            }

            inFlight.delete(name);

            if (released) return;
            if (data == null) {
              reportFailure();
              return;
            }
            if (!styleReady()) {
              waitingForStyle = true;
              return;
            }

            const registrationRevision = revision;
            try {
              if (map.hasImage(name)) {
                return;
              }

              // Cleanup must own the image before addImage can call application code.
              owned.set(name, fields);
              map.addImage(
                name,
                data,
                fields.sdf === undefined ? {} : { sdf: fields.sdf }
              );
            } catch {
              if (released || revision !== registrationRevision) return;
              if (owned.get(name) === fields) {
                removeName(name);
              }
              if (revision === registrationRevision) reportFailure();
            }
          },
          () => {
            if (inFlight.get(name) !== fields) {
              return;
            }

            inFlight.delete(name);
            reportFailure();
          }
        );
      };

      const removeName = (name: string): void => {
        inFlight.delete(name);
        owned.delete(name);
        pendingRemovals.add(name);

        try {
          if (map.hasImage(name)) {
            map.removeImage(name);
          }
          pendingRemovals.delete(name);
        } catch {
          // The style no longer exposes the image.
        }
      };

      const sync = (next: ImagesProps["images"]): void => {
        if (released) return;
        const currentRevision = ++revision;
        const isCurrent = (): boolean =>
          !released && revision === currentRevision;
        const nextNames = new Set(Object.keys(next));

        for (const name of new Set([
          ...owned.keys(),
          ...inFlight.keys(),
          ...pendingRemovals,
        ])) {
          if (!isCurrent()) return;
          if (!nextNames.has(name)) {
            removeName(name);
          }
        }

        // Cancel replaced loads even when renderer image methods are unavailable.
        for (const [name, entry] of Object.entries(next)) {
          if (!isCurrent()) return;
          const current = owned.get(name) ?? inFlight.get(name);
          if (
            current &&
            !registrationEquals(current, imageRegistration(entry))
          ) {
            removeName(name);
          }
        }

        if (!isCurrent()) return;
        if (!styleReady()) {
          waitingForStyle = true;
          return;
        }
        waitingForStyle = false;
        for (const name of pendingRemovals) {
          if (!isCurrent()) return;
          removeName(name);
        }

        for (const [name, entry] of Object.entries(next)) {
          if (!isCurrent()) return;
          const fields = imageRegistration(entry);
          const current = owned.get(name) ?? inFlight.get(name);
          let present = false;

          try {
            present = map.hasImage(name);
          } catch {
            continue;
          }

          if (registrationEquals(current, fields) && present) {
            continue;
          }

          if (current !== undefined && !registrationEquals(current, fields)) {
            removeName(name);
          }

          if (isCurrent()) register(name, fields);
        }
      };

      syncRef.current = sync;
      sync(imagesRef.current);

      // Ordinary styledata restores only images this session added that the style
      // dropped. Failed loads and addImage failures are not owned, so tile
      // activity does not retry them. Deferred registration resumes once tiles
      // are ready, even when style.load preceded them; see web-followup-regressions.tsx.
      const restoreOwned = (): void => {
        if (readSpriteKey() !== spriteKey) {
          restoreAll();
          return;
        }
        if (released) return;
        if (!styleReady()) {
          return;
        }
        if (waitingForStyle) {
          sync(imagesRef.current);
          return;
        }

        // eslint-disable-next-line unicorn/no-useless-spread -- Image callbacks can replace entries during restoration.
        for (const [name, fields] of [...owned]) {
          if (owned.get(name) !== fields || inFlight.has(name)) {
            continue;
          }

          try {
            if (!map.hasImage(name)) {
              register(name, fields);
            }
          } catch {
            // The next style.load retries.
          }
        }
      };

      const restoreAll = (): void => {
        // A replacement style can contain a different sprite under the same name.
        owned.clear();
        inFlight.clear();
        spriteKey = readSpriteKey();
        if (released) {
          pendingRemovals.clear();
          return;
        }
        sync(imagesRef.current);
      };

      map.on("styledata", restoreOwned);
      map.on("style.load", restoreAll);
      map.on("load", restoreOwned);
      map.on("idle", restoreOwned);

      return () => {
        released = true;
        inFlight.clear();
        syncRef.current = () => {};

        for (const name of new Set([...owned.keys(), ...pendingRemovals])) {
          if (!owned.has(name) && !pendingRemovals.has(name)) continue;
          owned.delete(name);
          pendingRemovals.delete(name);
          try {
            if (map.hasImage(name)) {
              map.removeImage(name);
            }
          } catch {
            // An absent or destroyed style must not prevent other removals.
          }
        }

        // Removal callbacks can replace the style; keep ownership invalidation until cleanup ends.
        map.off("styledata", restoreOwned);
        map.off("style.load", restoreAll);
        map.off("load", restoreOwned);
        map.off("idle", restoreOwned);
        owned.clear();
        pendingRemovals.clear();
      };
    }, [map]);

    useEffect(() => {
      imagesRef.current = images;
      syncRef.current(images);
    }, [images]);

    return null;
  };

  return WebImages;
};
