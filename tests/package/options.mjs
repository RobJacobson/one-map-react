import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Reads the optional frozen archive and exact peer-version overrides. */
export const packageCheckOptions = (args = process.argv.slice(2)) => {
  const options = { archive: undefined, versions: {}, evidence: undefined };
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    assert(value, `Missing value for ${flag}`);
    assert(
      ["--archive", "--versions", "--evidence"].includes(flag),
      `Unknown option: ${flag}`
    );
    const file = resolve(value);
    if (flag === "--evidence") {
      options.evidence = file;
      continue;
    }
    assert(existsSync(file), `Missing ${flag} file: ${file}`);
    if (flag === "--archive") options.archive = file;
    else {
      options.versions = JSON.parse(readFileSync(file, "utf8"));
      const sets = Object.values(options.versions).some(
        (value) => typeof value === "object"
      )
        ? Object.values(options.versions)
        : [options.versions];
      for (const versions of sets)
        for (const [name, version] of Object.entries(versions)) {
          assert.match(
            version,
            /^\d+\.\d+\.\d+$/,
            `${name} must use an exact stable version`
          );
        }
    }
  }
  return options;
};

/** Substitutes exact peer versions while retaining each check's package set. */
export const selectedVersions = (packages, versions, entry = "common") => {
  const selected = Object.values(versions).some(
    (value) => typeof value === "object"
  )
    ? { ...versions.default, ...versions[entry] }
    : versions;
  return packages.map((specifier) => {
    const boundary = specifier.lastIndexOf("@");
    const name = specifier.slice(0, boundary);
    return selected[name] ? `${name}@${selected[name]}` : specifier;
  });
};
