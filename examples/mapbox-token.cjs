const fs = require("node:fs");
const path = require("node:path");

// Shell value first, then this example's .env, then the repository .env.
// The public token is injected into the local bundle and is not stored in source.
const readMapboxAccessToken = (exampleRoot, env = process.env) => {
  const fromShell = env.MAPBOX_ACCESS_TOKEN?.trim();

  if (fromShell) return fromShell;

  const repoRoot = path.resolve(exampleRoot, "../..");
  const envPaths = [
    path.join(exampleRoot, ".env"),
    path.join(repoRoot, ".env"),
  ];

  for (const envPath of envPaths) {
    const fromFile = readEnvAssignment(envPath, "MAPBOX_ACCESS_TOKEN");

    if (fromFile) return fromFile;
  }

  return "";
};

const readEnvAssignment = (envPath, name) => {
  if (!fs.existsSync(envPath)) return "";

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const value = assignmentValue(line, name);

    if (value) return value;
  }

  return "";
};

const assignmentValue = (line, name) => {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith("#")) return "";

  const separator = trimmed.indexOf("=");

  if (separator === -1) return "";

  const key = trimmed
    .slice(0, separator)
    .trim()
    .replace(/^export\s+/, "");

  if (key !== name) return "";

  return unquoteEnvValue(trimmed.slice(separator + 1).trim());
};

const unquoteEnvValue = (value) => {
  const comment = value.indexOf(" #");
  const bare = (comment === -1 ? value : value.slice(0, comment)).trim();
  const quoted =
    (bare.startsWith('"') && bare.endsWith('"')) ||
    (bare.startsWith("'") && bare.endsWith("'"));

  if (quoted) return bare.slice(1, -1).trim();

  return bare;
};

module.exports = { readMapboxAccessToken };
