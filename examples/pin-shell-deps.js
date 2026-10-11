import path from "node:path";

/**
 * Resolves bare imports from files outside a Vite shell through that shell's
 * `node_modules`, including `examples/shared`.
 *
 * @param {string} shellRoot - Example directory that owns the install.
 * @returns {import("vite").Plugin} Vite plugin.
 */
export const pinBareImportsToShell = (shellRoot) => ({
  name: "pin-bare-imports-to-shell",
  resolveId(id, importer, options) {
    if (id.startsWith("\0") || id.startsWith(".") || path.isAbsolute(id)) {
      return null;
    }

    if (importer?.startsWith(shellRoot)) {
      return null;
    }

    return this.resolve(id, path.join(shellRoot, "package.json"), {
      ...options,
      skipSelf: true,
    });
  },
});
