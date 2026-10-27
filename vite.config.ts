import { fileURLToPath } from "node:url";

import { defineConfig } from "vite-plus";

import { wrapperSourceRoots } from "./scripts/wrapper-source-roots.mjs";

export default defineConfig({
  fmt: {
    printWidth: 80,
    tabWidth: 2,
    useTabs: false,
    singleQuote: false,
    jsxSingleQuote: false,
    semi: true,
    trailingComma: "es5",
    arrowParens: "always",
    sortPackageJson: false,
    sortImports: {
      groups: [
        ["builtin", "bun-runtime"],
        "external",
        ["internal", "subpath"],
        ["parent", "sibling", "index"],
        "unknown",
      ],
      customGroups: [
        { groupName: "bun-runtime", elementNamePattern: ["bun", "bun:*"] },
      ],
      newlinesBetween: true,
    },
    ignorePatterns: [
      "**/node_modules/**",
      "**/dist/**",
      "**/artifacts/**",
      "**/coverage/**",
      "**/.agents/**",
      "**/.codex/**",
      "**/bun.lock",
      "records/**",
      "examples/*/ios/**",
      "examples/*/android/**",
      "**/*.md",
    ],
  },
  lint: {
    plugins: ["typescript", "unicorn", "oxc", "react", "jsx-a11y"],
    jsPlugins: [
      { name: "vite-plus", specifier: "vite-plus/oxlint-plugin" },
      "./scripts/lint-rules.mjs",
    ],
    // Preserve all four explicit TypeScript projects in the typecheck script.
    options: { typeAware: false, typeCheck: false },
    categories: { correctness: "error" },
    env: { browser: true, node: true, jest: true },
    ignorePatterns: [
      "**/node_modules/**",
      "**/dist/**",
      "**/artifacts/**",
      "**/coverage/**",
      "**/.agents/**",
      "**/.codex/**",
      "records/**",
      "examples/*/ios/**",
      "examples/*/android/**",
    ],
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      "react/refs": "warn",
      "react/immutability": "warn",
      "react/globals": "warn",
      "react/set-state-in-effect": "warn",
      "react/use-memo": "warn",
      "unicorn/no-new-array": "warn",
      "unicorn/no-useless-spread": "warn",
      "eslint/prefer-arrow-callback": "error",
      "eslint/arrow-body-style": ["error", "as-needed"],
      "eslint/prefer-const": ["error", { ignoreReadBeforeAssign: true }],
      "typescript/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports",
          disallowTypeAnnotations: false,
        },
      ],
      "eslint/no-unused-vars": [
        "warn",
        {
          ignoreRestSiblings: true,
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "eslint/eqeqeq": ["error", "always", { null: "ignore" }],
      "one-map/use-arrow-functions": "error",
      "one-map/no-shadow-language-globals": "error",
      "react/rules-of-hooks": "error",
      "react/exhaustive-deps": "warn",
      "react/no-array-index-key": "warn",
      "oxc/no-accumulating-spread": "warn",
      "typescript/no-explicit-any": "error",
      "typescript/no-non-null-assertion": "error",
    },
  },
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: [
            "packages/one-map-react/test/**/*.test.ts",
            "packages/example-map/test/**/*.test.ts",
          ],
          environment: "node",
        },
      },
      {
        // Computed SDK imports must also load when linked outside this checkout.
        server: {
          fs: {
            allow: [
              fileURLToPath(new URL(".", import.meta.url)),
              ...wrapperSourceRoots,
            ],
          },
        },
        resolve: {
          alias: [
            {
              find: /^one-map-react$/,
              replacement: fileURLToPath(
                new URL(
                  "./packages/one-map-react/src/index.ts",
                  import.meta.url
                )
              ),
            },
          ],
        },
        test: {
          name: "web",
          include: [
            "packages/one-map-react/test/**/*.web.test.tsx",
            "packages/example-map/test/**/*.web.test.tsx",
          ],
          environment: "jsdom",
          setupFiles: ["./packages/one-map-react/test/setup-web.ts"],
        },
      },
    ],
  },
});
