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

const smokeTarget = () => {
  if (process.env.ONE_MAP_SMOKE === "tf07") return "tf07";
  if (process.env.ONE_MAP_SMOKE === "tf06-lifetimes") return "tf06-lifetimes";
  if (process.env.ONE_MAP_SMOKE === "tf06") return "tf06";
  if (process.env.ONE_MAP_SMOKE === "tf05") return "tf05";
  if (process.env.ONE_MAP_SMOKE === "tf04") return "tf04";

  return "tf03";
};

// Metro does not pass shell variables into the device bundle.
// This replaces process.env.ONE_MAP_SMOKE, TF05_BASE and TF06_BASE while
// the bundle is built.
const inlineSmokeTarget = ({ types: t }) => ({
  name: "inline-smoke-target",
  visitor: {
    MemberExpression: (nodePath) => {
      if (isEnvRead(nodePath.node, "ONE_MAP_SMOKE")) {
        nodePath.replaceWith(t.stringLiteral(smokeTarget()));
        return;
      }

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

module.exports = inlineSmokeTarget;
