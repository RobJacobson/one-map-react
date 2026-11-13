const isEnvRead = (node, name) => {
  if (node.type !== "MemberExpression" || node.computed) return false;
  if (node.property.type !== "Identifier") return false;
  if (node.property.name !== name) return false;

  const env = node.object;

  if (env.type !== "MemberExpression" || env.computed) return false;
  if (env.property.type !== "Identifier" || env.property.name !== "env") {
    return false;
  }

  return env.object.type === "Identifier" && env.object.name === "process";
};

// Metro does not pass shell variables into the device bundle.
// This replaces TF05_BASE and TF06_BASE while
// the bundle is built.
const inlineFixtureBase = ({ types: t }) => ({
  name: "inline-fixture-base",
  visitor: {
    MemberExpression: (nodePath) => {
      if (isEnvRead(nodePath.node, "TF05_BASE")) {
        nodePath.replaceWith(
          t.stringLiteral(process.env.TF05_BASE ?? "http://127.0.0.1:8798")
        );
      }

      if (isEnvRead(nodePath.node, "TF06_BASE")) {
        nodePath.replaceWith(
          t.stringLiteral(process.env.TF06_BASE ?? "http://127.0.0.1:8798")
        );
      }
    },
  },
});

module.exports = inlineFixtureBase;
