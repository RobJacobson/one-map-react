import { act, render, waitFor } from "@testing-library/react";
import { createRef, type ReactNode } from "react";
import { beforeEach, describe, expect, vi, test } from "vite-plus/test";

import {
  emptyStyle,
  initialViewState,
  routes,
} from "../../../tests/fixtures/map-fixture.js";
import type { Adapter } from "../src/contracts/adapter.js";
import type { MapRef } from "../src/contracts/camera-types.js";
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

  describe("follow-up query, image, and interaction corrections", () => {
    beforeEach(() => mock.resetWebMapMock());

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
