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
import { join } from "node:path";

const mapboxRoot = process.argv[3] ?? "node_modules/@rnmapbox/maps";
const maplibreRoot =
  process.argv[4] ?? "node_modules/@maplibre/maplibre-react-native";

// Keep source-boundary proof available when the optional Kotlin compiler is absent.
if (process.argv[2] !== "maplibre") {
  const compat = readFileSync(
    join(
      mapboxRoot,
      "android/src/main/mapbox-v11-compat/v11/com/rnmapbox/rnmbx/v11compat/MapboxMap.kt"
    ),
    "utf8"
  );
  const forwardsSetError =
    /this\.setFeatureState\([^)]*\)\s*\{\s*expected ->\s*callback\(expected\)/;
  const forwardsRemoveError =
    /this\.removeFeatureState\([^)]*\)\s*\{\s*expected ->\s*callback\(expected\)/;
  assert.match(compat, forwardsSetError);
  assert.match(compat, forwardsRemoveError);
  // A swallowed set error must fail even when the later remove callback is correct.
  const swallowedSet = compat.replace(
    forwardsSetError,
    "this.setFeatureState() { _ -> callback(createNone())"
  );
  assert.notEqual(swallowedSet, compat);
  assert.doesNotMatch(swallowedSet, forwardsSetError);
  assert.match(swallowedSet, forwardsRemoveError);
  const view = readFileSync(
    join(
      mapboxRoot,
      "android/src/main/java/com/rnmapbox/rnmbx/components/mapview/RNMBXMapView.kt"
    ),
    "utf8"
  );
  const remove = view.slice(
    view.indexOf("    fun removeFeatureState("),
    view.indexOf("    fun match(")
  );
  assert.match(
    remove,
    /source == null.*sourceLayerId != null.*source !is VectorSource/
  );
  assert.match(remove, /response.error\("source_not_attached"\)\s*return/);
  assert(
    remove.indexOf("source_not_attached") <
      remove.indexOf("removeFeatureStateCompat(")
  );
}
if (process.argv[2] !== "mapbox") {
  const resolver = readFileSync(
    join(
      maplibreRoot,
      "android/src/main/java/org/maplibre/reactnative/utils/ReactTagResolver.kt"
    ),
    "utf8"
  );
  assert.match(
    resolver,
    /resolvedView == null[^]*?reject\("view_not_attached", message\)/
  );
  const missing = resolver.slice(
    resolver.indexOf("catch (err: IllegalViewOperationException)")
  );
  assert.match(missing, /reject\("view_not_attached", err\)/);
  assert.doesNotMatch(missing, /awaitedViews.getOrPut/);
}
console.log(
  "PASS native explicit-state error/family and absent-Fabric-view source boundaries"
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
if (!jars.some((path) => path.includes("kotlin-compiler-embeddable"))) {
  console.log(
    "SKIP native source-lifetime regression: cached Kotlin compiler required."
  );
  process.exit(0);
}
const section = (file, start, end) => {
  const source = readFileSync(file, "utf8");
  const first = source.indexOf(start);
  const last = source.indexOf(end, first + start.length);
  assert(first >= 0 && last > first, `Missing native section ${start}`);
  return source.slice(first, last);
};
const mapbox = `${mapboxRoot}/android/src/main/`;
const resolver = readFileSync(
  `${maplibreRoot}/android/src/main/java/org/maplibre/reactnative/utils/ReactTagResolver.kt`,
  "utf8"
).replace(/^(?:package|import) .*\n/gm, "");
const temporary = mkdtempSync(join(tmpdir(), "one-map-source-lifetime-"));
const run = (command, args) => {
  const result = spawnSync(command, args, { encoding: "utf8", timeout: 60000 });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return result.stdout;
};
try {
  const bindgen = join(temporary, "Bindgen.kt");
  writeFileSync(
    bindgen,
    `package com.mapbox.bindgen
class None
class Value
class Expected<E,V>(val error: E?, val value: V?) { fun isError() = error != null }
object ExpectedFactory { fun <E> createNone() = Expected<E,None>(null, None()) }
`
  );
  const kotlin = join(temporary, "Lifetime.kt");
  writeFileSync(
    kotlin,
    `import com.mapbox.bindgen.*
class MapboxMap {
  var outcome = Expected<String,None>(null,None())
  var calls = 0
  var currentStyle: Style? = Style(VectorSource())
  fun getStyle() = currentStyle
  fun setFeatureState(source: String, layer: String?, id: String, state: Value, callback: (Expected<String,None>)->Unit) { calls++; callback(outcome) }
  fun removeFeatureState(source: String, layer: String?, id: String, key: String?, callback: (Expected<String,None>)->Unit) { calls++; callback(outcome) }
}
class VectorSource
class GeoJsonSource
class Style(var source: Any?) { fun getSource(id: String) = source }
class MapContainer(val sdk: MapboxMap) { fun getMapboxMap() = sdk }
class CommandResponse {
  var error: String? = null; var successes = 0
  fun error(value: String) { error = value }
  fun success(body: ()->Unit) { successes++; body() }
}
${section(mapbox + "mapbox-v11-compat/v11/com/rnmapbox/rnmbx/v11compat/MapboxMap.kt", "fun MapboxMap.setFeatureStateCompat(", "fun MapboxMap.flyToV11(")}
class Wrapper(val sdk: MapboxMap) {
  val mapView = MapContainer(sdk)
  ${section(mapbox + "java/com/rnmapbox/rnmbx/components/mapview/RNMBXMapView.kt", "    fun removeFeatureState(", "    fun match(")}
}
open class View
class IllegalViewOperationException: RuntimeException()
class Promise { var code: String? = null; var error: Throwable? = null
  fun reject(value: Throwable) { error = value }
  fun reject(value: String, cause: Throwable) { code = value; error = cause }
  fun reject(value: String, message: String) { code = value; error = RuntimeException(message) }
}
class UIManager { var view: View? = null; var missing = false; fun resolveView(tag: Int): View? { if (missing) throw IllegalViewOperationException(); return view } }
class ReactApplicationContext { val manager = UIManager(); fun runOnUiQueueThread(body: ()->Unit) { body() } }
object UIManagerType { val FABRIC = 2 }
object UIManagerHelper { fun getUIManager(context: ReactApplicationContext, type: Int): UIManager? = context.manager }
object Logger { fun e(tag: String, message: String) {} }
${resolver}
fun checkMapbox() {
  val sdk = MapboxMap()
  sdk.outcome = Expected("source unavailable", null)
  var calls = 0
  sdk.setFeatureStateCompat("source", "routes", "1", Value()) { calls++; check(it.error == "source unavailable") { "SDK set errors must not be acknowledged as success" } }
  sdk.removeFeatureStateCompat("source", "routes", "1", null) { calls++; check(it.error == "source unavailable") { "SDK remove errors must remain observable" } }
  check(calls == 2)
  sdk.outcome = Expected(null, None())
  sdk.removeFeatureStateCompat("source", "routes", "1", null) { check(!it.isError()) }
  val wrapper = Wrapper(sdk)
  for (source in listOf(null, GeoJsonSource())) {
    sdk.currentStyle = Style(source); val before = sdk.calls; val response = CommandResponse()
    wrapper.removeFeatureState("1", null, "source", "routes", response)
    check(response.error == "source_not_attached" && response.successes == 0 && sdk.calls == before) { "Explicit vector state removal must reject an absent or changed source family" }
  }
  sdk.currentStyle = Style(VectorSource()); sdk.outcome = Expected("actual SDK failure",null)
  val failure = CommandResponse(); wrapper.removeFeatureState("1",null,"source","routes",failure)
  check(failure.error == "actual SDK failure" && failure.successes == 0)
  sdk.outcome = Expected(null,None()); val success = CommandResponse(); wrapper.removeFeatureState("1",null,"source","routes",success)
  check(success.error == null && success.successes == 1)
}
fun checkMaplibre() {
  val context = ReactApplicationContext(); val resolver = ReactTagResolver(context); val promise = Promise(); var dispatched = false
  resolver.withViewResolved<View>(154,promise) { dispatched = true }
  check(!dispatched && promise.code == "view_not_attached") { "Fabric null-view attachment gap must be recognizable without dispatch or poisoning cleanup" }
  context.manager.missing = true
  val unpublished = Promise()
  resolver.withViewResolved<View>(158,unpublished) { dispatched = true }
  check(!dispatched && unpublished.code == "view_not_attached") { "Thrown unpublished-view gap must reject recognizably instead of waiting forever" }
  context.manager.missing = false
  val view = View(); context.manager.view = view
  resolver.withViewResolved<View>(154,Promise()) { check(it === view); dispatched = true }
  check(dispatched)
}
fun main(args: Array<String>) {
  if (args.firstOrNull() != "maplibre") checkMapbox()
  if (args.firstOrNull() != "mapbox") checkMaplibre()
  println("PASS actual Kotlin feature-state errors, source-family attachment and Fabric null-view resolution")
}
`
  );
  const classes = join(temporary, "classes");
  run("java", [
    "-cp",
    jars.join(":"),
    "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler",
    "-no-stdlib",
    "-no-reflect",
    "-classpath",
    jars.join(":"),
    bindgen,
    kotlin,
    "-d",
    classes,
  ]);
  console.log(
    run("java", [
      "-cp",
      [classes, ...jars].join(":"),
      "LifetimeKt",
      ...process.argv.slice(2, 3),
    ]).trim()
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
