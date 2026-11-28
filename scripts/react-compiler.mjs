import { transformAsync } from "@babel/core";
import compiler from "babel-plugin-react-compiler";

/**
 * Creates the React Compiler plugin for the library build.
 *
 * @returns A packer plugin that compiles source before TypeScript and JSX lowering.
 */
export const reactCompiler = () => ({
  name: "one-map-react-compiler",
  transform: {
    order: "pre",
    filter: { id: /\/packages\/one-map-react\/src\/.*\.(ts|tsx)$/ },
    handler: transformLibrarySource,
  },
});

const transformLibrarySource = async (source, filename) => {
  const { code, map } = await transformAsync(source, {
    filename,
    babelrc: false,
    configFile: false,
    sourceMaps: true,
    parserOpts: {
      plugins: filename.endsWith(".tsx")
        ? ["typescript", "jsx"]
        : ["typescript"],
    },
    plugins: [[compiler, { target: "19", panicThreshold: "all_errors" }]],
  });

  return { code, map };
};
