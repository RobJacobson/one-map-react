import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const documents = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return documents(join(directory, entry.name));
    if (entry.name.endsWith(".md")) return [join(directory, entry.name)];

    return [];
  });

const files = documents("docs");
const failures = [];

const fail = (file, line, message) =>
  failures.push(`${file}:${line}: ${message}`);

const headingId = (text) =>
  text
    .toLowerCase()
    .replace(/<[^>]*>/g, "")
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");

const anchors = new Map(
  files.map((file) => {
    const counts = new Map();
    const ids = new Set();
    let fence;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
      if (marker) {
        if (!fence) {
          fence = marker;
        } else if (marker[0] === fence[0] && marker.length >= fence.length) {
          fence = undefined;
        }
        continue;
      }
      if (fence) continue;
      const title = /^#{1,6}\s+(.+?)\s*#*$/.exec(line)?.[1];
      if (!title) continue;
      const id = headingId(title);
      const count = counts.get(id) ?? 0;
      counts.set(id, count + 1);
      ids.add(count ? `${id}-${count}` : id);
    }

    return [resolve(file), ids];
  })
);

let comparisonTables = 0;
for (const file of files) {
  const lines = readFileSync(file, "utf8").split("\n");
  let fence;
  let previousProse = false;
  for (const [index, line] of lines.entries()) {
    const number = index + 1;
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
    if (marker) {
      if (!fence) {
        fence = marker;
      } else if (marker[0] === fence[0] && marker.length >= fence.length) {
        fence = undefined;
      }
      previousProse = false;
      continue;
    }
    if (fence) continue;
    if (/ {2,}$|\\$|<br\s*\/?\s*>/i.test(line.replace(/`+[^`]*`+/g, ""))) {
      fail(file, number, "Forced prose line break.");
    }
    const structural =
      /^\s*(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|\||>|\[[^\]]+\]:|<!--|-->|[-*_]{3,}\s*$)/.test(
        line
      );
    const prose = Boolean(line.trim()) && !structural;
    if (prose && previousProse) {
      fail(
        file,
        number,
        "Wrapped paragraph or missing blank line between paragraphs."
      );
    }
    previousProse = prose;
    if (
      line.startsWith("|") &&
      line.includes("RNMapbox") &&
      line.includes("react-map-gl")
    ) {
      const columns = line
        .split("|")
        .slice(1, -1)
        .map((value) => value.trim());
      const expected = [
        "RNMapbox",
        "MapLibre React Native",
        "react-map-gl",
        "Proposed one-map-react API",
      ];
      if (JSON.stringify(columns) !== JSON.stringify(expected)) {
        fail(
          file,
          number,
          "SDK comparison must use the four specified columns in order."
        );
      }
      comparisonTables++;
    }
    for (const match of line.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1].replace(/^<|>$/g, "");
      if (/^[a-z][a-z\d+.-]*:/i.test(target)) continue;
      const [path, fragment] = target.split("#");
      const destination = path
        ? resolve(dirname(file), decodeURIComponent(path))
        : resolve(file);
      if (!existsSync(destination)) {
        fail(file, number, `Missing local link target ${target}.`);
      } else if (
        fragment &&
        destination.endsWith(".md") &&
        !anchors.get(destination)?.has(decodeURIComponent(fragment))
      ) {
        fail(file, number, `Missing local heading ${target}.`);
      }
    }
  }
  if (fence) fail(file, lines.length, "Unclosed fenced block.");
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `PASS documentation structure: ${files.length} Markdown files, ${comparisonTables} SDK comparison tables, paragraphs, fences and local links.`
  );
  console.log(
    "SCOPE: structural checks only. Source accuracy, equivalent examples, terminology, contract status and editorial quality require recorded review."
  );
}
