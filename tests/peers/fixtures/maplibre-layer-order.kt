// Insert peer layer and manager here.

class Context
typealias ThemedReactContext = Context
abstract class AbstractMapFeature(val context: Context?) {
  abstract fun addToMap(mapView: MLRNMapView)
  abstract fun removeFromMap(mapView: MLRNMapView)
}
@Target(AnnotationTarget.FUNCTION)
annotation class ReactProp(val name: String, val defaultDouble: Double = 0.0, val defaultInt: Int = 0)
abstract class ViewGroupManager<T> {
  abstract fun getName(): String
  abstract fun createViewInstance(reactContext: ThemedReactContext): T
  open fun onAfterUpdateTransaction(layer: T) {}
}
object FLog { fun e(tag: String, message: String) {} }
object LocationComponentConstants { const val BACKGROUND_LAYER = "user-location" }
object Property { const val VISIBLE = "visible"; const val NONE = "none" }
object PropertyFactory { fun visibility(value: String) = value }
data class PropertyValue<T>(val name: String, val value: T)
data class Expression(val value: Boolean) {
  companion object { fun literal(value: Boolean) = Expression(value) }
}
class ReadableArray(val value: Boolean)
fun from(array: ReadableArray?) = array?.let { Expression(it.value) }
class ReadableMap(vararg fields: Pair<String, Any>) {
  val values = mapOf(*fields)
  fun hasKey(key: String) = values.containsKey(key)
  fun keySetIterator() = Keys(values.keys.iterator())
  class Keys(private val iterator: Iterator<String>) {
    fun hasNextKey() = iterator.hasNext()
    fun nextKey() = iterator.next()
  }
}
open class Layer(val id: String, val source: String? = null) {
  val fields = mutableMapOf<String, Any>()
  var minimum = Float.NEGATIVE_INFINITY
  var maximum = Float.POSITIVE_INFINITY
  var predicate: Expression? = null
  fun setMinZoom(zoom: Float) { minimum = zoom }
  fun setMaxZoom(zoom: Float) { maximum = zoom }
  fun setFilter(filter: Expression) { predicate = filter }
  fun setProperties(visibility: String) { fields["visibility"] = visibility }
  fun setProperties(property: PropertyValue<*>) {
    val pieces = property.name.split("-")
    val key = pieces.first() + pieces.drop(1).joinToString("") { it.replaceFirstChar(Char::uppercase) }
    if (key.endsWith("Transition")) check(property.value is Map<*, *> && property.value.isEmpty())
    else check(property.value == null)
    fields.remove(key)
  }
  fun setSourceLayer(sourceLayer: String?) {}
}
// Declare SDK layer types here.
class Style {
  private val stack = mutableListOf<Layer>()
  fun getLayer(id: String) = stack.find { it.id == id }
  fun getLayers() = stack.toList()
  fun removeLayer(layer: Layer) = stack.remove(layer)
  fun addLayer(layer: Layer) {
    check(getLayer(layer.id) == null)
    stack.add(layer)
  }
  fun addLayerAt(layer: Layer, index: Int) {
    check(index in stack.indices)
    check(getLayer(layer.id) == null)
    stack.add(index, layer)
  }
  fun addLayerBelow(layer: Layer, anchor: String) =
    addLayerAt(layer, stack.indexOfFirst { it.id == anchor })
  fun addLayerAbove(layer: Layer, anchor: String) {
    val index = stack.indexOfFirst { it.id == anchor } + 1
    if (index == stack.size) addLayer(layer) else addLayerAt(layer, index)
  }
}
class MapLibreMap(var style: Style? = Style())
class MLRNMapView(val mapLibreMap: MapLibreMap = MapLibreMap()) {
  interface FoundLayerCallback { fun found(layer: Layer?) }
  val waiters = mutableMapOf<String, MutableList<FoundLayerCallback>>()
  fun waitForLayer(id: String, callback: FoundLayerCallback) {
    val layer = mapLibreMap.style!!.getLayer(id)
    if (layer != null) callback.found(layer)
    else waiters.getOrPut(id) { mutableListOf() }.add(callback)
  }
  fun layerAdded(layer: Layer) {
    waiters.remove(layer.id)?.forEach { it.found(layer) }
  }
}
typealias FoundLayerCallback = MLRNMapView.FoundLayerCallback
class MLRNStyle(context: Context?, val fields: ReadableMap, map: MapLibreMap, isCurrent: () -> Boolean = { true })
object MLRNStyleFactory {
  // Implement style setters here.
}

data class Props(
  val after: String? = null, val before: String? = null, val index: Int? = null,
  val minzoom: Double? = null, val maxzoom: Double? = null,
  val filter: ReadableArray? = null, val fields: ReadableMap? = null
)
val manager = MLRNLayerManager()
// Insert bridge defaults here.
fun update(layer: MLRNLayer, old: Props, next: Props) {
  if (old.after != next.after) manager.setAfterId(layer, next.after)
  if (old.before != next.before) manager.setBeforeId(layer, next.before)
  if (old.index != next.index) manager.setLayerIndex(layer, next.index ?: defaultIndex)
  if (old.minzoom != next.minzoom) manager.setMinzoom(layer, next.minzoom ?: defaultZoom)
  if (old.maxzoom != next.maxzoom) manager.setMaxzoom(layer, next.maxzoom ?: defaultZoom)
  if (old.filter != next.filter) manager.setFilter(layer, next.filter)
  if (old.fields != next.fields) manager.setReactStyle(layer, next.fields)
  manager.onAfterUpdateTransaction(layer)
}
fun mount(map: MLRNMapView, id: String, props: Props = Props()): MLRNLayer {
  val layer = manager.createViewInstance(Context())
  manager.setId(layer, id)
  manager.setLayerType(layer, "line")
  manager.setSource(layer, "$id-source")
  update(layer, Props(), props)
  layer.addToMap(map)
  return layer
}
fun Style.ids() = getLayers().map { it.id }
fun main() {
  val map = MLRNMapView()
  val style = map.mapLibreMap.style!!
  style.addLayer(BackgroundLayer("base"))
  mount(map, "first")
  val initial = Props(minzoom = 2.0, maxzoom = 18.0, filter = ReadableArray(false),
    fields = ReadableMap("lineWidth" to 2, "lineOpacity" to 0.6,
      "lineWidthTransition" to 200, "visibility" to "none"))
  val middle = mount(map, "middle", initial)
  mount(map, "last")
  val order = listOf("base", "first", "middle", "last")

  val updated = initial.copy(fields = ReadableMap("lineWidth" to 3, "lineOpacity" to 0.7,
    "lineWidthTransition" to 200, "visibility" to "none"))
  val old = style.getLayer("middle")
  update(middle, initial, updated)
  check(style.getLayer("middle") === old)
  check(old?.fields?.get("lineWidth") == 3)

  val reset = updated.copy(fields = ReadableMap("lineOpacity" to 0.7))
  update(middle, updated, reset)
  val current = style.getLayer("middle")!!
  check(current === old)
  check("lineWidth" !in current.fields) { "removed paint must reset" }
  check("lineWidthTransition" !in current.fields && "visibility" !in current.fields)
  check(current.fields["lineOpacity"] == 0.7)
  check(style.ids() == order) { "reset must preserve full SDK order" }
  check(current.minimum == 2.0f && current.maximum == 18.0f)
  check(current.predicate == Expression(false))

  val cleared = Props()
  update(middle, reset, cleared)
  val clearedLayer = style.getLayer("middle")!!
  check(style.ids() == order && clearedLayer.fields.isEmpty())
  check(clearedLayer.minimum == Float.NEGATIVE_INFINITY && clearedLayer.maximum == Float.POSITIVE_INFINITY)
  check(clearedLayer.predicate != Expression(false))

  val placed = Props(after = "last", before = "first", index = 0)
  update(middle, cleared, placed)
  check(style.ids() == listOf("base", "first", "last", "middle"))
  update(middle, placed, placed.copy(before = "base"))
  check(style.ids() == listOf("base", "first", "last", "middle"))

  val afterRemoved = Props(before = "base", index = 0)
  update(middle, placed.copy(before = "base"), afterRemoved)
  check(style.ids() == listOf("middle", "base", "first", "last"))
  val indexOnly = Props(index = 2)
  update(middle, afterRemoved, indexOnly)
  check(style.ids() == order)
  update(middle, indexOnly, cleared)
  check(style.ids() == listOf("base", "first", "last", "middle"))

  val beforeZoom = style.getLayer("middle")!!
  val atZero = Props(minzoom = 0.0, maxzoom = 0.0)
  update(middle, cleared, atZero)
  check(beforeZoom.minimum == 0.0f && beforeZoom.maximum == 0.0f)
  update(middle, atZero, cleared)
  check(style.getLayer("middle") === beforeZoom)
  check(beforeZoom.minimum == Float.NEGATIVE_INFINITY && beforeZoom.maximum == Float.POSITIVE_INFINITY)

  val waiting = initial.copy(after = "anchor")
  val later = mount(map, "waiting", waiting)
  update(later, waiting, cleared.copy(after = "anchor"))
  check(style.getLayer("waiting") == null)
  mount(map, "anchor")
  check(style.ids() == listOf("base", "first", "last", "middle", "anchor", "waiting"))
  check(style.getLayer("waiting")!!.fields.isEmpty())
  val retired = mount(map, "retired", Props(before = "obsolete-anchor"))
  retired.removeFromMap(map)
  map.layerAdded(BackgroundLayer("obsolete-anchor"))
  check(style.getLayer("retired") == null)

  later.removeFromMap(map)
  middle.removeFromMap(map)
  mount(map, "middle")
  check(style.ids() == listOf("base", "first", "last", "anchor", "middle"))

  val soloMap = MLRNMapView()
  val sole = mount(soloMap, "sole", initial)
  update(sole, initial, cleared)
  check(soloMap.mapLibreMap.style!!.ids() == listOf("sole"))
  val soloStyle = soloMap.mapLibreMap.style!!
  check(soloStyle.getLayer("sole")!!.fields.isEmpty())
  val authored = LineLayer("authored", "original-source")
  authored.fields["lineColor"] = "original"
  soloStyle.addLayer(authored)
  val adopted = mount(soloMap, "authored", initial)
  update(adopted, initial, cleared)
  check(soloStyle.getLayer("authored") === authored)
  check(authored.source == "original-source" && authored.fields == mapOf("lineColor" to "original"))
}
