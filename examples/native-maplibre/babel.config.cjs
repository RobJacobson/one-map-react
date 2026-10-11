const inlineSmokeTarget = require("../inline-smoke-target.cjs");

module.exports = {
  presets: ["module:@react-native/babel-preset"],
  plugins: [inlineSmokeTarget],
};
