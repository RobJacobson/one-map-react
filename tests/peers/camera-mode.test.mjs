import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { runInNewContext } from "node:vm";

import {
  toRnmapboxControlledCamera,
  toRnmapboxStop,
  toRnmapboxZoomStop,
} from "../../packages/one-map-react/src/adapters/mapbox-native/convert-camera.ts";

if (process.platform !== "darwin") {
  console.log("SKIP native camera mode regression: requires Xcode.");
  process.exit(0);
}

const peer = resolve(process.argv[2] ?? "node_modules/@rnmapbox/maps");
const temporary = mkdtempSync(join(tmpdir(), "one-map-camera-mode-"));

/** Extracts upstream code, failing when a peer changes the tested boundary. */
const section = (file, start, end) => {
  const source = readFileSync(join(peer, file), "utf8");
  const first = source.indexOf(start);
  const last = source.indexOf(end, first + start.length);
  assert(first >= 0 && last > first, `Missing camera boundary: ${file}`);
  return source.slice(first, last);
};

/** Executes actual Swift peer code with a small SDK dispatch recorder. */
const swift = (source) => {
  const file = join(temporary, "Camera.swift");
  writeFileSync(file, source);
  const result = spawnSync(
    "xcrun",
    ["swift", "-module-cache-path", join(temporary, "swift-cache"), file],
    { encoding: "utf8", timeout: 60000 }
  );
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return result.stdout.trim();
};

/** Executes the iOS bridge's follow and stop prop updates against a camera recorder. */
const verifyFollowHandoff = (stop) => {
  const fabricFile = "ios/RNMBX/RNMBXCameraComponentView.mm";
  const fabricSource = readFileSync(join(peer, fabricFile), "utf8");
  const followStart = "    id followUserLocationDynamic =";
  const stopStart = "    if (!oldProps || oldViewProps.stop";
  assert.ok(
    fabricSource.indexOf(followStart) < fabricSource.indexOf(stopStart)
  );
  const follow = section(fabricFile, followStart, "    id followUserMode =");
  const applyStop = section(fabricFile, stopStart, "  [super updateProps:");
  const source = join(temporary, "CameraFollow.mm");
  const binary = join(temporary, "camera-follow");
  const wire = join(temporary, "handoff.json");
  writeFileSync(wire, JSON.stringify(stop));
  writeFileSync(
    source,
    `#import <Foundation/Foundation.h>
#include <cassert>
@interface Camera : NSObject
@property(nonatomic) BOOL followUserLocation;
@property(nonatomic) NSDictionary *stop;
@property(nonatomic) NSUInteger releases;
@end
@implementation Camera
@synthesize followUserLocation = _followUserLocation;
@synthesize stop = _stop;
- (void)setFollowUserLocation:(BOOL)value {
  _followUserLocation = value;
  if (!value) self.releases += 1;
}
- (void)setStop:(NSDictionary *)value {
  if (!_followUserLocation) _stop = value;
}
@end
struct Props { NSNumber *followUserLocation; NSDictionary *stop; };
id RNMBXConvertFollyDynamicToId(id value) { return value; }
void update(Camera *_view, const Props *oldProps, const Props &newViewProps) {
  const Props oldViewProps = oldProps ? *oldProps : Props{};
  ${follow}
  ${applyStop}
}
int main(int argc, char **argv) { @autoreleasepool {
  NSData *wire = [NSData dataWithContentsOfFile:@(argv[1])];
  NSDictionary *target = [NSJSONSerialization JSONObjectWithData:wire options:0 error:nil];
  Camera *camera = [Camera new];
  Props following{@YES, nil};
  Props released{nil, target};
  update(camera, nullptr, following);
  assert(camera.followUserLocation);
  update(camera, &following, released);
  assert(!camera.followUserLocation && camera.releases == 1);
  assert([camera.stop isEqual:target] && [camera.stop[@"zoom"] doubleValue] == 5);
  update(camera, &released, released);
  assert(camera.releases == 1);
  Camera *other = [Camera new];
  update(other, nullptr, released);
  assert(other.releases == 0 && [other.stop isEqual:target]);
  Props noTarget{nil, nil};
  update(other, &released, noTarget);
  assert(other.stop == nil && "A released target must be cleared before the first layout");
} }
`
  );
  for (const [command, args] of [
    [
      "xcrun",
      [
        "clang++",
        "-std=c++17",
        "-fobjc-arc",
        "-framework",
        "Foundation",
        source,
        "-o",
        binary,
      ],
    ],
    [binary, [wire]],
  ]) {
    const result = spawnSync(command, args, {
      cwd: temporary,
      encoding: "utf8",
      timeout: 60000,
    });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  }
};

try {
  const cameraFile = "ios/RNMBX/RNMBXCamera.swift";
  const modes = section(
    cameraFile,
    "enum CameraMode:",
    "enum UserTrackingMode:"
  );
  const constants = section(
    "ios/RNMBX/RNMBXModule.swift",
    '      "CameraModes":',
    '      "EventTypes":'
  )
    .replace(/^\s*"CameraModes":/, "")
    .trim()
    .replace(/,$/, "");
  const nativeModes = JSON.parse(
    swift(`import Foundation
${modes}
let constants = ${constants}
print(String(data: try! JSONSerialization.data(withJSONObject: constants), encoding: .utf8)!)
`)
  );
  const wrapperFile = "lib/module/components/Camera.js";
  const conversion = section(
    wrapperFile,
    "const nativeAnimationMode =",
    "// Native module types."
  );
  const build = section(
    wrapperFile,
    "  const buildNativeStop =",
    "  // since codegen"
  );
  const props = {};
  const buildStop = runInNewContext(
    `${conversion}\n${build}\nbuildNativeStop`,
    {
      NativeModule: { CameraModes: nativeModes },
      props,
      useCallback: (callback) => callback,
      makePoint: (coordinates) => ({ type: "Point", coordinates }),
    }
  );
  const view = { longitude: 100, latitude: 50, zoom: 5, bearing: 0, pitch: 0 };
  const target = toRnmapboxControlledCamera(view);
  props.followUserLocation = true;
  assert.equal(buildStop(target), null);
  delete props.followUserLocation;
  verifyFollowHandoff(buildStop(target));
  const stops = [
    ["jumpTo", toRnmapboxStop({ center: [100, 50], zoom: 5 }, "none"), "set"],
    ["controlled camera", target, "set"],
    ["zero duration zoom", toRnmapboxZoomStop(5, { duration: 0 }), "set"],
    ["flyTo", toRnmapboxStop({ center: [100, 50] }, "flyTo"), "fly"],
    ["easeTo", toRnmapboxStop({ zoom: 5 }, "easeTo"), "ease"],
    ["moveTo alias", { animationMode: "moveTo" }, "set"],
  ];
  const wire = stops.map(([name, stop, expected]) => ({
    name,
    expected,
    stop: buildStop(stop),
  }));
  // JSON models the bridge omission of undefined numeric camera modes.
  writeFileSync(join(temporary, "stops.json"), JSON.stringify(wire));
  const selection = section(
    cameraFile,
    "    var mode: CameraMode = .flight",
    "    return CameraUpdateItem("
  );
  const update = section(
    cameraFile,
    "struct CameraUpdateItem {",
    "class CameraUpdateQueue {"
  );
  const result = swift(`import Foundation
${modes}
struct Center { func validate() throws {} }
struct CameraOptions { var center: Center? = Center() }
class BasicCameraAnimator {}
enum Curve { case easeInOut, linear }
var calls: [String] = []
class SDK { func setCamera(to camera: CameraOptions) { calls.append("set") } }
class Animator {
  func fly(to camera: CameraOptions, duration: TimeInterval?) { calls.append("fly") }
  func ease(to camera: CameraOptions, duration: TimeInterval, curve: Curve, completion: (() -> Void)?) { calls.append("ease") }
}
class View { var window: Bool? = true; let camera = Animator() }
class RNMBXMapView { let mapView = View(); let mapboxMap = SDK() }
func logged(_ name: String, _ body: () throws -> Void) { try! body() }
${update}
let rows = try! JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: ${JSON.stringify(join(temporary, "stops.json"))}))) as! [[String: Any]]
var results: [[String: String]] = []
for row in rows {
  let stop = row["stop"] as! [String: Any]
  ${selection}
  var animator: BasicCameraAnimator?
  CameraUpdateItem(camera: CameraOptions(), mode: mode, duration: stop["duration"] as? Double).execute(map: RNMBXMapView(), cameraAnimator: &animator)
  results.append(["name": row["name"] as! String, "actual": calls.last!, "expected": row["expected"] as! String])
}
print(String(data: try! JSONSerialization.data(withJSONObject: results), encoding: .utf8)!)
`);
  for (const row of JSON.parse(result)) {
    assert.equal(row.actual, row.expected, `${row.name}: iOS SDK dispatch`);
  }
  assert.equal(
    nativeModes.None,
    nativeModes.Move,
    "Preserve the existing Move alias"
  );
  console.log(
    `PASS ${JSON.parse(readFileSync(join(peer, "package.json"))).version}: wrapper-to-iOS camera dispatch and follow handoff`
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
