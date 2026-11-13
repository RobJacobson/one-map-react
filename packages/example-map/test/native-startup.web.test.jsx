import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";

import { transformSync, types } from "@babel/core";
import { act, render } from "@testing-library/react";
import { Component, createElement } from "react";
import { expect, test, vi } from "vite-plus/test";
const requireDependency = createRequire(resolve("package.json"));
const evaluate = (directory, name, dependency) => {
  const file = directory === "dist" ? name.replace(/\.tsx?$/, ".js") : name;
  const exports = {};
  const source = readFileSync(
    resolve("packages/example-map", directory, file),
    "utf8"
  );
  if (directory === "dist")
    expect(source).not.toMatch(/\b__require\b|["']node:module["']/);
  const compiled = transformSync(source, {
    filename: file,
    configFile: resolve("babel.config.cjs"),
    plugins: [
      () => ({
        visitor: {
          CallExpression: (path) => {
            if (path.node.callee.type !== "Import") return;
            const argument = path.node.arguments[0];
            if (!types.isStringLiteral(argument))
              throw new Error("Expected a literal selected scene.");
            // Preserve import/require resolution conditions; the SDK exposes different modules.
            path.replaceWith(
              types.callExpression(
                types.memberExpression(
                  types.callExpression(
                    types.memberExpression(
                      types.identifier("Promise"),
                      types.identifier("resolve")
                    ),
                    []
                  ),
                  types.identifier("then")
                ),
                [
                  types.arrowFunctionExpression(
                    [],
                    types.callExpression(types.identifier("dependencyImport"), [
                      argument,
                    ])
                  ),
                ]
              )
            );
          },
        },
      }),
    ],
  })?.code;
  if (!compiled) throw new Error("Missing compiled native example.");
  runInNewContext(compiled, {
    exports,
    dependencyImport: (specifier) => dependency(specifier, "import"),
    require: (specifier) =>
      specifier === "react" ||
      specifier.startsWith("react/") ||
      specifier.startsWith("@babel/runtime/")
        ? requireDependency(specifier)
        : dependency(specifier, "require"),
  });
  return exports;
};
for (const directory of ["src", "dist"]) {
  test(`${directory}: native adapter import and absent token do not initialize either SDK; getters select stable adapters`, () => {
    const imports = [];
    const mapbox = {
      adapter: {
        backend: "mapbox-native",
      },
      setAccessToken: (token) => imports.push(`token:${token}`),
    };
    const maplibre = {
      adapter: {
        backend: "maplibre-native",
      },
    };
    const module = evaluate(directory, "engines.native.ts", (name) => {
      imports.push(name);
      if (name === "one-map-react/mapbox-native") return mapbox;
      if (name === "one-map-react/maplibre-native") return maplibre;
      throw new Error(`Unexpected native dependency: ${name}`);
    });
    expect(imports).toEqual([]);
    module.configureMapbox("");
    expect(imports).toEqual([]);
    expect(module.adapters.mapbox).toBe(mapbox.adapter);
    expect(module.adapters.mapbox).toBe(mapbox.adapter);
    expect(
      imports.every((value) => value === "one-map-react/mapbox-native")
    ).toBe(true);
    module.configureMapbox("pk.fixture");
    expect(imports).not.toContain("one-map-react/maplibre-native");
    expect(imports).toContain("token:pk.fixture");
    expect(module.adapters.maplibre).toBe(maplibre.adapter);
    expect(module.adapters.mapbox).toBe(mapbox.adapter);
  });
  test.each(["mapbox", "maplibre"])(
    `${directory}: native acceptance evaluates only selected %s scene and retires camera observation before switching`,
    async (engine) => {
      const imports = [];
      const steps = [];
      const sdkCameras = {
        mapbox: { esm: {}, cjs: {} },
        maplibre: { esm: {}, cjs: {} },
      };
      const module = evaluate(
        directory,
        "acceptance.native.tsx",
        (name, condition) => {
          imports.push(name);
          if (name === "react-native")
            return {
              Text: ({ children }) => createElement("span", null, children),
            };
          if (name === "./scenarios/tf10-camera-observer.js")
            return {
              observeAcceptanceCamera: (scenario, selected, cameras) => {
                if (scenario !== "tf09") return () => {};
                expect(Object.keys(cameras)).toEqual([selected]);
                expect(cameras[selected]).toBe(sdkCameras[selected].esm);
                steps.push(`observe:${selected}`);
                return () => {
                  steps.push(`retire:${selected}`);
                };
              },
            };
          if (name.startsWith("./scenarios/") && name.endsWith("-native.js")) {
            const selected = name.includes("mapbox") ? "mapbox" : "maplibre";
            return {
              __esModule: true,
              default: () => {
                steps.push(`scene:${selected}`);
                return createElement("div", null, selected);
              },
            };
          }
          if (
            name === "@rnmapbox/maps" ||
            name === "@maplibre/maplibre-react-native"
          )
            return {
              Camera:
                sdkCameras[name === "@rnmapbox/maps" ? "mapbox" : "maplibre"][
                  condition === "import" ? "esm" : "cjs"
                ],
            };
          throw new Error(`Unexpected acceptance dependency: ${name}`);
        }
      );
      expect(imports.filter((name) => name !== "react-native")).toEqual([
        "./scenarios/tf10-camera-observer.js",
      ]);
      let mounted;
      await act(async () => {
        mounted = render(
          createElement(module.NativeAcceptance, {
            engine,
            scenario: "tf08-storage",
          })
        );
      });
      expect(imports).not.toContain(
        engine === "mapbox"
          ? "./scenarios/maplibre-native.js"
          : "./scenarios/mapbox-native.js"
      );
      expect(imports).not.toContain("@rnmapbox/maps");
      expect(imports).not.toContain("@maplibre/maplibre-react-native");
      await act(async () => {
        mounted.rerender(
          createElement(module.NativeAcceptance, {
            engine,
            scenario: "tf09",
          })
        );
      });
      expect(imports).toContain(
        engine === "mapbox"
          ? "@rnmapbox/maps"
          : "@maplibre/maplibre-react-native"
      );
      const observeIndex = steps.indexOf(`observe:${engine}`);
      expect(steps.slice(observeIndex + 1)).toContain(`scene:${engine}`);
      const other = engine === "mapbox" ? "maplibre" : "mapbox";
      await act(async () => {
        mounted.rerender(
          createElement(module.NativeAcceptance, {
            engine: other,
            scenario: "tf09",
          })
        );
      });
      expect(steps.indexOf(`retire:${engine}`)).toBeLessThan(
        steps.indexOf(`observe:${other}`)
      );
      await act(async () => {
        mounted.unmount();
      });
      expect(steps.at(-1)).toBe(`retire:${other}`);
    }
  );

  test(`${directory}: a retired lazy scene cannot mount after its import settles`, async () => {
    const steps = [];
    let resolveMapbox;
    const pendingMapbox = new Promise((resolve) => {
      resolveMapbox = resolve;
    });
    const scene = (engine) => ({
      __esModule: true,
      default: () => {
        steps.push(`scene:${engine}`);
        return createElement("div", null, engine);
      },
    });
    const module = evaluate(directory, "acceptance.native.tsx", (name) => {
      if (name === "react-native")
        return {
          Text: ({ children }) => createElement("span", null, children),
        };
      if (name === "./scenarios/tf10-camera-observer.js")
        return {
          observeAcceptanceCamera: (_scenario, selected, cameras) => {
            expect(cameras[selected]).toBeDefined();
            steps.push(`observe:${selected}`);
            return () => {
              steps.push(`retire:${selected}`);
            };
          },
        };
      if (name === "./scenarios/mapbox-native.js") return pendingMapbox;
      if (name === "./scenarios/maplibre-native.js") return scene("maplibre");
      if (
        name === "@rnmapbox/maps" ||
        name === "@maplibre/maplibre-react-native"
      )
        return { Camera: {} };
      throw new Error(`Unexpected acceptance dependency: ${name}`);
    });
    let mounted;
    await act(async () => {
      mounted = render(
        createElement(module.NativeAcceptance, {
          engine: "mapbox",
          scenario: "tf09",
        })
      );
    });
    expect(mounted.getByText("Loading acceptance scenario…")).toBeDefined();
    await act(async () => {
      mounted.rerender(
        createElement(module.NativeAcceptance, {
          engine: "maplibre",
          scenario: "tf09",
        })
      );
    });
    await act(async () => {
      resolveMapbox(scene("mapbox"));
    });
    expect(steps).not.toContain("scene:mapbox");
    expect(steps.indexOf("retire:mapbox")).toBeLessThan(
      steps.indexOf("observe:maplibre")
    );
    expect(mounted.getByText("maplibre")).toBeDefined();
    await act(async () => {
      mounted.unmount();
    });
    expect(steps.at(-1)).toBe("retire:maplibre");
  });
  test.each(["resolve", "reject"])(
    `${directory}: a retired selected-camera import %s cannot attach an observer or scene`,
    async (settlement) => {
      const steps = [];
      let resolveCamera, rejectCamera;
      const pending = new Promise((resolve, reject) => {
        resolveCamera = resolve;
        rejectCamera = reject;
      });
      const module = evaluate(
        directory,
        "acceptance.native.tsx",
        (name, condition) => {
          if (name === "react-native")
            return {
              Text: ({ children }) => createElement("span", null, children),
            };
          if (name === "./scenarios/tf10-camera-observer.js")
            return {
              observeAcceptanceCamera: (_scenario, engine, cameras) => {
                expect(Object.keys(cameras)).toEqual([engine]);
                steps.push(`observe:${engine}`);
                return () => steps.push(`retire:${engine}`);
              },
            };
          if (name === "@rnmapbox/maps") {
            expect(condition).toBe("import");
            return pending;
          }
          if (name === "@maplibre/maplibre-react-native") {
            expect(condition).toBe("import");
            return { Camera: {} };
          }
          if (name.endsWith("-native.js")) {
            const selected = name.includes("mapbox") ? "mapbox" : "maplibre";
            return {
              __esModule: true,
              default: () => {
                steps.push(`scene:${selected}`);
                return createElement("div", null, selected);
              },
            };
          }
          throw new Error(`Unexpected dependency: ${name}`);
        }
      );
      let mounted;
      await act(async () => {
        mounted = render(
          createElement(module.NativeAcceptance, {
            engine: "mapbox",
            scenario: "tf09",
          })
        );
      });
      expect(steps).toEqual([]);
      await act(async () => {
        mounted.rerender(
          createElement(module.NativeAcceptance, {
            engine: "maplibre",
            scenario: "tf09",
          })
        );
      });
      await act(async () => {
        if (settlement === "resolve") resolveCamera({ Camera: {} });
        else rejectCamera(new Error("Retired SDK import failed"));
      });
      expect(steps).not.toContain("observe:mapbox");
      expect(steps).not.toContain("scene:mapbox");
      expect(mounted.getByText("maplibre")).toBeDefined();
      await act(async () => {
        mounted.unmount();
      });
      expect(steps.at(-1)).toBe("retire:maplibre");
    }
  );

  test(`${directory}: current camera import failure surfaces without mounting a scene`, async () => {
    class Boundary extends Component {
      state = { error: null };
      static getDerivedStateFromError = (error) => ({ error });
      render = () =>
        this.state.error
          ? createElement("p", null, String(this.state.error))
          : this.props.children;
    }
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    let mounted;
    try {
      const module = evaluate(
        directory,
        "acceptance.native.tsx",
        (name, condition) => {
          if (name === "react-native")
            return {
              Text: ({ children }) => createElement("span", null, children),
            };
          if (name === "./scenarios/tf10-camera-observer.js")
            return {
              observeAcceptanceCamera: () => {
                throw new Error("Observer must not attach");
              },
            };
          expect(name).toBe("@rnmapbox/maps");
          expect(condition).toBe("import");
          return Promise.reject(new Error("Selected camera import failed"));
        }
      );
      await act(async () => {
        mounted = render(
          createElement(
            Boundary,
            null,
            createElement(module.NativeAcceptance, {
              engine: "mapbox",
              scenario: "tf09",
            })
          )
        );
      });
      expect(mounted.getByText(/Selected camera import failed/)).toBeDefined();
    } finally {
      mounted?.unmount();
      errorLog.mockRestore();
    }
  });
}
