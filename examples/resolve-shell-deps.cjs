const path = require("node:path");

/**
 * Metro resolver settings so files outside a shell, including
 * `examples/shared`, load packages from that shell's `node_modules`.
 *
 * @param {string} shellRoot - Example directory that owns the install.
 * @returns {object} Metro `resolver` fragment.
 */
/**
 * Resolves a module with the shell's Metro resolver.
 *
 * @param {string} shellRoot
 * @param {object} context
 * @param {string} moduleName
 * @param {string} platform
 */
const resolveModule = (shellRoot, context, moduleName, platform) => {
  const { resolve } = require(require.resolve("metro-resolver", {
    paths: [shellRoot],
  }));

  return resolve(context, moduleName, platform);
};

const shellMetroResolver = (shellRoot) => ({
  disableHierarchicalLookup: true,
  nodeModulesPaths: [path.resolve(shellRoot, "node_modules")],
  // TypeScript sources are imported with the `.js` extension NodeNext emits.
  // Metro otherwise looks for that exact file.
  resolveRequest: (context, moduleName, platform) => {
    try {
      return resolveModule(shellRoot, context, moduleName, platform);
    } catch (error) {
      if (!moduleName.endsWith(".js")) {
        throw error;
      }

      const stem = moduleName.slice(0, -3);

      try {
        return resolveModule(shellRoot, context, `${stem}.tsx`, platform);
      } catch {
        try {
          return resolveModule(shellRoot, context, `${stem}.ts`, platform);
        } catch {
          throw error;
        }
      }
    }
  },
});

module.exports = { shellMetroResolver };
