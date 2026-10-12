import { createContext, type ReactNode, useContext } from "react";

import type { Adapter } from "../contracts/adapter.js";

const AdapterContext = createContext<Adapter | null>(null);

/**
 * Props for {@link MapSetup}.
 */
export interface MapSetupProps {
  /** Selected adapter from an explicit package entry. */
  readonly adapter: Adapter;
  /** Shared map tree that reads this adapter. */
  readonly children?: ReactNode;
}

/**
 * Places the selected adapter on React context for shared map components.
 *
 * @param props - Adapter and the map tree that uses it.
 */
export const MapSetup = ({ adapter, children }: MapSetupProps) => (
  <AdapterContext.Provider value={adapter}>{children}</AdapterContext.Provider>
);

/**
 * Returns the adapter from the enclosing {@link MapSetup}.
 *
 * @returns The selected adapter.
 * @throws When `Map`, `Source`, or `Layer` render outside `MapSetup`.
 */
export const useSelectedAdapter = (): Adapter => {
  const adapter = useContext(AdapterContext);

  if (!adapter) {
    throw new Error(
      "Map, Source, and Layer must render inside MapSetup with a selected adapter."
    );
  }

  return adapter;
};
