import { act, render, waitFor } from "@testing-library/react";
import { createRef, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { beforeEach, describe, expect, vi, test } from "vite-plus/test";

import {
  emptyStyle,
  initialViewState,
  routes,
} from "../../../tests/fixtures/map-fixture.js";
import type { Adapter } from "../src/contracts/adapter.js";
import type { MapRef } from "../src/contracts/camera-types.js";
import type { ClickEvent } from "../src/contracts/event-types.js";
import type { MapProps } from "../src/contracts/map-types.js";
import { Images } from "../src/facade/images.js";
import { Layer } from "../src/facade/layer.js";
import { MapSetup } from "../src/facade/map-setup.js";
import { Map as OneMap } from "../src/facade/map.js";
import { Source } from "../src/facade/source.js";
import {
  type createWebMapMock,
  webHandlerNames,
} from "./create-web-map-mock.js";
import { sdkFeaturesetQuery, sdkOrderedQuery } from "./sdk-rendered-query.js";

/**
 * Registers the same follow-up regression scenarios for each web adapter.
 *
 * @param adapter - Selected web adapter with the pinned loader convention.
 * @param mock - That entry's wrapper mock, including renderer events and handlers.
 */
export const runWebFollowupRegressions = (
  adapter: Adapter,
  mock: ReturnType<typeof createWebMapMock>
): void => {
  const scene = (
    props: Partial<MapProps> = {},
    children?: ReactNode,
    ref = createRef<MapRef>()
  ) => (
    <MapSetup adapter={adapter}>
      <OneMap
        ref={ref}
        mapStyle={emptyStyle}
        initialViewState={initialViewState}
        {...props}
      >
        <Source id="routes" type="geojson" data={routes}>
          <Layer id="route-line" type="line" />
        </Source>
        {children}
      </OneMap>
    </MapSetup>
  );
  const target = () => {
    const renderer = mock.getStyleTarget();
    if (!renderer) throw new Error("Missing mock renderer.");
    return renderer;
  };
  const hit: ClickEvent = { lngLat: [1, 2], point: [3, 4] };
  const dispatchClick = (): void => {
    const props = mock.Map.mock.calls.at(-1)?.[0] as unknown as {
      onClick: (event: ClickEvent) => void;
    };
    props.onClick(hit);
  };
  const click = async (): Promise<void> => {
    await act(async () => dispatchClick());
  };

  describe("follow-up query, image, and interaction corrections", () => {
    beforeEach(() => mock.resetWebMapMock());

    test("pending filtered click uses the latest committed callback after an ordinary update", async () => {
      const original = vi.fn();
      const updated = vi.fn();
      const ref = createRef<MapRef>();
      const features = [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [1, 2] },
          source: "routes",
          layer: { id: "route-line" },
        },
      ];
      const view = render(
        scene(
          { interactiveLayerIds: ["route-line"], onClick: original },
          undefined,
          ref
        )
      );
      mock.queryRenderedFeatures.mockReturnValueOnce(features);
      await act(async () => {
        dispatchClick();
        flushSync(() =>
          view.rerender(
            scene(
              { interactiveLayerIds: ["route-line"], onClick: updated },
              undefined,
              ref
            )
          )
        );
      });
      expect(original).not.toHaveBeenCalled();
      expect(updated).toHaveBeenCalledExactlyOnceWith({ ...hit, features });
    });

    test("map clicks preserve SDK ordering when excluded 3D hits overlap 2D hits", async () => {
      const mapClick = vi.fn();
      if (
        adapter.backend !== "mapbox-web" &&
        adapter.backend !== "maplibre-web"
      )
        throw new Error("Expected web adapter.");
      mock.queryRenderedFeatures.mockImplementation(
        sdkOrderedQuery(adapter.backend)
      );
      render(
        scene(
          {
            interactiveLayerIds: ["route-line", "places-line"],
            onClick: mapClick,
          },
          <Source id="places" type="geojson" data={routes}>
            <Layer id="places-line" type="line" />
          </Source>
        )
      );
      await click();
      expect(
        mapClick.mock.calls[0]?.[0].features.map(
          (feature: { id: string }) => feature.id
        )
      ).toEqual(["places-line", "route-line"]);
      expect(mock.queryRenderedFeatures).toHaveBeenCalledTimes(1);
    });

    if (adapter.backend === "mapbox-web") {
      test("Mapbox filtered map clicks exclude root featureset variants", async () => {
        const mapClick = vi.fn();
        mock.queryRenderedFeatures.mockImplementation(sdkFeaturesetQuery());
        render(
          scene(
            { interactiveLayerIds: ["places-line"], onClick: mapClick },
            <Source id="places" type="geojson" data={routes}>
              <Layer id="places-line" type="line" />
            </Source>
          )
        );
        await click();
        expect(
          mapClick.mock.calls[0]?.[0].features.map(
            (feature: { id: string }) => feature.id
          )
        ).toEqual(["plain"]);
      });
    }

    test.each([{ layers: ["route-line"] }, { layers: [] }])(
      "filtered map query preserves results for layers $layers",
      async ({ layers }) => {
        const onClick = vi.fn();
        const feature = {
          type: "Feature",
          id: 1,
          source: "routes",
          layer: { id: "route-line" },
          properties: {},
        };
        const features = layers.length ? [feature, feature] : [];
        mock.queryRenderedFeatures.mockReturnValueOnce(features);
        render(scene({ interactiveLayerIds: layers, onClick }));
        await click();
        expect(mock.queryRenderedFeatures).toHaveBeenCalledExactlyOnceWith(
          hit.point,
          { layers }
        );
        expect(onClick).toHaveBeenCalledWith({ ...hit, features });
      }
    );

    test("missing map layers report failure without delivering a click", async () => {
      const onClick = vi.fn();
      const onError = vi.fn();
      render(
        scene({
          interactiveLayerIds: ["route-line", "missing"],
          onClick,
          onError,
        })
      );
      await click();
      expect(mock.queryRenderedFeatures).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith({
        error: expect.objectContaining({
          message: 'Layer "missing" is not present in the loaded style.',
        }),
      });
      expect(onClick).not.toHaveBeenCalled();
      expect(target().listenerCount("error")).toBe(1);
    });

    test.each(["emitted", "thrown"])(
      "%s map query failure suppresses click delivery",
      async (kind) => {
        const onClick = vi.fn();
        const onError = vi.fn();
        const error = new Error("click query failed");
        render(
          scene({ interactiveLayerIds: ["route-line"], onClick, onError })
        );
        mock.queryRenderedFeatures.mockImplementationOnce(() => {
          if (kind === "thrown") throw error;
          target().emitError(error);
          return [];
        });
        await click();
        expect(onError).toHaveBeenCalledWith({ error });
        expect(onClick).not.toHaveBeenCalled();
        expect(target().listenerCount("error")).toBe(1);
      }
    );

    test("pending map query completion ignores unmount", async () => {
      const onClick = vi.fn();
      mock.queryRenderedFeatures.mockReturnValueOnce([]);
      const view = render(
        scene({ interactiveLayerIds: ["route-line"], onClick })
      );
      await act(async () => {
        dispatchClick();
        flushSync(() => view.unmount());
      });
      expect(onClick).not.toHaveBeenCalled();
    });

    test("onLoad camera operations wait for the wrapper handle attachment", async () => {
      mock.loadBeforeAttachment();
      const ref = createRef<MapRef>();
      const failed = vi.fn();
      const loaded = vi.fn(() => {
        void ref.current?.jumpTo({ zoom: 12 }).catch(failed);
      });
      render(scene({ onLoad: loaded }, undefined, ref));
      await waitFor(() => expect(mock.jumpTo).toHaveBeenCalledTimes(1));
      expect(loaded).toHaveBeenCalledTimes(1);
      expect(failed).not.toHaveBeenCalled();
    });

    test("equivalent style objects preserve the completion callback and listener", () => {
      const loaded = vi.fn();
      const sceneProps = { mapStyle: { ...emptyStyle }, onStyleLoad: loaded };
      const view = render(scene(sceneProps));
      const renderer = target();
      act(() => renderer.emitStyleLoad());
      expect(loaded).toHaveBeenCalledTimes(1);
      view.rerender(
        scene({
          ...sceneProps,
          mapStyle: {
            layers: [...emptyStyle.layers],
            sources: { ...emptyStyle.sources },
            version: 8,
          },
        })
      );
      expect(loaded).toHaveBeenCalledTimes(1);
      expect(renderer.listenerCount("style.load")).toBe(1);
      act(() => renderer.emitStyleLoad());
      expect(loaded).toHaveBeenCalledTimes(2);
      view.unmount();
      expect(renderer.listenerCount("style.load")).toBe(0);
    });

    test.each(["absent", "raster", "raster-dem", "image"])(
      "source query rejects %s before dispatch",
      async (type) => {
        const ref = createRef<MapRef>();
        render(scene({}, undefined, ref));
        if (type !== "absent") mock.registerMockSource("invalid", { type });
        await expect(
          ref.current?.querySourceFeatures("invalid")
        ).rejects.toThrow();
        expect(mock.querySourceFeatures).not.toHaveBeenCalled();
        expect(target().listenerCount("error")).toBe(1);
      }
    );

    test.each([undefined, "", "  "])(
      "vector query rejects sourceLayer %s",
      async (sourceLayer) => {
        const ref = createRef<MapRef>();
        render(scene({}, undefined, ref));
        mock.registerMockSource("tiles", { type: "vector" });
        await expect(
          ref.current?.querySourceFeatures("tiles", { sourceLayer })
        ).rejects.toThrow("nonempty sourceLayer");
        expect(mock.querySourceFeatures).not.toHaveBeenCalled();
        await ref.current?.querySourceFeatures("tiles", {
          sourceLayer: "roads",
        });
        expect(mock.querySourceFeatures).toHaveBeenCalledWith("tiles", {
          sourceLayer: "roads",
        });
      }
    );

    test("rendered query rejects any missing requested layer before dispatch", async () => {
      const ref = createRef<MapRef>();
      render(scene({}, undefined, ref));
      await expect(
        ref.current?.queryRenderedFeatures(undefined, {
          layers: ["route-line", "missing"],
        })
      ).rejects.toThrow('Layer "missing"');
      expect(mock.queryRenderedFeatures).not.toHaveBeenCalled();
      expect(target().listenerCount("error")).toBe(1);
    });

    test("valid source and rendered queries preserve successful emptiness and layer options", async () => {
      const ref = createRef<MapRef>();
      render(scene({}, undefined, ref));
      mock.querySourceFeatures.mockReturnValueOnce([]);
      await expect(ref.current?.querySourceFeatures("routes")).resolves.toEqual(
        []
      );
      for (const layers of [undefined, [], ["route-line"]]) {
        mock.queryRenderedFeatures.mockReturnValueOnce([]);
        await expect(
          ref.current?.queryRenderedFeatures(undefined, { layers })
        ).resolves.toEqual([]);
        expect(mock.queryRenderedFeatures).toHaveBeenLastCalledWith(
          undefined,
          layers === undefined ? {} : { layers }
        );
      }
      expect(target().listenerCount("error")).toBe(1);
    });

    test.each(["rendered", "source"] as const)(
      "%s query rejects emitted errors and keeps the map callback",
      async (kind) => {
        const onError = vi.fn();
        const ref = createRef<MapRef>();
        render(scene({ onError }, undefined, ref));
        const renderer = target();
        const error = new Error("query failed");
        const second = new Error("second report");
        const query =
          kind === "rendered"
            ? mock.queryRenderedFeatures
            : mock.querySourceFeatures;
        query.mockImplementationOnce(() => {
          renderer.emitError(error);
          renderer.emitError(second);
          return [];
        });
        const pending =
          kind === "rendered"
            ? ref.current?.queryRenderedFeatures(undefined)
            : ref.current?.querySourceFeatures("routes");
        await expect(pending).rejects.toBe(error);
        expect(onError).toHaveBeenCalledWith({ error });
        expect(onError).toHaveBeenCalledWith({ error: second });
        expect(renderer.listenerCount("error")).toBe(1);
        renderer.emitError(new Error("unrelated later event"));
        expect(onError).toHaveBeenCalledTimes(3);
        await expect(
          ref.current?.queryRenderedFeatures(undefined)
        ).resolves.toHaveLength(2);
      }
    );

    test.each(["rendered", "source"] as const)(
      "%s query preserves thrown errors and removes the temporary listener",
      async (kind) => {
        const ref = createRef<MapRef>();
        render(scene({}, undefined, ref));
        const error = new Error("direct failure");
        const query =
          kind === "rendered"
            ? mock.queryRenderedFeatures
            : mock.querySourceFeatures;
        query.mockImplementationOnce(() => {
          throw error;
        });
        const pending =
          kind === "rendered"
            ? ref.current?.queryRenderedFeatures(undefined)
            : ref.current?.querySourceFeatures("routes");
        await expect(pending).rejects.toBe(error);
        expect(target().listenerCount("error")).toBe(1);
      }
    );

    test.each([
      "setFeatureState",
      "getFeatureState",
      "removeFeatureState",
    ] as const)(
      "%s rejects emitted errors and keeps the map callback",
      async (method) => {
        const onError = vi.fn();
        const ref = createRef<MapRef>();
        render(scene({ onError }, undefined, ref));
        const renderer = target();
        const error = new Error(
          "GeoJSON sources cannot have a sourceLayer parameter."
        );
        mock[method].mockImplementationOnce(() => {
          renderer.emitError(error);
          return {};
        });
        const identifier = { source: "routes", sourceLayer: "roads", id: 1 };
        const pending =
          method === "setFeatureState"
            ? ref.current?.setFeatureState(identifier, { selected: true })
            : ref.current?.[method](identifier);
        await expect(pending).rejects.toBe(error);
        expect(onError).toHaveBeenCalledWith({ error });
        expect(renderer.listenerCount("error")).toBe(1);
        await expect(
          ref.current?.setFeatureState(
            { source: "routes", id: 1 },
            { selected: true }
          )
        ).resolves.toBeUndefined();
      }
    );

    test("a malformed result rejects without leaking an error listener", async () => {
      const ref = createRef<MapRef>();
      render(scene({}, undefined, ref));
      // Deliberately absent renderer payload at the test boundary.
      mock.queryRenderedFeatures.mockReturnValueOnce(
        undefined as unknown as ReturnType<typeof mock.queryRenderedFeatures>
      );
      await expect(
        ref.current?.queryRenderedFeatures(undefined)
      ).rejects.toThrow("returned no result");
      expect(target().listenerCount("error")).toBe(1);
    });

    test.each(["entry", "component", "map"] as const)(
      "synchronous %s removal during image registration releases the installed image",
      async (removal) => {
        const mounted = render(
          scene(
            { reuseMaps: true },
            <Images images={{ marker: "https://example.com/m.png" }} />
          )
        );
        const renderer = target();
        const remove = () => {
          renderer.off("styledata", remove);
          flushSync(() => {
            if (removal === "map") mounted.unmount();
            else
              mounted.rerender(
                scene(
                  { reuseMaps: true },
                  removal === "entry" ? <Images images={{}} /> : undefined
                )
              );
          });
        };
        renderer.on("styledata", remove);
        await act(async () => renderer.emitStyleLoad());
        expect(renderer.hasImage("marker")).toBe(false);
        if (removal !== "map") mounted.unmount();
        expect(renderer.listenerCount("styledata")).toBe(0);
        expect(renderer.listenerCount("style.load")).toBe(0);
      }
    );

    test("replacement during image removal retires the entire old synchronization", async () => {
      const mounted = render(
        scene(
          {},
          <Images
            images={{
              marker: "https://example.com/old.png",
              obsolete: "https://example.com/obsolete.png",
            }}
          />
        )
      );
      const renderer = target();
      renderer.addImage("marker", { sprite: true });
      const replace = () => {
        renderer.off("styledata", replace);
        flushSync(() =>
          mounted.rerender(
            scene(
              {},
              <Images images={{ marker: "https://example.com/new.png" }} />
            )
          )
        );
      };
      renderer.on("styledata", replace);
      await act(async () => renderer.emitStyleLoad());
      expect(renderer.addImage).toHaveBeenLastCalledWith(
        "marker",
        {
          url: "https://example.com/new.png",
          width: 1,
          height: 1,
        },
        {}
      );
      expect(renderer.hasImage("obsolete")).toBe(false);
      expect(renderer.loadImage).toHaveBeenCalledTimes(1);
      mounted.unmount();
      expect(renderer.hasImage("marker")).toBe(false);
    });

    test("cleanup callbacks cannot remove replacement-style images", async () => {
      const mounted = render(
        scene(
          {},
          <Images
            images={{
              first: "https://example.com/first.png",
              second: "https://example.com/second.png",
            }}
          />
        )
      );
      const renderer = target();
      await act(async () => renderer.emitStyleLoad());
      const replaceStyle = () => {
        renderer.off("styledata", replaceStyle);
        renderer.clearImages();
        renderer.addImage("second", { sprite: "replacement" });
        renderer.emitStyleLoad();
      };
      renderer.on("styledata", replaceStyle);
      mounted.unmount();
      expect(renderer.hasImage("second")).toBe(true);
      expect(renderer.listenerCount("styledata")).toBe(0);
      expect(renderer.listenerCount("style.load")).toBe(0);
    });

    test("a retired image registration failure cannot remove or report against its replacement", async () => {
      const onError = vi.fn();
      const mounted = render(
        scene(
          { onError },
          <Images images={{ marker: "https://example.com/old.png" }} />
        )
      );
      const renderer = target();
      const addImage = renderer.addImage.getMockImplementation();
      renderer.addImage.mockImplementationOnce((...args) => {
        addImage?.(...args);
        throw new Error("retired style callback failed");
      });
      const replace = () => {
        renderer.off("styledata", replace);
        flushSync(() =>
          mounted.rerender(
            scene(
              { onError },
              <Images images={{ marker: "https://example.com/new.png" }} />
            )
          )
        );
      };
      renderer.on("styledata", replace);
      await act(async () => renderer.emitStyleLoad());
      expect(renderer.addImage).toHaveBeenLastCalledWith(
        "marker",
        {
          url: "https://example.com/new.png",
          width: 1,
          height: 1,
        },
        {}
      );
      expect(onError).not.toHaveBeenCalled();
      mounted.unmount();
      expect(renderer.hasImage("marker")).toBe(false);
    });

    test("an image installed before registration throws is removed without activity retries", async () => {
      const onError = vi.fn();
      const mounted = render(
        scene(
          { onError },
          <Images images={{ marker: "https://example.com/m.png" }} />
        )
      );
      const renderer = target();
      const addImage = renderer.addImage.getMockImplementation();
      renderer.addImage.mockImplementationOnce((...args) => {
        addImage?.(...args);
        throw new Error("style event handler failed");
      });
      await act(async () => renderer.emitStyleLoad());
      expect(renderer.hasImage("marker")).toBe(false);
      expect(onError).toHaveBeenCalledTimes(1);
      await act(async () => renderer.emitStyleData());
      expect(renderer.loadImage).toHaveBeenCalledTimes(1);
      mounted.unmount();
    });

    test.each(["styledata", "load", "idle"] as const)(
      "%s registers initial images after style.load precedes tile readiness",
      async (event) => {
        const mounted = render(
          scene({}, <Images images={{ marker: "https://example.com/m.png" }} />)
        );
        const renderer = target();
        const ready = vi
          .spyOn(renderer, "isStyleLoaded")
          .mockReturnValue(false);
        act(() => renderer.emitStyleLoad());
        expect(renderer.loadImage).not.toHaveBeenCalled();

        ready.mockReturnValue(true);
        await act(async () => {
          if (event === "styledata") renderer.emitStyleData();
          else if (event === "load") renderer.emitLoad();
          else renderer.emitIdle();
        });
        expect(renderer.hasImage("marker")).toBe(true);
        expect(renderer.loadImage).toHaveBeenCalledTimes(1);
        mounted.unmount();
        expect(renderer.listenerCount()).toBe(0);
        ready.mockRestore();
      }
    );

    test.each([true, false])(
      "style replacement restores a custom image over a same-name sprite with tiles ready=%s",
      async (tilesReady) => {
        const entry = {
          marker: { url: "https://example.com/custom.png", sdf: true },
        };
        const mounted = render(scene({}, <Images images={entry} />));
        const renderer = target();
        await act(async () => renderer.emitStyleLoad());
        expect(renderer.hasImage("marker")).toBe(true);

        renderer.clearImages();
        renderer.addImage("marker", { sprite: "replacement" });
        renderer.addImage("style-only", { sprite: "unrelated" });
        renderer.addImage.mockClear();
        const ready = vi
          .spyOn(renderer, "isStyleLoaded")
          .mockReturnValue(tilesReady);
        await act(async () => renderer.emitStyleLoad());
        if (!tilesReady) {
          expect(renderer.addImage).not.toHaveBeenCalled();
          ready.mockReturnValue(true);
          await act(async () => renderer.emitIdle());
        }
        expect(renderer.addImage).toHaveBeenCalledExactlyOnceWith(
          "marker",
          { url: entry.marker.url, width: 1, height: 1 },
          { sdf: true }
        );
        mounted.rerender(scene({}, <Images images={{ ...entry }} />));
        expect(renderer.loadImage).toHaveBeenCalledTimes(2);
        mounted.unmount();
        expect(renderer.hasImage("marker")).toBe(false);
        expect(renderer.hasImage("style-only")).toBe(true);
        expect(renderer.listenerCount("style.load")).toBe(0);
        ready.mockRestore();
      }
    );

    test.each(["resolve", "reject"] as const)(
      "style replacement retires a pending image load that later completes with %s",
      async (outcome) => {
        const onError = vi.fn();
        const mounted = render(
          scene(
            { onError },
            <Images images={{ marker: "https://example.com/custom.png" }} />
          )
        );
        const renderer = target();
        let finishOld: (error: unknown, image?: object) => void = () => {};
        renderer.loadImage.mockImplementationOnce((_url, callback) => {
          if (callback) {
            finishOld = callback;
            return undefined;
          }
          return new Promise((resolve, reject) => {
            finishOld = (error, image) => {
              if (error) reject(error);
              else resolve({ data: image });
            };
          });
        });
        await act(async () => renderer.emitStyleLoad());
        renderer.clearImages();
        renderer.addImage("marker", { sprite: "replacement" });
        renderer.addImage.mockClear();
        await act(async () => renderer.emitStyleLoad());
        expect(renderer.addImage).toHaveBeenCalledExactlyOnceWith(
          "marker",
          { url: "https://example.com/custom.png", width: 1, height: 1 },
          {}
        );
        await act(async () => {
          finishOld(
            outcome === "reject" ? new Error("Retired image load") : null,
            { stale: true }
          );
        });
        expect(renderer.addImage).toHaveBeenCalledTimes(1);
        expect(onError).not.toHaveBeenCalled();
        mounted.unmount();
        expect(renderer.hasImage("marker")).toBe(false);
      }
    );

    test("unmount before replacement style readiness leaves its same-name sprite alone", async () => {
      const mounted = render(
        scene(
          {},
          <Images images={{ marker: "https://example.com/custom.png" }} />
        )
      );
      const renderer = target();
      await act(async () => renderer.emitStyleLoad());
      renderer.clearImages();
      renderer.addImage("marker", { sprite: "replacement" });
      const ready = vi.spyOn(renderer, "isStyleLoaded").mockReturnValue(false);
      act(() => renderer.emitStyleLoad());
      mounted.unmount();
      expect(renderer.hasImage("marker")).toBe(true);
      expect(renderer.listenerCount("style.load")).toBe(0);
      ready.mockRestore();
    });

    if (adapter.backend === "maplibre-web") {
      test("a sprite changed by an in-place style diff restores colliding custom images", async () => {
        const mounted = render(
          scene(
            {},
            <Images images={{ marker: "https://example.com/custom.png" }} />
          )
        );
        const renderer = target();
        let spriteUrl = "https://example.com/first-sprite";
        renderer.getSprite = () => [{ id: "default", url: spriteUrl }];
        await act(async () => renderer.emitStyleLoad());
        expect(renderer.loadImage).toHaveBeenCalledTimes(1);
        await act(async () => renderer.emitStyleData());
        expect(renderer.loadImage).toHaveBeenCalledTimes(1);

        spriteUrl = "https://example.com/replacement-sprite";
        const ready = vi
          .spyOn(renderer, "isStyleLoaded")
          .mockReturnValue(false);
        act(() => renderer.emitStyleData());
        renderer.addImage("marker", { sprite: "replacement" });
        renderer.addImage.mockClear();
        ready.mockReturnValue(true);
        await act(async () => renderer.emitStyleData());
        expect(renderer.addImage).toHaveBeenCalledExactlyOnceWith(
          "marker",
          { url: "https://example.com/custom.png", width: 1, height: 1 },
          {}
        );
        await act(async () => renderer.emitStyleData());
        expect(renderer.loadImage).toHaveBeenCalledTimes(2);
        mounted.unmount();
        expect(renderer.hasImage("marker")).toBe(false);
        ready.mockRestore();
      });
    }

    test("an image finishing while tiles are pending retries when the map is ready", async () => {
      const mounted = render(scene({}, <Images images={{}} />));
      const renderer = target();
      act(() => renderer.emitStyleLoad());
      let finish: (image: object) => void = () => {};
      renderer.loadImage.mockImplementationOnce(
        (_url, callback) =>
          new Promise((resolve) => {
            finish = (image) => {
              callback?.(null, image);
              resolve({ data: image });
            };
          })
      );
      mounted.rerender(
        scene({}, <Images images={{ marker: "https://example.com/m.png" }} />)
      );
      const ready = vi.spyOn(renderer, "isStyleLoaded").mockReturnValue(false);
      await act(async () => finish({ width: 1, height: 1 }));
      expect(renderer.hasImage("marker")).toBe(false);

      ready.mockReturnValue(true);
      await act(async () => renderer.emitIdle());
      expect(renderer.hasImage("marker")).toBe(true);
      expect(renderer.loadImage).toHaveBeenCalledTimes(2);
      ready.mockRestore();
    });

    test.each(["load", "registration", "inspection", "empty"] as const)(
      "%s image failures report a credential-safe map error without retrying on tile activity",
      async (failure) => {
        const onError = vi.fn();
        render(
          scene(
            { onError },
            <Images
              images={{ marker: "https://example.com/m.png?token=secret" }}
            />
          )
        );
        const renderer = target();
        const error = new Error("https://example.com/m.png?token=secret");
        if (failure === "inspection") {
          const loadImage = renderer.loadImage.getMockImplementation();
          renderer.loadImage.mockImplementation((...args) => {
            const result = loadImage?.(...args);
            vi.spyOn(renderer, "hasImage").mockImplementationOnce(() => {
              throw error;
            });
            return result;
          });
        } else if (failure === "registration") {
          renderer.addImage.mockImplementation(() => {
            throw error;
          });
        } else {
          renderer.loadImage.mockImplementation((_url, callback) => {
            if (callback) {
              callback(failure === "load" ? error : null);
              return undefined;
            }
            return failure === "load"
              ? Promise.reject(error)
              : Promise.resolve({ data: undefined });
          });
        }

        await act(async () => renderer.emitStyleLoad());
        expect(onError).toHaveBeenCalledTimes(1);
        const reported = onError.mock.calls[0]?.[0].error as Error;
        expect(reported.message).toBe("Style image registration failed.");
        expect(reported.cause).toBeUndefined();

        await act(async () => {
          renderer.emitStyleData();
          renderer.emitLoad();
          renderer.emitIdle();
          renderer.emitIdle();
        });
        expect(renderer.loadImage).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledTimes(1);
        expect(renderer.hasImage("marker")).toBe(false);
      }
    );

    test.each(["removed", "replaced", "unmounted"] as const)(
      "%s image loads cannot report late failures to the current map",
      async (retirement) => {
        const onError = vi.fn();
        const content = (images: Record<string, string>) =>
          scene({ onError, reuseMaps: true }, <Images images={images} />);
        const mounted = render(
          content({ marker: "https://example.com/old.png" })
        );
        const renderer = target();
        let rejectLoad: (error: Error) => void = () => {};
        renderer.loadImage.mockImplementationOnce((_url, callback) => {
          if (callback) {
            rejectLoad = callback;
            return undefined;
          }
          return new Promise((_resolve, reject) => {
            rejectLoad = reject;
          });
        });
        await act(async () => renderer.emitStyleLoad());
        if (retirement === "unmounted") {
          mounted.unmount();
          render(content({}));
        } else {
          mounted.rerender(
            content(
              retirement === "removed"
                ? {}
                : { marker: "https://example.com/new.png" }
            )
          );
        }

        await act(async () => rejectLoad(new Error("late failure")));
        expect(onError).not.toHaveBeenCalled();
      }
    );

    test("entry removal does not wait for full style readiness", async () => {
      const mounted = render(
        scene(
          {},
          <Images images={{ marker: "https://example.com/marker.png" }} />
        )
      );
      const renderer = target();
      act(() => renderer.emitStyleLoad());
      await waitFor(() => expect(renderer.hasImage("marker")).toBe(true));
      const ready = vi.spyOn(renderer, "isStyleLoaded").mockReturnValue(false);
      mounted.rerender(scene({}, <Images images={{}} />));
      expect(renderer.hasImage("marker")).toBe(false);
      ready.mockRestore();
    });

    test("loading-style unmount removes images before renderer reuse", async () => {
      const mounted = render(
        scene(
          { reuseMaps: true },
          <Images images={{ marker: "https://example.com/marker.png" }} />
        )
      );
      const renderer = target();
      act(() => renderer.emitStyleLoad());
      await waitFor(() => expect(renderer.hasImage("marker")).toBe(true));
      const ready = vi.spyOn(renderer, "isStyleLoaded").mockReturnValue(false);
      mounted.unmount();
      expect(renderer.hasImage("marker")).toBe(false);
      expect(renderer.listenerCount("style.load")).toBe(0);
      expect(renderer.listenerCount("styledata")).toBe(0);
      ready.mockReturnValue(true);
      render(scene({ reuseMaps: true }, <Images images={{}} />));
      expect(target()).toBe(renderer);
      act(() => renderer.emitStyleLoad());
      expect(renderer.hasImage("marker")).toBe(false);
      ready.mockRestore();
    });

    test("unmount continues removing other images after one removal throws", async () => {
      const mounted = render(
        scene(
          {},
          <Images
            images={{
              first: "https://example.com/a.png",
              second: "https://example.com/b.png",
            }}
          />
        )
      );
      const renderer = target();
      act(() => renderer.emitStyleLoad());
      await waitFor(() => expect(renderer.hasImage("second")).toBe(true));
      renderer.removeImage.mockImplementationOnce(() => {
        throw new Error("style unavailable");
      });
      expect(() => mounted.unmount()).not.toThrow();
      expect(renderer.removeImage).toHaveBeenCalledWith("second");
      expect(renderer.hasImage("second")).toBe(false);
      expect(renderer.listenerCount("style.load")).toBe(0);
    });

    test("unmount safely handles an absent or destroyed style", async () => {
      const mounted = render(
        scene(
          {},
          <Images images={{ marker: "https://example.com/marker.png" }} />
        )
      );
      const renderer = target();
      act(() => renderer.emitStyleLoad());
      await waitFor(() => expect(renderer.hasImage("marker")).toBe(true));
      const imageMethods = vi
        .spyOn(renderer, "hasImage")
        .mockImplementation(() => {
          throw new Error("no style");
        });
      expect(() => mounted.unmount()).not.toThrow();
      expect(renderer.listenerCount("style.load")).toBe(0);
      expect(renderer.listenerCount("styledata")).toBe(0);
      imageMethods.mockRestore();
    });

    test("pending loads cannot register after loading-style unmount and reuse", async () => {
      const mounted = render(
        scene({ reuseMaps: true }, <Images images={{}} />)
      );
      const renderer = target();
      act(() => renderer.emitStyleLoad());
      let finish: (image: object) => void = () => {};
      renderer.loadImage.mockImplementationOnce(
        (_url, callback) =>
          new Promise((resolve) => {
            finish = (image) => {
              callback?.(null, image);
              resolve({ data: image });
            };
          })
      );
      mounted.rerender(
        scene(
          { reuseMaps: true },
          <Images images={{ delayed: "https://example.com/delayed.png" }} />
        )
      );
      const ready = vi.spyOn(renderer, "isStyleLoaded").mockReturnValue(false);
      mounted.unmount();
      ready.mockReturnValue(true);
      render(scene({ reuseMaps: true }, <Images images={{}} />));
      await act(async () => finish({ width: 1, height: 1 }));
      expect(target()).toBe(renderer);
      expect(renderer.addImage).not.toHaveBeenCalled();
      ready.mockRestore();
    });

    test.each([true, undefined])(
      "clearing interactive=false to %s restores default handlers",
      (interactive) => {
        const mounted = render(scene({ interactive: true }));
        const renderer = target();
        expect(
          webHandlerNames.every((name) => renderer.handlers[name].isEnabled())
        ).toBe(true);
        mounted.rerender(scene({ interactive: false }));
        expect(
          webHandlerNames.every((name) => !renderer.handlers[name].isEnabled())
        ).toBe(true);
        mounted.rerender(scene({ interactive }));
        expect(
          webHandlerNames.every((name) => renderer.handlers[name].isEnabled())
        ).toBe(true);
      }
    );

    test("individual gestures cannot override the disabled master flag", () => {
      const mounted = render(scene({ interactive: false }));
      const renderer = target();
      mounted.rerender(
        scene({
          interactive: false,
          dragPan: true,
          scrollZoom: true,
          doubleTapZoom: true,
          dragRotate: true,
          boxZoom: true,
          keyboard: true,
          touchZoom: true,
          touchRotate: true,
          touchPitch: true,
        })
      );
      expect(
        webHandlerNames.every((name) => !renderer.handlers[name].isEnabled())
      ).toBe(true);
    });

    test("restoring interaction keeps explicit gestures and disabled pinch through rotation reset", () => {
      const props = {
        interactive: false,
        dragPan: false,
        scrollZoom: true,
        doubleTapZoom: false,
        touchZoom: false,
        touchRotate: false,
      };
      const mounted = render(scene(props));
      const renderer = target();
      mounted.rerender(
        scene({ ...props, interactive: true, touchRotate: undefined })
      );
      expect(renderer.handlers.dragPan.isEnabled()).toBe(false);
      expect(renderer.handlers.scrollZoom.isEnabled()).toBe(true);
      expect(renderer.handlers.doubleClickZoom.isEnabled()).toBe(false);
      expect(renderer.handlers.touchZoomRotate.isEnabled()).toBe(false);
      expect(renderer.handlers.keyboard.isEnabled()).toBe(true);
    });

    test("reused renderer applies the new mount's interaction settings", () => {
      const first = render(scene({ interactive: false, reuseMaps: true }));
      const renderer = target();
      first.unmount();
      const next = render(scene({ reuseMaps: true, dragPan: false }));
      expect(target()).toBe(renderer);
      expect(renderer.handlers.dragPan.isEnabled()).toBe(false);
      expect(
        webHandlerNames
          .filter((name) => name !== "dragPan")
          .every((name) => renderer.handlers[name].isEnabled())
      ).toBe(true);
      next.unmount();
      render(scene({ reuseMaps: true, interactive: false }));
      expect(target()).toBe(renderer);
      expect(
        webHandlerNames.every((name) => !renderer.handlers[name].isEnabled())
      ).toBe(true);
    });
  });
};
