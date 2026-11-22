import { expect, jest, test } from "@jest/globals";
import { act, render } from "@testing-library/react-native";
import {
  createRef,
  type ComponentType,
  type ReactNode,
  type RefAttributes,
} from "react";

import {
  emptyStyle,
  initialViewState,
  routes,
} from "../../example-map/src/scenarios/map-fixture.js";
import type { NativeBackend } from "../src/contracts/backend.js";
import type { LayerProps } from "../src/contracts/layer-types.js";
import type {
  NativeMapInputs,
  NativeMapRef,
} from "../src/contracts/native-types.js";
import type {
  ImageSourceProps,
  SourceProps,
} from "../src/contracts/source-types.js";
import { Images } from "../src/native-extensions.js";

type SelectedOptions = {
  readonly onDidFinishRenderingFrameFully?: () => void;
  readonly logoPosition?: { bottom: number; left: number };
  readonly compassPosition?: { top: number; right: number };
  readonly attributionPosition?: { top: number; right: number };
};

type RenderingEntry<Handle> = {
  readonly Map: ComponentType<
    NativeMapInputs & RefAttributes<Handle> & { options?: SelectedOptions }
  >;
  readonly Source: ComponentType<SourceProps>;
  readonly Layer: ComponentType<LayerProps>;
};

type WrapperMocks = {
  readonly map: jest.Mock;
  readonly image: jest.Mock;
  readonly geojson: jest.Mock;
  readonly raster: jest.Mock;
};

/**
 * Runs common rendering and unsupported-input cases through a public native entry.
 *
 * @param entry - Selected public components.
 * @param backend - SDK used to select wrapper field names.
 * @param wrapper - The SDK mocks that record selected component calls.
 */
export const testNativeRendering = <Handle extends NativeMapRef>(
  entry: RenderingEntry<Handle>,
  backend: NativeBackend,
  wrapper: WrapperMocks
): void => {
  const { Map: NativeMap, Source, Layer } = entry;
  const isMapbox = backend === "mapbox-native";
  const layerTestId = isMapbox ? "LineLayer" : "Layer";
  const sourceProp = isMapbox ? "sourceID" : "source";
  const tree = (children: ReactNode) => (
    <NativeMap mapStyle={emptyStyle} initialViewState={initialViewState}>
      {children}
    </NativeMap>
  );

  test.each([
    {
      option: "reuseMaps",
      props: { reuseMaps: true },
      message:
        "reuseMaps is not available on native maps. Remounting creates a new map.",
    },
    {
      option: "gl",
      props: {
        gl: { canvas: {}, drawingBufferWidth: 1, drawingBufferHeight: 1 },
      },
      message:
        "gl is a web drawing context and is not available on native maps.",
    },
  ])(
    "rejects $option before creating a wrapper",
    async ({ props, message }) => {
      wrapper.map.mockClear();
      await expect(
        render(<NativeMap mapStyle={emptyStyle} {...props} />)
      ).rejects.toThrow(message);
      expect(wrapper.map).not.toHaveBeenCalled();
    }
  );

  test("resize() is rejected", async () => {
    const ref = createRef<Handle>();
    await render(<NativeMap ref={ref} mapStyle={emptyStyle} />);
    await expect(ref.current?.resize()).rejects.toThrow(
      "resize() is not available on native maps. Size follows the host style."
    );
  });

  test("style updates preserve the wrapper map and remount creates a new map", async () => {
    const styleUrl = "https://example.com/style.json";
    const scene = (mapStyle: NativeMapInputs["mapStyle"]) => (
      <NativeMap mapStyle={mapStyle} initialViewState={initialViewState} />
    );
    const view = await render(scene(emptyStyle));
    const id = view.getByTestId("wrapper-map").props.mapId;
    await view.rerender(scene(emptyStyle));
    expect(view.getByTestId("wrapper-map").props.mapId).toBe(id);
    await view.rerender(scene(styleUrl));
    const wrapperMap = view.getByTestId("wrapper-map");
    expect(wrapperMap.props.mapId).toBe(id);
    expect(wrapperMap.props[isMapbox ? "styleURL" : "mapStyle"]).toBe(styleUrl);

    await view.unmount();
    const replacement = await render(scene(emptyStyle));
    expect(replacement.getByTestId("wrapper-map").props.mapId).not.toBe(id);
  });

  test("selected SDK ornament flags and positions update and reset to defaults", async () => {
    const options = (enabled: boolean | undefined) => ({
      ...(isMapbox
        ? {
            attributionEnabled: enabled,
            logoEnabled: enabled,
            scaleBarEnabled: enabled,
          }
        : { attribution: enabled, logo: enabled, scaleBar: enabled }),
      logoPosition: enabled === undefined ? undefined : { bottom: 3, left: 4 },
      compassPosition: enabled === undefined ? undefined : { top: 7, right: 8 },
      attributionPosition:
        enabled === undefined ? undefined : { top: 5, right: 6 },
    });
    const scene = (enabled: boolean | undefined) => (
      <NativeMap
        mapStyle={emptyStyle}
        initialViewState={initialViewState}
        options={options(enabled)}
      />
    );
    const view = await render(scene(true));
    expect(wrapper.map.mock.lastCall?.[0]).toMatchObject(options(true));
    for (const enabled of [false, undefined]) {
      await view.rerender(scene(enabled));
      expect(wrapper.map.mock.lastCall?.[0]).toMatchObject(options(enabled));
    }
    await view.unmount();
  });

  test("forwards the selected frame observation callback", async () => {
    const onFrame = jest.fn();
    const view = await render(
      <NativeMap
        mapStyle={emptyStyle}
        initialViewState={initialViewState}
        options={{ onDidFinishRenderingFrameFully: onFrame }}
      />
    );
    const { onDidFinishRenderingFrameFully } =
      view.getByTestId("wrapper-map").props;
    expect(onDidFinishRenderingFrameFully).toBe(onFrame);
    await act(async () => onDidFinishRenderingFrameFully());
    expect(onFrame).toHaveBeenCalledTimes(1);
  });

  test("a raster source keeps tileSize", async () => {
    const url = "https://example.com/raster.json";
    await render(
      tree(<Source id="base" type="raster" url={url} tileSize={512} />)
    );
    expect(wrapper.raster).toHaveBeenCalledWith(
      expect.objectContaining({ id: "base", url, tileSize: 512 }),
      undefined
    );
  });

  test("an image source forwards and updates its URL and four corners", async () => {
    const scene = (url: string, coordinates: ImageSourceProps["coordinates"]) =>
      tree(
        <Source id="overlay" type="image" url={url} coordinates={coordinates} />
      );
    const initialUrl = "https://example.com/overlay.png";
    const initialCorners = [
      [-122.5, 47.8],
      [-122.1, 47.8],
      [-122.1, 47.4],
      [-122.5, 47.4],
    ] as const;
    const view = await render(scene(initialUrl, initialCorners));
    expect(wrapper.image).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "overlay",
        url: initialUrl,
        coordinates: initialCorners,
      }),
      undefined
    );

    const updatedUrl = "https://example.com/overlay-b.png";
    const updatedCorners = [
      [-122.4, 47.7],
      [-122.2, 47.7],
      [-122.2, 47.5],
      [-122.4, 47.5],
    ] as const;
    await view.rerender(scene(updatedUrl, updatedCorners));
    expect(wrapper.image.mock.lastCall?.[0]).toMatchObject({
      id: "overlay",
      url: updatedUrl,
      coordinates: updatedCorners,
    });
  });

  test("updated GeoJSON data reaches the wrapper", async () => {
    const updated = { type: "FeatureCollection" as const, features: [] };
    const view = await render(
      tree(<Source id="routes" type="geojson" data={routes} />)
    );
    await view.rerender(
      tree(<Source id="routes" type="geojson" data={updated} />)
    );
    expect(wrapper.geojson.mock.lastCall?.[0]).toMatchObject({
      id: "routes",
      [isMapbox ? "shape" : "data"]: updated,
    });
  });

  test("changing a source creation option throws and asks for a remount", async () => {
    const scene = (cluster: boolean) =>
      tree(
        <Source id="points" type="geojson" data={routes} cluster={cluster} />
      );
    const view = await render(scene(false));
    await expect(view.rerender(scene(true))).rejects.toThrow(
      'Source "points" changed the creation option "cluster". Remount it with a new React key to recreate the resource.'
    );
  });

  test("changing the wrapper layer source field throws and asks for a remount", async () => {
    const scene = (source: string) =>
      tree(<Layer id="route-line" type="line" {...{ [sourceProp]: source }} />);
    const view = await render(scene("routes"));
    await expect(view.rerender(scene("other"))).rejects.toThrow(
      `Layer "route-line" changed the creation option "${sourceProp}".`
    );
  });

  test("selected Layer forwards source, transitions and ordering, then resets removed paint", async () => {
    const transition = { duration: 450 };
    const paintProp = isMapbox ? "style" : "paint";
    const widthProp = isMapbox ? "lineWidth" : "line-width";
    const transitionProp = isMapbox
      ? "lineWidthTransition"
      : "line-width-transition";
    const beforeProp = isMapbox ? "belowLayerID" : "beforeId";
    const scene = (width?: number, beforeId?: string) => (
      <NativeMap mapStyle={emptyStyle}>
        <Source id="route-data" type="geojson" data={routes} />
        <Layer
          id="route-layer"
          type="line"
          source="route-data"
          beforeId={beforeId}
          filter={
            width === undefined
              ? undefined
              : ["==", ["geometry-type"], "LineString"]
          }
          paint={{ "line-width": width, "line-width-transition": transition }}
        />
      </NativeMap>
    );
    const view = await render(scene(2, "water"));
    const original = view.getByTestId(layerTestId);
    expect(original.props[sourceProp]).toBe("route-data");
    expect(original.props[paintProp]).toEqual({
      [widthProp]: 2,
      [transitionProp]: transition,
    });

    await view.rerender(scene(3, "label"));
    expect(view.getByTestId(layerTestId)).toBe(original);
    expect(original.props[beforeProp]).toBe("label");
    expect(original.props[paintProp]).toEqual({
      [widthProp]: 3,
      [transitionProp]: transition,
    });

    await view.rerender(scene());
    const replacement = view.getByTestId(layerTestId);
    expect(replacement).not.toBe(original);
    expect(replacement.props[paintProp]).toEqual({
      [transitionProp]: transition,
    });
    expect(replacement.props[beforeProp]).toBeUndefined();
    expect(replacement.props.filter).toBeUndefined();
  });

  test("images outside a map are rejected", async () => {
    await expect(
      render(<Images images={{ marker: "https://example.com/m.png" }} />)
    ).rejects.toThrow("Images must render inside Map.");
  });

  test("registered images convert to wrapper fields and update independently", async () => {
    const initialMarker = "https://example.com/marker.png";
    const updatedMarker = "https://example.com/new-marker.png";
    const shieldUrl = "https://example.com/shield.png";
    const scene = (marker?: string) =>
      tree(
        <Images
          images={{
            ...(marker ? { marker } : {}),
            shield: { url: shieldUrl, sdf: true },
          }}
        />
      );
    const nativeImage = (url: string) =>
      isMapbox ? { url } : { source: { uri: url } };
    const view = await render(scene(initialMarker));
    const [marker, shield] = view.getAllByTestId("wrapper-images");
    expect(marker.props.images).toEqual({ marker: nativeImage(initialMarker) });
    expect(shield.props.images).toEqual({
      shield: { ...nativeImage(shieldUrl), sdf: true },
    });

    await view.rerender(scene(updatedMarker));
    const [newMarker, sameShield] = view.getAllByTestId("wrapper-images");
    expect(newMarker).not.toBe(marker);
    expect(sameShield).toBe(shield);
    expect(newMarker.props.images).toEqual({
      marker: nativeImage(updatedMarker),
    });

    await view.rerender(scene());
    expect(view.getAllByTestId("wrapper-images")).toEqual([shield]);
  });
};
