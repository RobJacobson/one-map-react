import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { runInNewContext } from "node:vm";

import { getKotlinRunner } from "./kotlin-regression.ts";

const mapbox = resolve(process.argv[2] ?? "node_modules/@rnmapbox/maps");
const maplibre = resolve(
  process.argv[3] ?? "node_modules/@maplibre/maplibre-react-native"
);

if (process.platform !== "darwin") {
  console.log("SKIP native bounds method regression: requires Xcode.");
  process.exit(0);
}

const runKotlin = getKotlinRunner();

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

/** Exercises the published MapLibre JS wrapper before testing the Android consumer. */
const verifyMapLibrePaddingWire = () => {
  const component = section(
    maplibre,
    "lib/module/components/camera/Camera.js",
    "export const Camera =",
    "//# sourceMappingURL="
  ).replace("export const", "const");
  const ref = {};
  const stops = [];
  const render = runInNewContext(`${component}\nCamera`, {
    _jsx: (_component, props) => props,
    memo: (camera) => camera,
    findNodeHandle: () => 1,
    useRef: () => ({ current: {} }),
    useImperativeHandle: (handle, makeCurrent) => {
      handle.current = makeCurrent();
    },
    NativeCameraComponent: {},
    NativeCameraModule: {
      setStop: (_handle, stop) => {
        stops.push(stop);
      },
    },
  });

  const padding = { left: 40, bottom: 10 };
  assert.equal(render({ ref, padding }).stop.padding, padding);
  assert.equal(render({ ref }).stop.padding, undefined);
  ref.current.jumpTo({ padding });
  ref.current.jumpTo({ center: [9, 10] });
  ref.current.jumpTo({ padding: { left: 0 } });
  assert.equal(stops[0].padding, padding);
  assert.equal(stops[0].center, undefined);
  assert.equal(stops[1].padding, undefined);
  assert.equal(stops[2].padding.left, 0);
};

verifyMapLibrePaddingWire();

const temporary = mkdtempSync(join(tmpdir(), "one-map-bounds-reset-"));
try {
  const swift = section(
    mapbox,
    "ios/RNMBX/RNMBXCamera.swift",
    "  func _updateMaxBounds(",
    "  func _updateCameraFromTrackingMode()"
  );
  const boxZoomSetter = section(
    mapbox,
    "ios/RNMBX/RNMBXCamera.swift",
    "  public func setZoomLimits(",
    "  @objc public var onUserTrackingModeChange"
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
struct Limits { var bounds: CoordinateBounds?; var minZoom: CGFloat = 0; var maxZoom: CGFloat = 22; var minPitch: CGFloat = 3; var maxPitch: CGFloat = 47 }
final class SDK {
  var cameraBounds = Limits()
  func setCameraBounds(with options: CameraBoundsOptions) throws {
    if let bounds = options.bounds { cameraBounds.bounds = bounds }
    if let minZoom = options.minZoom, minZoom <= cameraBounds.maxZoom { cameraBounds.minZoom = minZoom }
    if let maxZoom = options.maxZoom, maxZoom >= cameraBounds.minZoom { cameraBounds.maxZoom = maxZoom }
    if let minPitch = options.minPitch { cameraBounds.minPitch = minPitch }
    if let maxPitch = options.maxPitch { cameraBounds.maxPitch = maxPitch }
  }
}
final class MapView { let mapboxMap = SDK() }
typealias NSNumber = Zoom
struct Zoom { var CGFloat: CGFloat }
func logged(_ name: String, _ body: () throws -> Void) { try! body() }
final class Camera {
  let map = MapView()
  var maxBoundsFeature: CoordinateBounds?
  var minZoomLevel: Zoom?
  var maxZoomLevel: Zoom?
  func withMapView(_ body: (MapView) -> Void) { body(map) }
  func _toCoordinateBounds(_ value: CoordinateBounds) throws -> CoordinateBounds { value }
  ${boxZoomSetter}
  ${swift}
}
let camera = Camera()
func expectZoom(_ min: CGFloat?, _ max: CGFloat?, _ effectiveMin: CGFloat, _ effectiveMax: CGFloat) {
  camera.setZoomLimits(minZoom: min.map { Zoom(CGFloat: $0) }, maxZoom: max.map { Zoom(CGFloat: $0) })
  precondition(camera.map.mapboxMap.cameraBounds.minZoom == effectiveMin, "Incorrect Mapbox minimum")
  precondition(camera.map.mapboxMap.cameraBounds.maxZoom == effectiveMax, "Incorrect Mapbox maximum")
}
expectZoom(2, 18, 2, 18)
expectZoom(nil, 18, 0, 18)
expectZoom(3, 10, 3, 10)
expectZoom(3, nil, 3, 22)
expectZoom(nil, 0, 0, 0)
expectZoom(8, 12, 8, 12)
expectZoom(2, 5, 2, 5)
expectZoom(nil, nil, 0, 22)
expectZoom(2, 18, 2, 18)
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
  const boxZoomProps = section(
    mapbox,
    "ios/RNMBX/RNMBXCameraComponentView.mm",
    "    if (!oldProps || oldViewProps.minZoomLevel",
    "    if (!oldProps || oldViewProps.stop"
  );
  const libreZoomProps = section(
    maplibre,
    "ios/components/camera/MLRNCameraComponentView.mm",
    "  if (oldViewProps.minZoom",
    "  if (oldViewProps.maxBounds"
  );
  const libreZoomSetter = section(
    maplibre,
    "ios/components/camera/MLRNCamera.m",
    "- (void)setZoomLimitsWithMinZoom:",
    "- (void)setMaxBounds:"
  );
  const libreIos = section(
    maplibre,
    "ios/components/camera/MLRNCamera.m",
    "- (void)_updateMinMaxZoom",
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
@property(nonatomic, copy) NSNumber *minZoomLevel;
@property(nonatomic, copy) NSNumber *maxZoomLevel;
- (void)setZoomLimitsWithMinZoom:(NSNumber *)minZoom maxZoom:(NSNumber *)maxZoom;
@end
@implementation View
- (void)setZoomLimitsWithMinZoom:(NSNumber *)minZoom maxZoom:(NSNumber *)maxZoom {
  self.minZoomLevel = minZoom;
  self.maxZoomLevel = maxZoom;
}
@end
struct Props { NSString *maxBounds; NSNumber *minZoomLevel; NSNumber *maxZoomLevel; };
struct OldProps { void *get() { return this; } bool operator!() const { return false; } };
id RNMBXConvertFollyDynamicToId(id value) { return value; }
id RNMBXPropConvert_Optional_NSString(id value, NSString *name) { return value; }
${fabricMacro}
void update(View *_view, NSString *old, NSString *next) {
  Props oldViewProps{old}, newViewProps{next}; OldProps oldProps;
  ${fabric}
}
void updateBoxZoom(View *_view, NSNumber *oldMin, NSNumber *oldMax, NSNumber *min, NSNumber *max) {
  Props oldViewProps{nil, oldMin, oldMax}, newViewProps{nil, min, max}; OldProps oldProps;
  ${boxZoomProps}
}
@interface Map: NSObject { double _minimum, _maximum; }
@property(nonatomic) MLNCoordinateBounds maxBounds;
@property(nonatomic) double minimumZoomLevel;
@property(nonatomic) double maximumZoomLevel;
@end
@implementation Map
- (instancetype)init { if (self = [super init]) { _maximum = 22; } return self; }
- (double)minimumZoomLevel { return _minimum; }
- (double)maximumZoomLevel { return _maximum; }
- (void)setMinimumZoomLevel:(double)value { if (value <= _maximum) { _minimum = fmax(0, value); } }
- (void)setMaximumZoomLevel:(double)value { if (value >= _minimum) { _maximum = fmin(25.5, value); } }
@end
@interface MLRNUtils: NSObject
+ (MLNCoordinateBounds)fromReactBounds:(NSArray *)value;
@end
@implementation MLRNUtils
+ (MLNCoordinateBounds)fromReactBounds:(NSArray *)value { double n = [value[0] doubleValue]; return {{n,n},{n+20,n+20}}; }
@end
@interface Camera: NSObject { @public Map *_map; NSArray *_maxBounds; NSNumber *_minZoom; NSNumber *_maxZoom; }
- (void)setZoomLimitsWithMinZoom:(NSNumber *)minZoom maxZoom:(NSNumber *)maxZoom;
- (void)_updateMinMaxZoom;
- (void)_updateMaxBounds;
@end
@implementation Camera
${libreZoomSetter}
${libreIos}
@end
struct LibreProps { double minZoom; double maxZoom; };
void updateLibreZoom(Camera *_view, double oldMin, double oldMax, double min, double max) {
  LibreProps oldViewProps{oldMin, oldMax}, newViewProps{min, max};
  ${libreZoomProps}
}
void expectLibreZoom(Camera *camera, double oldMin, double oldMax, double min, double max, double effectiveMin, double effectiveMax) {
  updateLibreZoom(camera, oldMin, oldMax, min, max);
  assert(camera->_map.minimumZoomLevel == effectiveMin);
  assert(camera->_map.maximumZoomLevel == effectiveMax);
}
int main() { @autoreleasepool {
  View *view = [View new]; update(view, nil, @"initial"); assert([view.maxBounds isEqual:@"initial"]);
  update(view, @"initial", @"replacement"); assert([view.maxBounds isEqual:@"replacement"]);
  update(view, @"replacement", nil); assert(view.maxBounds == nil);
  update(view, nil, @"again"); assert([view.maxBounds isEqual:@"again"]);
  updateBoxZoom(view, nil, nil, @3, @10); assert([view.minZoomLevel isEqual:@3] && [view.maxZoomLevel isEqual:@10]);
  updateBoxZoom(view, @3, @10, nil, @10); assert(view.minZoomLevel == nil && [view.maxZoomLevel isEqual:@10]);
  updateBoxZoom(view, nil, @10, @0, nil); assert([view.minZoomLevel isEqual:@0] && view.maxZoomLevel == nil);
  updateBoxZoom(view, @0, nil, nil, @0); assert(view.minZoomLevel == nil && [view.maxZoomLevel isEqual:@0]);

  Camera *camera = [Camera new]; [camera _updateMaxBounds];
  updateLibreZoom(camera, -1, -1, 3, 10);
  camera->_map = [Map new];
  [camera _updateMinMaxZoom];
  assert(camera->_map.minimumZoomLevel == 3 && camera->_map.maximumZoomLevel == 10);
  expectLibreZoom(camera, 3, 10, -1, 10, 0, 10);
  expectLibreZoom(camera, -1, 10, 4, 8, 4, 8);
  expectLibreZoom(camera, 4, 8, 4, -1, 4, 22);
  expectLibreZoom(camera, 4, -1, 0, 0, 0, 0);
  expectLibreZoom(camera, 0, 0, 11, 15, 11, 15);
  expectLibreZoom(camera, 11, 15, 2, 8, 2, 8);
  expectLibreZoom(camera, 2, 8, -1, -1, 0, 22);
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

  const boxCamera =
    "android/src/main/java/com/rnmapbox/rnmbx/components/camera/RNMBXCamera.kt";
  const librePath =
    "android/src/main/java/org/maplibre/reactnative/components/camera";
  const libreCamera = `${librePath}/MLRNCamera.kt`;
  const boxCommit = section(
    mapbox,
    boxCamera,
    "    fun setStop(",
    "    fun updateCameraStop("
  );
  const boxBounds = section(
    mapbox,
    boxCamera,
    "    fun setMaxBounds(",
    "    private fun setInitialCamera("
  );
  const boxZoom = section(
    mapbox,
    boxCamera,
    "    fun setMinZoomLevel(",
    "    fun setZoomLevel("
  );
  const libreCommit = section(
    maplibre,
    libreCamera,
    "    fun handleImperativeStop(",
    "    fun setInitialViewState("
  );
  const libreBounds = section(
    maplibre,
    libreCamera,
    "    fun setMaxBounds(",
    "    private fun setInitialCamera("
  );
  const libreZoom = section(
    maplibre,
    libreCamera,
    "    fun setMinZoomLevel(",
    "    fun setTrackUserLocation("
  );
  const cameraStop = section(
    maplibre,
    `${librePath}/CameraStop.kt`,
    "class CameraStop {",
    "\n}\n"
  );
  const kotlinFile = join(temporary, "Bounds.kt");
  writeFileSync(
    kotlinFile,
    `data class CoordinateBounds(val west: Double) { companion object { fun world() = CoordinateBounds(-180.0) } }
data class LatLngBounds(val west: Double) { fun toBounds() = CoordinateBounds(west) }
data class BoundsOptions(
  var bounds: CoordinateBounds? = null, var minZoom: Double? = null, var maxZoom: Double? = null,
  var minPitch: Double? = null, var maxPitch: Double? = null
)
data class Limits(
  var bounds: CoordinateBounds? = null, var minZoom: Double = 0.0, var maxZoom: Double = 25.0,
  var minPitch: Double = 3.0, var maxPitch: Double = 47.0
)
class CameraBoundsOptions { class Builder {
  private val value = BoundsOptions()
  fun bounds(v: CoordinateBounds?) = apply { value.bounds = v }
  fun minZoom(v: Double) = apply { value.minZoom = v }
  fun maxZoom(v: Double) = apply { value.maxZoom = v }
  fun minPitch(v: Double) = apply { value.minPitch = v }
  fun maxPitch(v: Double) = apply { value.maxPitch = v }
  fun build() = value
} }
object MapLibreConstants { const val MINIMUM_ZOOM = 0f; const val MAXIMUM_ZOOM = 25.5f }
class SDK(initialMaxZoom: Double = 25.0) {
  private val limits = Limits(maxZoom = initialMaxZoom)
  var target: LatLngBounds? = null
  val maxZoomLevel get() = limits.maxZoom
  val minZoomLevel get() = limits.minZoom
  var cameraPosition = CameraPosition(LatLng(6.0, 3.0), 12.0, 14.0, 18.0, doubleArrayOf(7.0, 3.0, 4.0, 5.0))
  var pendingPadding: DoubleArray? = null
  val padding get() = (pendingPadding ?: cameraPosition.padding!!).map { it.toInt() }.toIntArray()
  var fitPadding: List<Int> = emptyList()
  var failFit = false
  fun getCameraForLatLngBounds(bounds: LatLngBounds, padding: IntArray, bearing: Double, tilt: Double): CameraPosition? {
    fitPadding = padding.toList()
    return if (failFit) null else CameraPosition(LatLng(bounds.west, 10.0), 6.0, tilt, bearing, padding.map { it.toDouble() }.toDoubleArray())
  }
  fun getBounds() = limits.copy()
  fun setBounds(v: BoundsOptions) {
    v.bounds?.let { limits.bounds = it }
    v.minZoom?.let { setMinZoomPreference(it) }
    v.maxZoom?.let { setMaxZoomPreference(it) }
    v.minPitch?.let { limits.minPitch = it }
    v.maxPitch?.let { limits.maxPitch = it }
  }
  fun setMinZoomPreference(v: Double) { if (v >= 0 && v <= limits.maxZoom) limits.minZoom = v }
  fun setMaxZoomPreference(v: Double) { if (v <= 25.5 && v >= limits.minZoom) limits.maxZoom = v }
  fun setLatLngBoundsForCameraTarget(v: LatLngBounds?) { target = v }
}
class RNMBXMapView { val sdk = SDK(); fun getMapboxMap() = sdk }
class BoxStop(val zoom: Double) { fun setCallback(callback: Any?) {} }
class Box {
  var mMaxBounds: LatLngBounds? = null
  var mMinZoomLevel: Double? = null
  var mMaxZoomLevel: Double? = null
  var mCameraStop: BoxStop? = null
  var boundsChanged = false
  var cameraStopChanged = false
  var mMapView: RNMBXMapView? = null
  val mCameraCallback = null
  var moves = mutableListOf<Double>()
  fun updateCamera(stop: BoxStop, map: RNMBXMapView) {
    moves.add(stop.zoom.coerceIn(map.sdk.minZoomLevel, map.sdk.maxZoomLevel))
  }
  fun attach(map: RNMBXMapView) {
    mMapView = map
    updateMaxBounds(map)
    mCameraStop?.let { updateCamera(it, map) }
  }
  ${boxCommit.replace("stop: CameraStop?", "stop: BoxStop?")}
  ${boxBounds}
  ${boxZoom}
}
class Libre {
  val context = Context()
  var mapView: MLRNMapView? = null
  val maplibreMap get() = mapView?.mapLibreMap
  private var maxBounds: LatLngBounds? = null
  var minZoom: Double? = null
  var maxZoom: Double? = null
  var stop: CameraStop? = null
  var cameraStopChanged = false
  var zoomLimitsChanged = false
  val cameraCallback = object : CancelableCallback {}
  val updateQueue = CameraUpdateQueue()
  fun updateCamera() {
    updateQueue.offer(stop)
    updateQueue.execute(mapView!!)
  }
  fun attach(map: MLRNMapView) {
    mapView = map
    updateMaxMinZoom()
    updateMaxBounds()
    if (stop != null) updateCamera()
  }
  ${libreCommit}
  ${libreBounds}
  ${libreZoom}
}
class Context { val resources = Resources() }
class Resources { val displayMetrics = DisplayMetrics() }
class DisplayMetrics { val density = 2.0f }
class ReadableMap(private val values: Map<String, Any?>) {
  fun hasKey(key: String) = values.containsKey(key)
  fun isNull(key: String) = values.getValue(key) == null
  fun getInt(key: String) = (values.getValue(key) as Number).toInt()
  fun getDouble(key: String) = (values.getValue(key) as Number).toDouble()
  fun getString(key: String) = values.getValue(key) as String?
  fun getMap(key: String) = values.getValue(key) as ReadableMap?
  fun getArray(key: String) = values.getValue(key) as List<*>?
}
object Arguments { fun createMap() = ReadableMap(emptyMap()) }
object GeoJSONUtils {
  fun toLatLng(array: List<*>?) = array?.let { LatLng(it[0] as Double, it[1] as Double) }
  fun toLatLngBounds(array: List<*>?) = array?.let { LatLngBounds(it[0] as Double) }
}
data class LatLng(val longitude: Double, val latitude: Double)
data class CameraPosition(val target: LatLng?, val zoom: Double, val tilt: Double, val bearing: Double, val padding: DoubleArray?) {
  class Builder(private var camera: CameraPosition) {
    fun target(v: LatLng?) { camera = camera.copy(target = v) }
    fun zoom(v: Double) { camera = camera.copy(zoom = v) }
    fun tilt(v: Double) { camera = camera.copy(tilt = v) }
    fun bearing(v: Double) { camera = camera.copy(bearing = v) }
    fun padding(v: DoubleArray?) { camera = camera.copy(padding = v) }
    fun padding(left: Double, top: Double, right: Double, bottom: Double) {
      padding(doubleArrayOf(left, top, right, bottom))
    }
    fun build() = camera
  }
}
data class CameraUpdate(val position: CameraPosition?, val fit: List<Int> = emptyList())
fun newCameraPosition(position: CameraPosition) = CameraUpdate(position)
fun newLatLngBounds(bounds: LatLngBounds, left: Int, top: Int, right: Int, bottom: Int) =
  CameraUpdate(null, listOf(left, top, right, bottom))
object CameraEasing { const val NONE = 0; fun fromString(value: String?) = NONE }
interface CancelableCallback
data class CameraUpdateItem(val map: SDK, val update: CameraUpdate, val duration: Int, val easing: Int, val callback: CancelableCallback?)
class MLRNMapView(val mapLibreMap: SDK? = SDK(initialMaxZoom = 25.5)) {
  val contentInset = doubleArrayOf(1.0, 2.0, 3.0, 4.0)
  val width = 500; val height = 500
}
class CameraUpdateQueue {
  private var stop: CameraStop? = null
  var moves = mutableListOf<CameraUpdate>()
  fun offer(next: CameraStop?) { stop = next }
  fun execute(view: MLRNMapView) {
    val item = stop!!.toCameraUpdate(view)
    val position = item.update.position
    moves.add(item.update)
    if (position != null) {
      val map = item.map
      val padding = position.padding ?: map.pendingPadding ?: map.cameraPosition.padding
      map.pendingPadding = null
      map.cameraPosition = position.copy(zoom = position.zoom.coerceIn(map.minZoomLevel, map.maxZoomLevel), padding = padding)
    }
    stop = null
  }
}
${cameraStop}
}
fun main() {
  val box = Box()
  val map = RNMBXMapView()
  box.setMinZoomLevel(2.0); box.setMaxZoomLevel(8.0); box.setStop(BoxStop(4.0)); box.commitCameraProps()
  box.attach(map)
  check(box.moves == listOf(4.0))
  fun expectBox(min: Double?, max: Double?, effectiveMin: Double, effectiveMax: Double) {
    box.setMinZoomLevel(min); box.setMaxZoomLevel(max); box.commitCameraProps()
    check(map.sdk.minZoomLevel == effectiveMin && map.sdk.maxZoomLevel == effectiveMax)
  }
  expectBox(null, 8.0, 0.0, 8.0)
  check(box.moves == listOf(4.0))
  box.setStop(BoxStop(12.0)); box.setMaxZoomLevel(16.0); box.commitCameraProps()
  box.setMaxZoomLevel(18.0); box.setStop(BoxStop(17.0)); box.commitCameraProps()
  check(box.moves == listOf(4.0, 12.0, 17.0))
  expectBox(2.0, null, 2.0, 25.0)
  expectBox(0.0, 0.0, 0.0, 0.0)
  expectBox(11.0, 15.0, 11.0, 15.0)
  expectBox(2.0, 8.0, 2.0, 8.0)
  expectBox(null, null, 0.0, 25.0)
  for (west in listOf(-20.0, 30.0, -10.0)) {
    box.setMaxBounds(LatLngBounds(west)); box.commitCameraProps(); check(map.sdk.getBounds().bounds?.west == west)
  }
  box.setMaxBounds(null); box.commitCameraProps(); check(map.sdk.getBounds().bounds == CoordinateBounds.world())
  check(map.sdk.getBounds().minPitch == 3.0 && map.sdk.getBounds().maxPitch == 47.0)
  check(box.moves == listOf(4.0, 12.0, 17.0)) { "Bounds updates replayed a previous target" }

  val libre = Libre()
  val view = MLRNMapView()
  val sdk = view.mapLibreMap!!
  libre.setMinZoomLevel(3.0); libre.setMaxZoomLevel(8.0); libre.commitCameraProps()
  libre.attach(view)
  check(sdk.minZoomLevel == 3.0 && sdk.maxZoomLevel == 8.0)
  fun expectLibre(min: Double, max: Double, effectiveMin: Double, effectiveMax: Double) {
    libre.setMinZoomLevel(min); libre.setMaxZoomLevel(max); libre.commitCameraProps()
    check(sdk.minZoomLevel == effectiveMin && sdk.maxZoomLevel == effectiveMax)
  }
  expectLibre(-1.0, 8.0, 0.0, 8.0)
  fun options(vararg values: Pair<String, Any?>) = ReadableMap(mapOf(*values))
  libre.setStop(options("zoom" to 12.0)); libre.setMaxZoomLevel(16.0); libre.commitCameraProps()
  check(sdk.cameraPosition.zoom == 12.0)
  libre.setMaxZoomLevel(18.0); libre.setStop(options("zoom" to 17.0)); libre.commitCameraProps()
  check(sdk.cameraPosition.zoom == 17.0)
  expectLibre(3.0, -1.0, 3.0, 25.5)
  expectLibre(0.0, 0.0, 0.0, 0.0)
  expectLibre(11.0, 15.0, 11.0, 15.0)
  expectLibre(2.0, 8.0, 2.0, 8.0)
  expectLibre(-1.0, -1.0, 0.0, 25.5)
  for (west in listOf(-20.0, 30.0, -10.0)) {
    val bounds = LatLngBounds(west)
    libre.setMaxBounds(bounds)
    check(sdk.target === bounds)
  }
  libre.setMaxBounds(null); check(sdk.target == null)

  val before = sdk.cameraPosition
  libre.setStop(options("padding" to options("left" to 40, "bottom" to 10))); libre.commitCameraProps()
  check(sdk.cameraPosition.padding!!.toList() == listOf(81.0, 2.0, 3.0, 24.0))
  check(sdk.cameraPosition.target == before.target && sdk.cameraPosition.zoom == before.zoom)
  check(sdk.cameraPosition.tilt == before.tilt && sdk.cameraPosition.bearing == before.bearing)
  libre.handleImperativeStop(options("center" to listOf(9.0, 10.0)))
  check(sdk.cameraPosition.target == LatLng(9.0, 10.0))
  check(sdk.cameraPosition.padding!!.toList() == listOf(81.0, 2.0, 3.0, 24.0))
  libre.handleImperativeStop(options("center" to null, "padding" to options("left" to 0)))
  check(sdk.cameraPosition.target == LatLng(9.0, 10.0))
  check(sdk.cameraPosition.padding!!.toList() == view.contentInset.toList())
  libre.handleImperativeStop(options("bounds" to listOf(20.0), "padding" to options("right" to 8), "zoom" to 20.0))
  check(sdk.fitPadding == listOf(1, 2, 19, 4) && sdk.cameraPosition.zoom == 6.0)
  libre.handleImperativeStop(options("bounds" to listOf(21.0)))
  check(sdk.fitPadding == listOf(1, 2, 19, 4) && sdk.cameraPosition.target == LatLng(21.0, 10.0))
  sdk.pendingPadding = doubleArrayOf(20.0, 2.0, 3.0, 4.0)
  libre.handleImperativeStop(options("center" to listOf(22.0, 10.0)))
  check(sdk.cameraPosition.padding!!.toList() == listOf(20.0, 2.0, 3.0, 4.0)) { "An omitted stop inset overrode the pending map content inset" }
  sdk.pendingPadding = doubleArrayOf(25.0, 6.0, 3.0, 4.0)
  sdk.failFit = true
  libre.handleImperativeStop(options("bounds" to listOf(23.0)))
  check(libre.updateQueue.moves.last().fit == listOf(25, 6, 3, 4)) { "Fit ignored the pending map content inset" }
  val moves = libre.updateQueue.moves.size
  libre.setStop(options("duration" to 0, "zoom" to null, "bearing" to null, "pitch" to null)); libre.commitCameraProps()
  check(libre.stop == null && libre.updateQueue.moves.size == moves)
}
`
  );
  console.log(
    "PASS actual Swift and Objective-C++ camera methods: set, replace, clear and reapply; unrelated limits preserved."
  );
  if (runKotlin) {
    runKotlin([kotlinFile], join(temporary, "bounds.jar"));
    console.log(
      "PASS actual Kotlin camera bounds, zoom limit, and padding methods."
    );
  }
  console.log(
    "SDK boundaries are stubbed; renderer acceptance remains separate."
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
