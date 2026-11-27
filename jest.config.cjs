const path = require("node:path");

const reactNativeRoot = path.dirname(require.resolve("react-native"));
const compiled = process.env.ONE_MAP_COMPILED_TESTS === "1";

const extensionlessImports = {
  "^(\\.{1,2}/.*)\\.js$": "$1",
};

/** Keeps native mocks and scenarios identical while loading the published code. */
const compiledImports = compiled
  ? {
      "^\\.\\./src/(.*)\\.js$": "<rootDir>/packages/one-map-react/dist/$1.js",
    }
  : {};

module.exports = {
  projects: [
    {
      displayName: compiled ? "compiled-native" : "native",
      preset: "@react-native/jest-preset",
      setupFilesAfterEnv: [
        "<rootDir>/packages/one-map-react/test/setup-native.ts",
      ],
      testMatch: ["<rootDir>/packages/one-map-react/test/**/*.native.test.tsx"],
      moduleNameMapper: {
        ...compiledImports,
        "^react-native-teleport$":
          require.resolve("react-native-teleport/jest"),
        "^react-native/setup-env$": `${reactNativeRoot}/src/setup-env.js`,
        "^react-native($|/.*)": `${reactNativeRoot}/$1`,
        ...extensionlessImports,
      },
      transformIgnorePatterns: [
        "/node_modules/(?!.*(@react-native|react-native|@testing-library|test-renderer|@rnmapbox/maps/lib/module/utils/))",
      ],
    },
  ],
};
