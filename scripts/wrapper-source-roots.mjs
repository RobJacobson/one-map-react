import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);

/** Installed wrapper sources used by mocked tests across linked checkouts. */
export const wrapperSourceRoots = ["mapbox", "maplibre"].map((engine) => {
  const wrapperRequire = createRequire(
    require.resolve(`react-map-gl/${engine}`)
  );

  return resolve(
    dirname(wrapperRequire.resolve(`@vis.gl/react-${engine}`)),
    "../src"
  );
});
