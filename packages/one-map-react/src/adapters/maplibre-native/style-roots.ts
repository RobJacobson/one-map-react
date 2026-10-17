/**
 * Rejects formatting modifiers silently ignored by the pinned native parser.
 * @param value - A layer/style expression or object of expressions.
 * @throws For silently ignored formatting modifiers. Unsupported operators retain native parser errors.
 */
export const assertMaplibreExpressions = (value: unknown): void => {
  if (Array.isArray(value)) {
    const operator: unknown = value[0];
    if (operator === "literal") return;
    if (
      operator === "number-format" &&
      value[2] &&
      typeof value[2] === "object" &&
      Object.hasOwn(value[2], "unit")
    ) {
      throw new Error(
        "number-format.unit is unsupported by the pinned MapLibre Native SDK."
      );
    }
    for (let index = 1; index < value.length; index += 1) {
      if (
        operator === "match" &&
        index >= 2 &&
        index < value.length - 1 &&
        index % 2 === 0
      )
        continue;
      const member: unknown = value[index];
      if (
        operator === "format" &&
        index % 2 === 0 &&
        member &&
        typeof member === "object" &&
        Object.hasOwn(member, "vertical-align")
      ) {
        throw new Error(
          "format.vertical-align is unsupported by the pinned MapLibre Native SDK."
        );
      }
      assertMaplibreExpressions(member);
    }
  } else if (value && typeof value === "object") {
    for (const member of Object.values(value))
      assertMaplibreExpressions(member);
  }
};

/** Native wrapper/style-document layer values checked before dispatch. */
interface NativeLayerValues {
  readonly type?: unknown;
  readonly paint?: unknown;
  readonly layout?: unknown;
  readonly filter?: unknown;
  readonly style?: unknown;
}

/**
 * Checks layer fields against the pinned native property registry and expression parser.
 * @param layer - Public layer values, including legacy native style fields.
 * @throws For unsupported fields or expressions that native would ignore.
 */
export const assertMaplibreLayerStyle = (layer: NativeLayerValues): void => {
  for (const [values, keys] of [
    [layer.paint, ["resampling", "fill-layer-opacity", "line-layer-opacity"]],
    [layer.layout, ["icon-overlap", "text-overlap"]],
    [
      layer.style,
      [
        "resampling",
        "fillLayerOpacity",
        "lineLayerOpacity",
        "iconOverlap",
        "textOverlap",
      ],
    ],
  ] as const) {
    if (!values || typeof values !== "object") continue;
    for (const key of keys) {
      if (Object.hasOwn(values, key))
        throw new Error(
          `Layer property "${key}" is unsupported by the pinned MapLibre Native SDK. Raster layers can use legacy style.rasterResampling; basic symbol overlap uses iconAllowOverlap/textAllowOverlap.`
        );
    }
  }
  for (const value of [layer.paint, layer.layout, layer.filter, layer.style])
    assertMaplibreExpressions(value);
};

/**
 * Rejects explicit style roots ignored by the pinned native SDK parser.
 * @param input - Selected style document, JSON string, or URL delegated to the wrapper.
 * @throws For unsupported explicit terrain/sky/global-state or non-Mercator projection.
 */
export const assertMaplibreStyleRoots = (input: unknown): void => {
  const style: unknown =
    typeof input === "string" && input.trimStart().startsWith("{")
      ? JSON.parse(input)
      : input;
  if (style === null || typeof style !== "object") return;
  // Native SDK android-v13.6.1/ios-v6.31.0 parser.cpp has no transport for these roots.
  for (const key of ["terrain", "sky", "state"]) {
    if (Object.hasOwn(style, key))
      throw new Error(
        `Style root "${key}" is unsupported by the pinned MapLibre Native SDK.`
      );
  }
  if ("projection" in style) {
    const projection = style.projection;
    if (
      !projection ||
      typeof projection !== "object" ||
      !("type" in projection) ||
      projection.type !== "mercator"
    ) {
      throw new Error("MapLibre Native supports only Mercator projection.");
    }
  }
  if ("light" in style) assertMaplibreExpressions(style.light);
  if ("layers" in style && Array.isArray(style.layers)) {
    for (const layer of style.layers) {
      if (!layer || typeof layer !== "object") continue;
      assertMaplibreLayerStyle(layer);
    }
  }
  if (
    "sources" in style &&
    style.sources &&
    typeof style.sources === "object"
  ) {
    for (const source of Object.values(style.sources)) {
      if (!source || typeof source !== "object" || !("type" in source))
        continue;
      const unsupported = ["volatile"];
      if (source.type === "video")
        throw new Error(
          "Video sources are unsupported by the pinned MapLibre Native SDK."
        );
      if (source.type === "geojson")
        unsupported.push("attribution", "generateId", "promoteId", "filter");
      if (source.type === "vector") unsupported.push("promoteId");
      if (source.type === "raster-dem")
        unsupported.push("redFactor", "greenFactor", "blueFactor", "baseShift");
      for (const key of unsupported) {
        if (Object.hasOwn(source, key))
          throw new Error(
            `Source option "${key}" is unsupported by the pinned MapLibre Native SDK.`
          );
      }
    }
  }
};
