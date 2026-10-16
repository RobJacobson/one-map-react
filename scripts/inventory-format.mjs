import { createHash } from "node:crypto";

const profileFields = [
  ["support", "supportProfile", "supportProfiles"],
  ["evidenceReferences", "evidenceProfile", "evidenceProfiles"],
];

/**
 * Deduplicates support and evidence without changing expanded inventory values.
 * @param inventory - Expanded schema-1 or compact schema-2 inventory.
 * @returns A schema-2 inventory with content-addressed support and evidence profiles.
 * @throws For invalid profiles or a hash collision with different content.
 */
export const compactInventory = (inventory) => {
  const expanded = expandInventory(inventory);
  const supportProfiles = {};
  const evidenceProfiles = {};
  const profiles = { supportProfiles, evidenceProfiles };
  const entries = expanded.entries.map((entry) => {
    const compact = { ...entry };
    for (const [field, reference, collection] of profileFields) {
      const value = entry[field];
      validateProfile(field, value);
      const serialized = canonicalJson(value);
      const id = `${field}-${createHash("sha256").update(serialized).digest("hex")}`;
      const previous = profiles[collection][id];
      if (previous !== undefined && canonicalJson(previous) !== serialized) {
        throw new Error(`Inventory profile hash collision: ${id}`);
      }
      if (previous === undefined)
        profiles[collection][id] = structuredClone(value);
      delete compact[field];
      compact[reference] = id;
    }
    return compact;
  });

  return { ...expanded, schemaVersion: 2, ...profiles, entries };
};

/**
 * Resolves schema-2 profiles into independently editable entries without mutating the input.
 * @param inventory - Schema-1 inventory, inline legacy fixture, or schema-2 inventory.
 * @returns The expanded schema-1 representation, retaining an omitted legacy version.
 * @throws For an unknown version, malformed profiles, or missing/ambiguous references.
 */
export const expandInventory = (inventory) => {
  if (!isRecord(inventory)) throw new Error("Inventory must be a record.");
  const version = inventory.schemaVersion ?? 1;
  if (version !== 1 && version !== 2) {
    throw new Error(`Unsupported inventory schema version: ${version}`);
  }
  if (!Array.isArray(inventory.entries)) {
    throw new Error("Inventory entries must be an array.");
  }
  if (version === 2) {
    for (const [field, , collection] of profileFields) {
      if (!isRecord(inventory[collection])) {
        throw new Error(`Inventory ${collection} must be a record.`);
      }
      for (const value of Object.values(inventory[collection])) {
        validateProfile(field, value);
      }
    }
  }
  const entries = inventory.entries.map((entry) => {
    if (!isRecord(entry)) throw new Error("Inventory entry must be a record.");
    const expanded = { ...entry };
    for (const [field, reference, collection] of profileFields) {
      if (version === 1 && !Object.hasOwn(entry, reference)) continue;
      if (version !== 2 || Object.hasOwn(entry, field)) {
        throw new Error(`${entry.id}: ambiguous or unexpected ${reference}`);
      }
      const id = entry[reference];
      if (typeof id !== "string" || !Object.hasOwn(inventory[collection], id)) {
        throw new Error(`${entry.id}: missing ${reference}: ${id}`);
      }
      // Schema 1 parsed each entry independently; editing one must not change its peers or the compact input.
      expanded[field] = structuredClone(inventory[collection][id]);
      delete expanded[reference];
    }
    return expanded;
  });
  const {
    supportProfiles: _support,
    evidenceProfiles: _evidence,
    ...metadata
  } = inventory;
  return {
    ...metadata,
    ...(inventory.schemaVersion === undefined ? {} : { schemaVersion: 1 }),
    entries,
  };
};

const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isReferences = (value) =>
  Array.isArray(value) &&
  value.every((reference) => typeof reference === "string");

const validateProfile = (field, value) => {
  if (field === "evidenceReferences") {
    if (!isReferences(value))
      throw new Error("Inventory evidence profile must be a string array.");
    return;
  }
  if (
    !isRecord(value) ||
    !Object.values(value).every(
      (cell) =>
        isRecord(cell) &&
        typeof cell.applicable === "boolean" &&
        (cell.tests === undefined || isReferences(cell.tests)) &&
        (cell.evidence === undefined || isReferences(cell.evidence))
    )
  ) {
    throw new Error(
      "Inventory support profile must contain valid environment records."
    );
  }
};

const canonicalJson = (value) => JSON.stringify(canonicalValue(value));

const canonicalValue = (value) => {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalValue(value[key])])
  );
};
