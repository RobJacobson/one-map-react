import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import process from "node:process";

/**
 * Resolves the runner for extracted peer methods before preparing Kotlin sources.
 *
 * @returns A compiler runner, or undefined for an unconfigured local run.
 * @throws If CI has no configured compiler.
 */
export const getKotlinRunner = (): KotlinRunner | undefined => {
  const compiler = process.env.ONE_MAP_KOTLINC;
  if (!compiler) {
    assert.notEqual(
      process.env.CI,
      "true",
      "ONE_MAP_KOTLINC is required in CI"
    );
    console.log("SKIP Kotlin regression: ONE_MAP_KOTLINC is unset.");
    return undefined;
  }

  return (sources, jar, args = []) => {
    run(
      compiler,
      [...sources, "-include-runtime", "-d", jar],
      "Kotlin compilation"
    );
    process.stdout.write(
      run("java", ["-jar", jar, ...args], "Kotlin execution")
    );
  };
};

/**
 * Compiles and runs a Kotlin program.
 *
 * @param sources - Kotlin source files that contain one main function.
 * @param jar - Output path inside the caller's temporary directory.
 * @param args - Arguments passed to the compiled main function.
 * @throws If compilation or execution fails.
 */
type KotlinRunner = (
  sources: readonly string[],
  jar: string,
  args?: readonly string[]
) => void;

const run = (command: string, args: readonly string[], operation: string) => {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout: 60_000,
  });
  if (result.error) throw result.error;
  assert.equal(
    result.status,
    0,
    `${operation} failed:\n${result.stdout}\n${result.stderr}`
  );
  return result.stdout;
};
