const source = require("./jest.config.cjs");

/** Keeps native mocks and scenarios identical while loading the published code. */
module.exports = {
  ...source,
  projects: source.projects.map((project) => ({
    ...project,
    displayName: "compiled-native",
    moduleNameMapper: {
      "^\\.\\./src/(.*)\\.js$": "<rootDir>/packages/one-map-react/dist/$1.js",
      ...project.moduleNameMapper,
    },
  })),
};
