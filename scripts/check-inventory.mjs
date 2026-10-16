import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { expandInventory } from "./inventory-format.mjs";

const ownerExceptions = new Set([
  "rnmapbox:rnmapbox.offlineManager.OfflineManager.invalidateAmbientCache",
  "rnmapbox:rnmapbox.offlineManager.OfflineManager.setMaximumAmbientCacheSize",
]);

/** Checks current coverage identities, alias resolution, local targets and unresolved applicable work. */
export const checkInventory = (inventory, root) => {
  try {
    inventory = expandInventory(inventory);
  } catch (error) {
    return [error.message];
  }
  const failures = [];
  const entries = new Map();
  const fail = (entry, reason) => failures.push(`${entry.id}: ${reason}`);
  for (const entry of inventory.entries) {
    if (entries.has(entry.id)) fail(entry, "duplicate ID");
    entries.set(entry.id, entry);
  }
  for (const entry of inventory.entries) {
    const chain = new Set([entry.id]);
    let target = entry;
    while (target.canonicalId) {
      if (chain.has(target.canonicalId)) {
        fail(entry, "cyclic canonical alias");
        break;
      }
      chain.add(target.canonicalId);
      target = entries.get(target.canonicalId);
      if (!target) {
        fail(entry, "unresolved canonical alias");
        break;
      }
    }
    const applicable = Object.values(entry.support ?? {}).some(
      (cell) => cell.applicable
    );
    const excepted =
      ownerExceptions.has(entry.id) &&
      /owner.*exclu/i.test(entry.rationale ?? "");
    if (applicable && entry.implementation !== "implemented" && !excepted) {
      fail(entry, "unresolved applicable work without owner exception");
    }
    const tests = entry.testReferences ?? [];
    const evidence = entry.evidenceReferences ?? [];
    const sources = [
      ...(entry.implementationScope ?? "").matchAll(
        /(?:packages|scripts|examples)\/[\w./-]+/g
      ),
    ].map((match) => match[0].replace(/[.,;:]+$/, ""));
    for (const [kind, references] of [
      ["source", sources],
      ["test", tests],
      ["evidence", evidence],
    ]) {
      const current = references.filter(
        (reference) => !reference.startsWith("historical:")
      );
      if (
        entry.implementation === "implemented" &&
        applicable &&
        !current.length
      ) {
        fail(entry, `missing current ${kind} target`);
      }
      for (const reference of current) {
        const file = resolve(root, reference.split("#")[0]);
        if (!file.startsWith(`${resolve(root)}/`) || !existsSync(file)) {
          fail(entry, `missing current ${kind} target: ${reference}`);
        }
      }
    }
    for (const [environment, cell] of Object.entries(entry.support ?? {})) {
      for (const reference of [
        ...(cell.tests ?? []),
        ...(cell.evidence ?? []),
      ]) {
        if (
          !reference.startsWith("historical:") &&
          (!resolve(root, reference.split("#")[0]).startsWith(
            `${resolve(root)}/`
          ) ||
            !existsSync(resolve(root, reference.split("#")[0])))
        ) {
          fail(
            entry,
            `${environment} missing current support target: ${reference}`
          );
        }
      }
      if (
        entry.implementation === "implemented" &&
        cell.applicable &&
        cell.implementation !== "implemented"
      ) {
        fail(entry, `${environment} contradicts implemented disposition`);
      }
    }
  }
  return failures;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = resolve(import.meta.dirname, "..");
  const inventory = JSON.parse(
    readFileSync(resolve(root, "records/api-coverage.json"), "utf8")
  );
  const failures = checkInventory(inventory, root);
  if (failures.length) {
    console.error(failures.slice(0, 30).join("\n"));
    console.error(
      `FAIL inventory: ${failures.length} unresolved or invalid targets across ${inventory.entries.length} entries`
    );
    process.exitCode = 1;
  } else
    console.log(
      `PASS inventory: ${inventory.entries.length} substantiated dispositions`
    );
}
