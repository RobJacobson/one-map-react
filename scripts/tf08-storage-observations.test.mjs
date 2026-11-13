import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";

const temporary = mkdtempSync(join(tmpdir(), "one-map-storage-observations-"));
const original = join(temporary, "original.db");
const destination = join(temporary, "destination.db");
const prepare = String.raw`
import sqlite3,sys,shutil
from pathlib import Path
original,target=map(Path,sys.argv[1:3]);fault=sys.argv[3]
if not original.exists():
 c=sqlite3.connect(original)
 c.executescript('''
 CREATE TABLE regions(id INTEGER PRIMARY KEY AUTOINCREMENT,definition TEXT NOT NULL,description BLOB);
 CREATE TABLE resources(id INTEGER PRIMARY KEY AUTOINCREMENT,url TEXT,data BLOB,compressed INTEGER);
 CREATE TABLE tiles(id INTEGER PRIMARY KEY AUTOINCREMENT,url_template TEXT,pixel_ratio INTEGER,z INTEGER,x INTEGER,y INTEGER,data BLOB);
 CREATE TABLE region_resources(region_id INTEGER REFERENCES regions(id),resource_id INTEGER REFERENCES resources(id));
 CREATE TABLE region_tiles(region_id INTEGER REFERENCES regions(id),tile_id INTEGER REFERENCES tiles(id));
 PRAGMA user_version=5;
 INSERT INTO regions VALUES(1,'definition',X'7b226e616d65223a2266697874757265227d');
 INSERT INTO resources VALUES(1,'style.json',X'010203',0);
 INSERT INTO tiles VALUES(1,'tile.png',1,0,0,0,X'01020304');
 INSERT INTO region_resources VALUES(1,1);
 INSERT INTO region_tiles VALUES(1,1);
 ''');c.commit();c.close()
shutil.copyfile(original,target)
c=sqlite3.connect(target)
if fault!='unchanged':
 for table in ('resources','tiles'):c.execute(f'ALTER TABLE {table} ADD COLUMN must_revalidate INTEGER NOT NULL DEFAULT {1 if fault=="default" else 0}')
 c.execute('PRAGMA user_version=6')
mutations={
 'metadata':"UPDATE regions SET description=X'7b226d6967726174696f6e56657273696f6e223a317d'",
 'payload':"UPDATE tiles SET data=X'ff'",
 'resource':"UPDATE resources SET data=X'ff'",
 'missing':"DELETE FROM tiles",
 'extra':"INSERT INTO tiles(id,pixel_ratio,data) VALUES(2,2,X'ff')",
 'relation':"DELETE FROM region_tiles",
 'pixel-ratio':"UPDATE tiles SET pixel_ratio=2",
 'schema':"ALTER TABLE regions ADD COLUMN unexpected TEXT",
 'table':"CREATE TABLE unexpected(id INTEGER)",
 'nonzero':"UPDATE resources SET must_revalidate=1",
 'version':"PRAGMA user_version=7"
}
if fault in mutations:c.execute(mutations[fault])
c.commit()
if fault=='wal-payload':
 c.execute('PRAGMA journal_mode=WAL');c.execute('PRAGMA wal_checkpoint(TRUNCATE)')
 c.execute("UPDATE tiles SET data=X'ff'");c.commit()
 clone=Path(str(target)+'.copy')
 for suffix in ('','-wal','-shm'):
  path=Path(str(target)+suffix)
  if path.exists():shutil.copyfile(path,Path(str(clone)+suffix))
 c.close()
 for suffix in ('','-wal','-shm'):
  path=Path(str(clone)+suffix)
  if path.exists():shutil.move(path,Path(str(target)+suffix))
else:c.close()
`;
try {
  for (const fault of [
    "unchanged",
    "upgrade",
    "metadata",
    "payload",
    "resource",
    "missing",
    "extra",
    "relation",
    "pixel-ratio",
    "schema",
    "table",
    "nonzero",
    "version",
    "default",
    "wal-payload",
  ]) {
    rmSync(destination, { force: true });
    for (const suffix of ["-wal", "-shm"])
      rmSync(destination + suffix, { force: true });
    execFileSync("python3", ["-c", prepare, original, destination, fault]);
    const check = (env = process.env) =>
      JSON.parse(
        execFileSync(
          "python3",
          ["-I", "scripts/tf08-storage-observations.py", original, destination],
          { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env }
        )
      );
    if (["unchanged", "upgrade"].includes(fault)) {
      const result = check();
      assert.equal(result.originalRowsPreserved, true);
      assert.equal(result.originalSchemaVersion, 5);
      assert.equal(
        result.destinationSchemaVersion,
        fault === "upgrade" ? 6 : 5
      );
      assert.equal(result.rowCounts.tiles, 1);
      assert.equal(result.blobSha256.tiles[0].data.length, 64);
    } else assert.throws(check, undefined, `Must reject ${fault}`);
    if (fault === "payload")
      assert.throws(
        () =>
          check({
            ...process.env,
            PYTHONOPTIMIZE: "1",
            PYTHONPATH: temporary,
          }),
        undefined,
        "Ambient Python settings must not disable corruption assertions."
      );
  }
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
console.log(
  "PASS migration semantic verification: only unchanged schema5 or exact reviewed schema6 upgrade passes; metadata, data, relations, density, schema and WAL corruption reject."
);

const runner = readFileSync("scripts/tf08-services-smoke.mjs", "utf8");
const start = runner.indexOf("const verifyMigratedStorage = async");
const end = runner.indexOf("\nconst storageScenarios =", start);
assert(start >= 0 && end > start);
for (const platform of ["android", "ios"]) {
  for (const fault of [undefined, "comparison", "copy"]) {
    const events = [];
    const applicationId = "org.onemap.acceptance.fixture.tf08remaining";
    const target = "files/.mapbox/map_data/map_data.db";
    const snapshot = "/owned-temporary/migration";
    const files = ["map_data.db", "map_data.db-wal", "map_data.db-shm"];
    const verify = runInNewContext(
      `${runner.slice(start, end)}; verifyMigratedStorage;`,
      {
        assert,
        join,
        platform,
        applicationId,
        simulator: "owned-simulator",
        root: "/prepared",
        temporary: "/owned-temporary",
        dataContainer: "/owned-container",
        storageFixturePaths: { migrationTarget: target },
        mkdtempSync: () => snapshot,
        adb: async (args) => {
          if (args[1] === "am") {
            assert.deepEqual(Array.from(args), [
              "shell",
              "am",
              "force-stop",
              applicationId,
            ]);
            events.push("stop-owned-app");
            return "";
          }
          assert.deepEqual(Array.from(args), [
            "shell",
            "run-as",
            applicationId,
            "ls",
            "-1",
            "files/.mapbox/map_data",
          ]);
          return files.join("\n");
        },
        command: async (file, args) => {
          if (file === "xcrun") {
            assert.deepEqual(Array.from(args), [
              "simctl",
              "terminate",
              "owned-simulator",
              applicationId,
            ]);
            events.push("stop-owned-app");
            return "";
          }
          assert.equal(file, "python3");
          assert.deepEqual(Array.from(args), [
            "-I",
            "/prepared/scripts/tf08-storage-observations.py",
            "/reviewed-fixture.db",
            `${snapshot}/map_data.db`,
          ]);
          events.push("compare");
          if (fault === "comparison") throw new Error("Rows changed.");
          return JSON.stringify({
            originalSha256: "fixture-sha",
            originalRowsPreserved: true,
          });
        },
        readdirSync: (path) => {
          assert.equal(path, "/owned-container/files/.mapbox/map_data");
          return files;
        },
        readAppFile: async (path) => {
          assert.equal(events[0], "stop-owned-app");
          if (fault === "copy") throw new Error("Copy failed.");
          assert([target, target + "-wal", target + "-shm"].includes(path));
          return Buffer.from(path);
        },
        writeFileSync: (path) => {
          events.push(`copy:${path.split("/").at(-1)}`);
        },
        restartNative: async () => {
          events.push("restart-verified-app");
        },
        rmSync: (path, options) => {
          assert.equal(path, snapshot);
          assert.equal(options.recursive, true);
          events.push("cleanup-owned-copy");
        },
      }
    );
    const execute = () =>
      verify({ file: "/reviewed-fixture.db", sha256: "fixture-sha" });
    if (fault)
      await assert.rejects(
        execute,
        fault === "copy" ? /Copy failed/ : /Rows changed/
      );
    else assert.equal((await execute()).originalRowsPreserved, true);
    assert.equal(events[0], "stop-owned-app");
    assert.deepEqual(events.slice(-2), [
      "restart-verified-app",
      "cleanup-owned-copy",
    ]);
    if (fault !== "copy")
      assert.deepEqual(
        events.slice(1, 4),
        files.map((file) => `copy:${file}`)
      );
  }
}
console.log(
  "PASS migration inspection stops only the owned app, includes WAL/SHM, and always relaunches the verified app and removes only its snapshot, including copy/comparison failures."
);
