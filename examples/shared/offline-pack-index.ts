/** One persisted native pack, read without modifying its metadata or identity. */
export interface PersistedOfflinePack {
  /** RNMapbox name or generated MapLibre ID, used for SDK operations. */
  readonly nativeId: string;
  /** Original metadata, including malformed values for diagnosis. */
  readonly metadata: unknown;
}

/** Application lookup information; issues never cause a persisted pack to disappear. */
export interface OfflinePackRecord extends PersistedOfflinePack {
  /** Previous facade ID, new application region ID, or imported backend alias. */
  readonly id: string;
  /** Historical imported identity, retained even for application-owned packs. */
  readonly alias: string;
  /** Previous envelope's user metadata or the new application metadata. */
  readonly user: unknown;
  /** Malformed metadata or ambiguous identities that require owner attention. */
  readonly issues: readonly string[];
}

/**
 * Reads legacy and application metadata without writing to the native database.
 *
 * @param packs - Enumerated native names/IDs and their untouched metadata.
 * @returns Every persisted record, including malformed and duplicate identities.
 */
export const readOfflinePackIndex = (
  packs: readonly PersistedOfflinePack[]
): readonly OfflinePackRecord[] => {
  const records = packs.map((pack): OfflinePackRecord => {
    const alias = `backend:${pack.nativeId}`;
    let id = alias;
    let user: unknown = pack.metadata;
    const issues: string[] = [];

    try {
      if (!pack.nativeId.trim())
        throw new Error("Missing native pack identity.");
      const metadata: unknown =
        typeof pack.metadata === "string"
          ? JSON.parse(pack.metadata)
          : pack.metadata;
      if (!isObject(metadata)) throw new Error("Invalid offline metadata.");
      user = metadata;

      if (Object.hasOwn(metadata, "oneMapReactOffline")) {
        const envelope = metadata.oneMapReactOffline;
        if (
          !isObject(envelope) ||
          envelope.version !== 1 ||
          !isIdentity(envelope.id) ||
          !isObject(metadata.user)
        ) {
          throw new Error("Invalid legacy offline metadata.");
        }
        id = envelope.id;
        user = metadata.user;
      } else if (Object.hasOwn(metadata, "regionId")) {
        if (!isIdentity(metadata.regionId))
          throw new Error("Invalid application offline identity.");
        id = metadata.regionId;
      }
    } catch (error) {
      issues.push(error instanceof Error ? error.message : String(error));
    }

    return { ...pack, id, alias, user, issues };
  });

  return records.map((record) => ({
    ...record,
    issues: [
      ...record.issues,
      ...(records.some(
        (other) =>
          other !== record &&
          (other.nativeId === record.nativeId ||
            other.id === record.id ||
            other.id === record.alias ||
            other.alias === record.id)
      )
        ? ["Ambiguous offline pack identity."]
        : []),
    ],
  }));
};

/**
 * Resolves an application identity or historical alias without guessing.
 *
 * @param records - Read-only native enumeration results.
 * @param id - Stored application ID or backend alias.
 * @returns The unambiguous record, or undefined when absent.
 * @throws When matching metadata is malformed or identities collide.
 */
export const findOfflinePack = (
  records: readonly OfflinePackRecord[],
  id: string
): OfflinePackRecord | undefined => {
  const matches = records.filter(
    (record) => record.id === id || record.alias === id
  );
  if (matches.length > 1 || matches.some((record) => record.issues.length))
    throw new Error("Offline pack lookup requires resolving metadata issues.");
  return matches[0];
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isIdentity = (value: unknown): value is string =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  !value.startsWith("backend:");
