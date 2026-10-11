const { readMapboxAccessToken } = require("../mapbox-token.cjs");
const inlineSmokeTarget = require("../inline-smoke-target.cjs");

const exampleRoot = __dirname;

const isMapboxAccessToken = (node) => {
  if (node.type !== "MemberExpression" || node.computed) return false;
  if (node.property.type !== "Identifier") return false;
  if (node.property.name !== "MAPBOX_ACCESS_TOKEN") return false;

  const env = node.object;

  if (env.type !== "MemberExpression" || env.computed) return false;
  if (env.property.type !== "Identifier" || env.property.name !== "env") {
    return false;
  }

  return env.object.type === "Identifier" && env.object.name === "process";
};

// Metro does not pass shell variables into the device bundle.
// This replaces process.env.MAPBOX_ACCESS_TOKEN while the bundle is built.
const inlineMapboxAccessToken = ({ types: t }) => ({
  name: "inline-mapbox-access-token",
  visitor: {
    MemberExpression: (nodePath) => {
      if (!isMapboxAccessToken(nodePath.node)) return;

      const token = readMapboxAccessToken(exampleRoot);

      nodePath.replaceWith(t.stringLiteral(token));
    },
  },
});

module.exports = {
  presets: ["module:@react-native/babel-preset"],
  plugins: [inlineMapboxAccessToken, inlineSmokeTarget],
};
