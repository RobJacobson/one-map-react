import type { MapServices } from "../contracts/adapter.js";
import { useSetupServices } from "./map-setup.js";

/**
 * Reads selected app-level services without requiring a mounted Map.
 * @returns Stable services under MapSetup; reading starts no acquisition.
 * @throws When called outside MapSetup.
 */
export const useMapServices = (): MapServices => useSetupServices();
