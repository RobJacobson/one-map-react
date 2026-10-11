const path = require("node:path");

const reactNativeRoot = path.dirname(require.resolve("react-native"));

const extensionlessImports = {
  "^(\\.{1,2}/.*)\\.js$": "$1",
};

module.exports = {
  projects: [
    {
      displayName: "web",
      testMatch: ["<rootDir>/packages/one-map-react/test/**/*.web.test.tsx"],
      testEnvironment: "jsdom",
      moduleNameMapper: extensionlessImports,
      transform: {
        "^.+\\.(js|ts|tsx)$": "babel-jest",
      },
    },
    {
      displayName: "native",
      preset: "@react-native/jest-preset",
      testMatch: ["<rootDir>/packages/one-map-react/test/**/*.native.test.tsx"],
      moduleNameMapper: {
        "^react-native/setup-env$": `${reactNativeRoot}/src/setup-env.js`,
        "^react-native($|/.*)": `${reactNativeRoot}/$1`,
        ...extensionlessImports,
      },
      transformIgnorePatterns: [
        "/node_modules/(?!.*(@react-native|react-native|@testing-library|test-renderer))",
      ],
    },
    {
      displayName: "unit",
      testMatch: ["<rootDir>/packages/one-map-react/test/**/*.test.ts"],
      testEnvironment: "node",
      moduleNameMapper: extensionlessImports,
      transform: {
        "^.+\\.(js|ts|tsx)$": "babel-jest",
      },
    },
  ],
};
