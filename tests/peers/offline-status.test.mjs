import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

if (process.platform !== "darwin") {
  console.log(
    "SKIP Swift offline-status regression: requires the macOS Swift compiler."
  );
} else {
  const source = readFileSync(
    join(
      resolve(process.argv[2] ?? "node_modules/@rnmapbox/maps"),
      "ios/RNMBX/Offline/RNMBXOfflineModule.swift"
    ),
    "utf8"
  );
  const start = source.indexOf("func getPackStatus(");
  const end = source.indexOf("  @objc", start);
  assert(start >= 0 && end > start);
  const temporary = mkdtempSync(join(tmpdir(), "one-map-offline-status-"));
  try {
    const file = join(temporary, "Status.swift");
    writeFileSync(
      file,
      `
import Foundation
import Dispatch
typealias RCTPromiseResolveBlock = (Any?) -> Void
typealias RCTPromiseRejectBlock = (String?, String?, Error?) -> Void
enum State: String { case active, inactive, complete, unknown }
struct TileRegionPack { let name: String; var state: State; var progress: Double?; let metadata: [String:Any] }
struct Region {}
enum Level { case error }
enum Logger { static func log(level: Level, message: String) {} }
func logged<T>(_ label: String, _ body: () -> T) -> T { body() }
final class TileStore {
  var queries = 0
  func tileRegion(forId name: String, completion: (Result<Region, Error>) -> Void) {
    queries += 1
    completion(.failure(NSError(domain: "Not persisted yet", code: 1)))
  }
  func tileRegionMetadata(forId name: String, completion: (Result<Any, Error>) -> Void) { completion(.success([:])) }
}
final class Module {
  let tileStore = TileStore()
  var tileRegionPacks: [String:TileRegionPack] = [:]
  func toProgress(region: Region) -> Double? { nil }
  func _makeRegionStatusPayload(_ name: String, progress: Double?, state: State, metadata: [String:Any]?) -> [String:Any?] { ["name": name, "state": state.rawValue, "percentage": progress] }
  func _makeRegionStatusPayload(pack: TileRegionPack) -> [String:Any?] { _makeRegionStatusPayload(pack.name, progress: pack.progress, state: pack.state, metadata: pack.metadata) }
  ${source.slice(start, end)}
}
let module = Module()
module.tileRegionPacks["new"] = TileRegionPack(name: "new", state: .active, progress: nil, metadata: [:])
var result: Any?
var failure: String?
module.getPackStatus("new", resolver: { result = $0 }, rejecter: { _, message, _ in failure = message })
let deadline = Date().addingTimeInterval(2)
while result == nil && failure == nil && Date() < deadline { RunLoop.current.run(until: Date().addingTimeInterval(0.01)) }
precondition(failure == nil && result != nil, "New download status must not query a tile region that has not persisted yet")
precondition(module.tileStore.queries == 0)
precondition((result as? [String:Any?])?["state"] as? String == "active")
for (state, percentage) in [(State.inactive, 15.0), (State.complete, 100.0)] {
  module.tileRegionPacks["new"] = TileRegionPack(name: "new", state: state, progress: percentage, metadata: [:])
  result = nil
  module.getPackStatus("new", resolver: { result = $0 }, rejecter: { _, message, _ in failure = message })
  let deadline = Date().addingTimeInterval(2)
  while result == nil && failure == nil && Date() < deadline { RunLoop.current.run(until: Date().addingTimeInterval(0.01)) }
  precondition(failure == nil && (result as? [String:Any?])?["percentage"] as? Double == percentage)
}
precondition(module.tileStore.queries == 0)
module.tileRegionPacks["new"] = TileRegionPack(name: "new", state: .unknown, progress: nil, metadata: [:])
result = nil
module.getPackStatus("new", resolver: { result = $0 }, rejecter: { _, message, _ in failure = message })
let failureDeadline = Date().addingTimeInterval(2)
while failure == nil && Date() < failureDeadline { RunLoop.current.run(until: Date().addingTimeInterval(0.01)) }
precondition(failure != nil && result == nil && module.tileStore.queries == 1)
print("PASS actual Swift offline status before persistence, paused/completed progress and genuine SDK failures")
`
    );
    const result = spawnSync(
      "xcrun",
      ["swift", "-module-cache-path", join(temporary, "cache"), file],
      { encoding: "utf8", timeout: 60000 }
    );
    if (result.error) throw result.error;
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    console.log(result.stdout.trim());
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}
