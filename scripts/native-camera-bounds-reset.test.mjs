import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  globSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";

const mapbox = resolve(process.argv[2] ?? "node_modules/@rnmapbox/maps");
const maplibre = resolve(
  process.argv[3] ?? "node_modules/@maplibre/maplibre-react-native"
);

if (process.platform !== "darwin") {
  console.log("SKIP native bounds method regression: requires Xcode.");
  process.exit(0);
}

/** Extracts actual peer methods for execution against small SDK boundary stubs. */
const section = (root, file, start, end) => {
  const source = readFileSync(join(root, file), "utf8");
  const first = source.indexOf(start);
  const last = source.indexOf(end, first + start.length);
  assert(first >= 0 && last > first, `Missing native method: ${file}`);
  return source.slice(first, last);
};

/** Compiles and runs the peer code without launching an app or renderer. */
const run = (command, args) => {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout: 60000,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
};

const temporary = mkdtempSync(join(tmpdir(), "one-map-bounds-reset-"));
try {
  const swift = section(
    mapbox,
    "ios/RNMBX/RNMBXCamera.swift",
    "  func _updateMaxBounds()",
    "  func _updateCameraFromTrackingMode()"
  );
  const swiftFile = join(temporary, "Bounds.swift");
  writeFileSync(
    swiftFile,
    `import Foundation
struct CLLocationCoordinate2D { var latitude: Double; var longitude: Double }
struct CoordinateBounds: Equatable {
  var southwest: CLLocationCoordinate2D; var northeast: CLLocationCoordinate2D; var infiniteBounds = false
  static func == (a: Self, b: Self) -> Bool { a.southwest.longitude == b.southwest.longitude && a.infiniteBounds == b.infiniteBounds }
}
struct CameraBoundsOptions { var bounds: CoordinateBounds?; var minZoom: CGFloat?; var maxZoom: CGFloat?; var minPitch: CGFloat?; var maxPitch: CGFloat? }
final class SDK {
  var cameraBounds = CameraBoundsOptions(minPitch: 3, maxPitch: 47)
  func setCameraBounds(with options: CameraBoundsOptions) throws {
    if let bounds = options.bounds { cameraBounds.bounds = bounds }
    cameraBounds.minZoom = options.minZoom; cameraBounds.maxZoom = options.maxZoom
    cameraBounds.minPitch = options.minPitch; cameraBounds.maxPitch = options.maxPitch
  }
}
final class MapView { let mapboxMap = SDK() }
struct Zoom { var CGFloat: CGFloat }
func logged(_ name: String, _ body: () throws -> Void) { try! body() }
final class Camera {
  let map = MapView(); var maxBoundsFeature: CoordinateBounds?; var minZoomLevel: Zoom? = Zoom(CGFloat: 2); var maxZoomLevel: Zoom? = Zoom(CGFloat: 18)
  func withMapView(_ body: (MapView) -> Void) { body(map) }
  func _toCoordinateBounds(_ value: CoordinateBounds) throws -> CoordinateBounds { value }
  ${swift}
}
let camera = Camera()
for west in [-20.0, 30.0] {
  camera.maxBoundsFeature = CoordinateBounds(southwest: CLLocationCoordinate2D(latitude: west, longitude: west), northeast: CLLocationCoordinate2D(latitude: west + 20, longitude: west + 20))
  camera._updateMaxBounds()
  precondition(camera.map.mapboxMap.cameraBounds.bounds == camera.maxBoundsFeature)
}
camera.maxBoundsFeature = nil; camera._updateMaxBounds()
precondition(camera.map.mapboxMap.cameraBounds.bounds?.infiniteBounds == true, "Clearing bounds must release the SDK constraint")
precondition(camera.map.mapboxMap.cameraBounds.minZoom == 2 && camera.map.mapboxMap.cameraBounds.maxZoom == 18)
precondition(camera.map.mapboxMap.cameraBounds.minPitch == 3 && camera.map.mapboxMap.cameraBounds.maxPitch == 47)
camera.maxBoundsFeature = CoordinateBounds(southwest: CLLocationCoordinate2D(latitude: -10, longitude: -10), northeast: CLLocationCoordinate2D(latitude: 10, longitude: 10)); camera._updateMaxBounds()
precondition(camera.map.mapboxMap.cameraBounds.bounds == camera.maxBoundsFeature)
`
  );
  run("xcrun", [
    "swift",
    "-module-cache-path",
    join(temporary, "swift-cache"),
    swiftFile,
  ]);

  const fabricSource = readFileSync(
    join(mapbox, "ios/RNMBX/RNMBXCameraComponentView.mm"),
    "utf8"
  );
  const usesStringMacro = fabricSource.includes(
    "RNMBX_PROP_NSString(maxBounds)"
  );
  const fabricMacro = usesStringMacro
    ? section(
        mapbox,
        "ios/RNMBX/RNMBXFabricPropConvert.h",
        "#define RNMBX_PROP_NSString(name)",
        "\n\n"
      )
    : "";
  const fabric = section(
    mapbox,
    "ios/RNMBX/RNMBXCameraComponentView.mm",
    usesStringMacro
      ? "    RNMBX_PROP_NSString(maxBounds)"
      : "    id maxBounds =",
    "    id animationDuration ="
  );
  const libreIos = section(
    maplibre,
    "ios/components/camera/MLRNCamera.m",
    "- (void)_updateMaxBounds",
    "- (MLNUserTrackingMode)_userTrackingMode"
  );
  const objcFile = join(temporary, "Bounds.mm");
  writeFileSync(
    objcFile,
    `#import <Foundation/Foundation.h>
#include <cassert>
struct Coordinate { double latitude, longitude; };
struct MLNCoordinateBounds { Coordinate sw, ne; };
@interface View: NSObject
@property(nonatomic, copy) NSString *maxBounds;
@end
@implementation View @end
struct Props { NSString *maxBounds; };
struct OldProps { void *get() { return this; } };
id RNMBXConvertFollyDynamicToId(id value) { return value; }
id RNMBXPropConvert_Optional_NSString(id value, NSString *name) { return value; }
${fabricMacro}
void update(View *_view, NSString *old, NSString *next) {
  Props oldViewProps{old}, newViewProps{next}; OldProps oldProps;
  ${fabric}
}
@interface Map: NSObject
@property(nonatomic) MLNCoordinateBounds maxBounds;
@end
@implementation Map @end
@interface MLRNUtils: NSObject
+ (MLNCoordinateBounds)fromReactBounds:(NSArray *)value;
@end
@implementation MLRNUtils
+ (MLNCoordinateBounds)fromReactBounds:(NSArray *)value { double n = [value[0] doubleValue]; return {{n,n},{n+20,n+20}}; }
@end
@interface Camera: NSObject { @public Map *_map; NSArray *_maxBounds; }
- (void)_updateMaxBounds;
@end
@implementation Camera
${libreIos}
@end
int main() { @autoreleasepool {
  View *view = [View new]; update(view, nil, @"initial"); assert([view.maxBounds isEqual:@"initial"]);
  update(view, @"initial", @"replacement"); assert([view.maxBounds isEqual:@"replacement"]);
  update(view, @"replacement", nil); assert(view.maxBounds == nil);
  update(view, nil, @"again"); assert([view.maxBounds isEqual:@"again"]);
  Camera *camera = [Camera new]; [camera _updateMaxBounds]; camera->_map = [Map new];
  for (NSNumber *west in @[@(-20), @(30)]) { camera->_maxBounds = @[west]; [camera _updateMaxBounds]; assert(camera->_map.maxBounds.sw.longitude == west.doubleValue); }
  camera->_maxBounds = nil; [camera _updateMaxBounds]; assert(camera->_map.maxBounds.sw.longitude == camera->_map.maxBounds.ne.longitude);
  camera->_maxBounds = @[@(-10)]; [camera _updateMaxBounds]; assert(camera->_map.maxBounds.sw.longitude == -10);
} }
`
  );
  const objcBinary = join(temporary, "objc-bounds");
  run("xcrun", [
    "clang++",
    "-std=c++17",
    "-fobjc-arc",
    "-framework",
    "Foundation",
    objcFile,
    "-o",
    objcBinary,
  ]);
  run(objcBinary, []);

  const kotlin = section(
    mapbox,
    "android/src/main/java/com/rnmapbox/rnmbx/components/camera/RNMBXCamera.kt",
    "    private fun updateMaxBounds(mapView:",
    "    private fun setInitialCamera("
  );
  const libreAndroid = section(
    maplibre,
    "android/src/main/java/org/maplibre/reactnative/components/camera/MLRNCamera.kt",
    "    private fun updateMaxBounds()",
    "    private fun setInitialCamera("
  );
  assert.match(
    kotlin,
    /mMaxBounds\?\.toBounds\(\) \?: CoordinateBounds.world\(\)/
  );
  assert.doesNotMatch(libreAndroid, /maxBounds != null/);
  assert.match(libreAndroid, /setLatLngBoundsForCameraTarget\(maxBounds\)/);
  const kotlinFile = join(temporary, "Bounds.kt");
  writeFileSync(
    kotlinFile,
    `data class CoordinateBounds(val west: Double) { companion object { fun world() = CoordinateBounds(-180.0) } }
class LatLngBounds(val west: Double) { fun toBounds() = CoordinateBounds(west) }
data class Limits(var bounds: CoordinateBounds? = null, var minPitch: Double = 3.0, var maxPitch: Double = 47.0)
class CameraBoundsOptions { class Builder {
  private val value = Limits()
  fun bounds(v: CoordinateBounds?) { value.bounds = v }
  fun minZoom(v: Double) {} ; fun maxZoom(v: Double) {}
  fun minPitch(v: Double) { value.minPitch = v }; fun maxPitch(v: Double) { value.maxPitch = v }
  fun build() = value
} }
class SDK {
  private var limits = Limits()
  var target: LatLngBounds? = null
  fun getBounds() = limits
  fun setBounds(v: Limits) { if (v.bounds != null) limits.bounds = v.bounds; limits.minPitch = v.minPitch; limits.maxPitch = v.maxPitch }
  fun setLatLngBoundsForCameraTarget(v: LatLngBounds?) { target = v }
}
class RNMBXMapView { val sdk = SDK(); fun getMapboxMap() = sdk }
class Box {
  var mMaxBounds: LatLngBounds? = null; var mMinZoomLevel: Double? = 2.0; var mMaxZoomLevel: Double? = 18.0; var mCameraStop: Int? = null
  fun updateCamera(stop: Int, map: RNMBXMapView) {}
  fun apply(map: RNMBXMapView) { updateMaxBounds(map) }
  ${kotlin}
}
class Libre {
  var maplibreMap: SDK? = null; var maxBounds: LatLngBounds? = null
  fun apply() { updateMaxBounds() }
  ${libreAndroid}
}
fun main() {
  val box = Box(); val map = RNMBXMapView()
  for (west in listOf(-20.0, 30.0)) { box.mMaxBounds = LatLngBounds(west); box.apply(map); check(map.sdk.getBounds().bounds?.west == west) }
  box.mMaxBounds = null; box.apply(map); check(map.sdk.getBounds().bounds == CoordinateBounds.world()) { "Cleared bounds must release the SDK constraint" }
  check(map.sdk.getBounds().minPitch == 3.0 && map.sdk.getBounds().maxPitch == 47.0)
  box.mMaxBounds = LatLngBounds(-10.0); box.apply(map); check(map.sdk.getBounds().bounds?.west == -10.0)
  val libre = Libre(); libre.apply(); libre.maplibreMap = SDK()
  for (west in listOf(-20.0, 30.0)) { libre.maxBounds = LatLngBounds(west); libre.apply(); check(libre.maplibreMap!!.target === libre.maxBounds) }
  libre.maxBounds = null; libre.apply(); check(libre.maplibreMap!!.target == null)
  libre.maxBounds = LatLngBounds(-10.0); libre.apply(); check(libre.maplibreMap!!.target === libre.maxBounds)
}
`
  );
  const cache = join(homedir(), ".gradle/caches/modules-2/files-2.1");
  const jars = [
    "org.jetbrains.kotlin/kotlin-compiler-embeddable/2.2.0",
    "org.jetbrains.kotlin/kotlin-stdlib/2.2.0",
    "org.jetbrains.kotlin/kotlin-script-runtime/2.2.0",
    "org.jetbrains.kotlin/kotlin-reflect/*",
    "org.jetbrains.kotlin/kotlin-daemon-embeddable/2.2.0",
    "org.jetbrains.kotlinx/kotlinx-coroutines-core-jvm/1.8.0",
    "org.jetbrains.intellij.deps/trove4j/*",
    "org.jetbrains/annotations/13.0",
  ].flatMap((path) => globSync(`${cache}/${path}/*/*.jar`));
  console.log(
    "PASS actual Swift and Objective-C++ camera methods: set, replace, clear and reapply; unrelated limits preserved."
  );
  if (jars.some((file) => file.includes("kotlin-compiler-embeddable"))) {
    const classes = join(temporary, "classes");
    run("java", [
      "-cp",
      jars.join(":"),
      "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler",
      "-no-stdlib",
      "-no-reflect",
      "-classpath",
      jars.join(":"),
      kotlinFile,
      "-d",
      classes,
    ]);
    run("java", ["-cp", [classes, ...jars].join(":"), "BoundsKt"]);
    console.log(
      "PASS actual Kotlin camera bounds methods at both SDK boundaries."
    );
  } else {
    console.log(
      "SKIP Kotlin method regression: cached Kotlin 2.2.0 compiler required."
    );
  }
  console.log(
    "SDK boundaries are stubbed; renderer acceptance remains separate."
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
