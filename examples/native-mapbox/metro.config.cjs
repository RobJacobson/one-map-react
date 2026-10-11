const path = require("node:path");
const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");

const { shellMetroResolver } = require("../resolve-shell-deps.cjs");

const config = {
  watchFolders: [
    path.resolve(__dirname, "../../packages/one-map-react"),
    path.resolve(__dirname, "../shared"),
    path.resolve(__dirname, "../../tests/fixtures"),
  ],
  resolver: shellMetroResolver(__dirname),
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
