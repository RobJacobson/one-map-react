import { transformAsync } from "@babel/core";
import compiler from "babel-plugin-react-compiler";

/** Compiles original library source before the packer's TypeScript/JSX lowering. */
export const reactCompiler = () => {
  const skipped = new Set();
  return {
    name: "one-map-react-compiler",
    buildStart: () => skipped.clear(),
    transform: {
      order: "pre",
      filter: { id: /\/packages\/one-map-react\/src\/.*\.(ts|tsx)$/ },
      handler: async (source, filename) => {
        const result = await transformAsync(source, {
          filename,
          babelrc: false,
          configFile: false,
          sourceMaps: true,
          parserOpts: {
            plugins: filename.endsWith(".tsx")
              ? ["typescript", "jsx"]
              : ["typescript"],
          },
          plugins: [
            [
              compiler,
              {
                target: "19",
                logger: {
                  logEvent: (file, event) => {
                    if (event.kind === "CompileError") {
                      skipped.add(
                        `${file.split("/src/")[1]}:${event.fnLoc?.start.line ?? "?"}: ${event.detail.reason}`
                      );
                    }
                  },
                },
              },
            ],
          ],
        });
        return { code: result.code, map: result.map };
      },
    },
    buildEnd: () => {
      if (skipped.size) {
        console.warn(
          `React Compiler retained ${skipped.size} diagnostics:\n${[...skipped].sort().join("\n")}`
        );
      }
    },
  };
};
