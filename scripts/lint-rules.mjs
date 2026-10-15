import { definePlugin, defineRule } from "vite-plus/lint/plugins";

// Language globals only: host names such as `event` and `status` remain usable.
const languageGlobals = new Set(
  `Array ArrayBuffer AsyncDisposableStack Atomics BigInt BigInt64Array
  BigUint64Array Boolean DataView Date DisposableStack Error EvalError
  FinalizationRegistry Float16Array Float32Array Float64Array Function
  Int8Array Int16Array Int32Array Intl Iterator JSON Map Math Number Object
  Promise Proxy RangeError ReferenceError Reflect RegExp Set SharedArrayBuffer
  String SuppressedError Symbol SyntaxError Temporal TypeError URIError
  Uint8Array Uint8ClampedArray Uint16Array Uint32Array WeakMap WeakRef WeakSet
  decodeURI decodeURIComponent encodeURI encodeURIComponent escape isFinite
  isNaN parseFloat parseInt unescape`.split(/\s+/)
);

export default definePlugin({
  meta: { name: "one-map" },
  rules: {
    "use-arrow-functions": defineRule({
      meta: {
        messages: { arrow: "Use an arrow function for this expression." },
      },
      create: (context) => ({
        FunctionExpression: (node) => {
          const parent = node.parent;
          if (
            node.id ||
            node.generator ||
            parent.type === "MethodDefinition" ||
            (parent.type === "Property" &&
              (parent.method || parent.kind !== "init")) ||
            node.params.some((parameter) => parameter.name === "this") ||
            usesFunctionBindings(node, context.sourceCode.visitorKeys)
          )
            return;
          context.report({ node, messageId: "arrow" });
        },
      }),
    }),
    "no-shadow-language-globals": defineRule({
      meta: {
        messages: { shadow: 'Do not shadow the language global "{{name}}".' },
      },
      create: (context) => ({
        "Program:exit": () => {
          const reported = new WeakSet();
          for (const scope of context.sourceCode.scopeManager.scopes) {
            for (const variable of scope.variables) {
              if (!languageGlobals.has(variable.name)) continue;
              for (const identifier of variable.identifiers) {
                if (
                  [
                    "TSInterfaceDeclaration",
                    "TSTypeAliasDeclaration",
                    "TSTypeParameter",
                  ].includes(identifier.parent.type)
                )
                  continue;
                if (reported.has(identifier)) continue;
                reported.add(identifier);
                context.report({
                  node: identifier,
                  messageId: "shadow",
                  data: { name: variable.name },
                });
              }
            }
          }
        },
      }),
    }),
  },
});

// Nested ordinary functions own their bindings; nested arrows inherit them.
const usesFunctionBindings = (node, visitorKeys) =>
  (visitorKeys[node.type] ?? []).some((key) => {
    const children = Array.isArray(node[key]) ? node[key] : [node[key]];
    return children.some((child) => {
      if (!child) return false;
      if (
        child.type === "ThisExpression" ||
        (child.type === "Identifier" &&
          child.name === "arguments" &&
          !isPropertyName(child))
      )
        return true;
      if (["FunctionExpression", "FunctionDeclaration"].includes(child.type))
        return false;
      return usesFunctionBindings(child, visitorKeys);
    });
  });

const isPropertyName = (node) => {
  const parent = node.parent;
  return (
    !parent.computed &&
    ((parent.type === "MemberExpression" && parent.property === node) ||
      (parent.type === "Property" && !parent.shorthand && parent.key === node))
  );
};
