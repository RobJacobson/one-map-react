const isSmokeTarget = (node) => {
  if (node.type !== "MemberExpression" || node.computed) return false;
  if (node.property.type !== "Identifier") return false;
  if (node.property.name !== "ONE_MAP_SMOKE") return false;

  const env = node.object;

  if (env.type !== "MemberExpression" || env.computed) return false;
  if (env.property.type !== "Identifier" || env.property.name !== "env") {
    return false;
  }

  return env.object.type === "Identifier" && env.object.name === "process";
};

// Metro does not pass shell variables into the device bundle.
// This replaces process.env.ONE_MAP_SMOKE while the bundle is built.
const inlineSmokeTarget = ({ types: t }) => ({
  name: "inline-smoke-target",
  visitor: {
    MemberExpression: (nodePath) => {
      if (!isSmokeTarget(nodePath.node)) return;

      const target = process.env.ONE_MAP_SMOKE === "tf04" ? "tf04" : "tf03";

      nodePath.replaceWith(t.stringLiteral(target));
    },
  },
});

module.exports = inlineSmokeTarget;
