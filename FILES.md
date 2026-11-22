# Project files

```text
one-map/                         # Repository root (0)
├── packages/                    # Published library and shared example package (1)
│   ├── one-map-react/           # Native compatibility library (2)
│   │   ├── src/                 # Native adapters, contracts, and web exports (3)
│   │   ├── patches/             # Required exact-version native fixes (3)
│   │   └── test/                # Existing package tests; migrate to tests/ (3)
│   └── example-map/             # Shared application example (2)
│       └── reference/           # Vessel screen for all four entries (3)
├── apps/                        # Runnable example applications (1)
│   ├── web/                     # Browser example (2)
│   └── expo/                    # Native example (2)
├── tests/                       # Cross-package tests and fixtures (1)
├── docs/                        # Requirements, references, and acceptance policies (1)
├── scripts/                     # Development and verification tooling (1)
└── records/                     # Evidence and support-matrix records (1)
```

Follow the [coding style](https://github.com/RobJacobson/react-style-guide/blob/v0.1.0/coding-style.md) for new test placement and folder APIs. The `test/` branch above describes the current checkout.
