# Project files

```text
one-map/                         # Repository root (0)
├── .github/                     # GitHub repository configuration (1)
│   └── workflows/              # Pull request validation (2)
│       └── validate.yml         # Runs the workspace validation command (3)
├── packages/                    # Published library and shared example package (1)
│   ├── one-map-react/           # Native compatibility library (2)
│   │   ├── src/                 # Native adapters, contracts, and web exports (3)
│   │   ├── patches/             # Required exact-version native fixes (3)
│   │   └── test/                # Package unit and component tests (3)
│   └── example-map/             # Shared application example (2)
│       ├── reference/           # Vessel screen for all four entries (3)
│       ├── src/                 # Shared screens and acceptance scenarios (3)
│       └── test/                # Shared example tests (3)
├── apps/                        # Runnable example applications (1)
│   ├── web/                     # Browser example (2)
│   │   ├── src/                 # Vite app and basemap controls (3)
│   │   └── tests/               # Browser example navigation tests (3)
│   └── expo/                    # Native example (2)
├── tests/                       # Cross-package checks and fixtures (1)
│   ├── example/                 # Example configuration and scenario checks (2)
│   ├── fixtures/                # Shared map fixture notes (2)
│   ├── package/                 # Packed archive and consumer checks (2)
│   └── peers/                   # Installed native wrapper regressions (2)
│       ├── fixtures/            # Native layer regression programs (3)
│       └── kotlin-regression.ts # Compiler runner for extracted peer methods (3)
├── docs/                        # Library boundary and testing policy (1)
└── scripts/                     # Build plugins and the documentation check (1)
```

Follow the [coding style](https://github.com/RobJacobson/react-style-guide/blob/v0.1.0/coding-style.md) for new test placement and folder APIs. The `test/` branch above describes the current checkout.
