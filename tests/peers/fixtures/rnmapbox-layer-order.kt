import java.lang.ref.WeakReference

typealias FoundLayerCallback = RNMBXMapView.FoundLayerCallback

class Context
class MapboxMap
class ReadableArray(val expression: Expression?)
class Expression(val name: String)
fun all(content: () -> Unit): Expression = Expression("all")
object ExpressionParser {
    fun from(array: ReadableArray?): Expression? = array?.expression
}

class ReadableMap(val values: Map<String, Any>) {
    fun hasKey(key: String): Boolean = values.containsKey(key)
    fun keySetIterator() = object : Keys {
        val keys = values.keys.iterator()
        override fun hasNextKey() = keys.hasNext()
        override fun nextKey() = keys.next()
    }
}
interface Keys {
    fun hasNextKey(): Boolean
    fun nextKey(): String
}

class RNMBXStyle(
    context: Context,
    val props: ReadableMap?,
    map: MapboxMap,
    val isCurrent: () -> Boolean = { true }
)
object FLog {
    fun e(tag: String, message: String) {}
}
object Logger {
    fun w(tag: String, message: String) {}
    fun e(tag: String, message: String) {}
    fun logged(tag: String, operation: () -> Unit) = operation()
}
enum class Visibility { VISIBLE, NONE }
enum class RemovalReason { VIEW_REMOVAL, REORDER, STYLE_CHANGE }

abstract class AbstractSourceConsumer(val context: Context) {
    abstract val iD: String?
    protected var mMapView: RNMBXMapView? = null
    open fun addToMap(mapView: RNMBXMapView) { mMapView = mapView }
    open fun removeFromMap(mapView: RNMBXMapView, reason: RemovalReason): Boolean {
        mMapView = null
        return true
    }
}

class Value(val contents: Any?) {
    companion object {
        fun nullValue() = Value(null)
        fun valueOf(values: HashMap<String, Value>) = Value(values)
    }
}

data class Result<T>(val value: T? = null, val error: String? = null)
data class LayerPosition(val above: String?, val below: String?, val index: Int?)

open class Layer(val layerId: String) {
    var style: Style? = null
    val cached = mutableMapOf("id" to Value(layerId))
    var original: Map<String, Value>? = null

    fun set(key: String, newValue: Any) {
        val value = Value(newValue)
        cached[key] = value
        style?.layers?.getValue(layerId)?.set(key, value)
    }
    fun minZoom(value: Double) = set("minzoom", value)
    fun maxZoom(value: Double) = set("maxzoom", value)
    fun visibility(value: Visibility) = set("visibility", value)
    fun slot(value: String) = set("slot", value)
}

class Style {
    val layers = linkedMapOf<String, MutableMap<String, Value>>()
    val order = mutableListOf<String>()
    var replacements = 0
    var rejectNull = false
    var materializeOutlineDefault = false
    data class LayerInfo(val id: String)

    val styleLayers: List<LayerInfo>
        get() = order.map(::LayerInfo)
    fun styleLayerExists(id: String) = id in layers
    fun getLayer(id: String): Layer? = layers[id]?.let {
        Layer(id).apply {
            style = this@Style
            original = it.toMap()
        }
    }
    fun getStyleLayerProperties(id: String): Result<Value> =
        Result(layers[id]?.let { Value(it.toMap()) })
    fun setStyleLayerProperty(id: String, property: String, value: Value): Result<Unit> {
        check(value.contents == null)
        if (rejectNull) return Result(error = "reset unsupported")
        if (materializeOutlineDefault && property == "fill-outline-color") {
            layers.getValue(id)[property] = Value("black")
        } else {
            layers.getValue(id).remove(property)
        }
        return Result(Unit)
    }
    fun addStyleLayer(raw: Value, position: LayerPosition?): Result<Unit> {
        val original = raw.contents as Map<*, *>
        val layerId = (original["id"] as Value).contents as String
        val layer = Layer(layerId)
        for ((key, value) in original) {
            layer.cached[key as String] = value as Value
        }
        if (position == null) addLayer(layer) else addLayerAt(layer, position.index!!)
        return Result(Unit)
    }
    fun addLayer(layer: Layer) = addLayerAt(layer, order.size)
    fun addLayerBelow(layer: Layer, anchor: String) = addLayerAt(layer, order.indexOf(anchor))
    fun addLayerAbove(layer: Layer, anchor: String) = addLayerAt(layer, order.indexOf(anchor) + 1)
    fun addLayerAt(layer: Layer, index: Int) {
        check(layer.layerId !in layers)
        val raw = layer.original?.toMutableMap() ?: mutableMapOf()
        raw.putAll(layer.cached)
        layers[layer.layerId] = raw
        order.add(index, layer.layerId)
        layer.style = this
        replacements++
    }
    fun removeStyleLayer(id: String): Result<Unit> {
        layers.remove(id)
        order.remove(id)
        return Result(Unit)
    }
}

class RNMBXMapView(var savedStyle: Style?) {
    interface FoundLayerCallback { fun found(layer: Layer?) }
    val waiters = mutableMapOf<String, MutableList<FoundLayerCallback>>()
    fun getMapboxMap() = MapboxMap()
    fun waitForLayer(id: String, callback: FoundLayerCallback) {
        val layer = savedStyle?.getLayer(id)
        if (layer != null) callback.found(layer)
        else waiters.getOrPut(id, ::mutableListOf).add(callback)
    }
    fun layerAdded(layer: Layer) {
        waiters.remove(layer.layerId)?.forEach { it.found(layer) }
    }
}

// Insert peer layer implementation here.

class RecordingLayer(id: String) : RNMBXLayer<Layer>(Context()) {
    init { this.iD = id }
    override fun makeLayer() = Layer(iD!!)
    override fun addStyles() {
        val native = mLayer!!
        for ((key, value) in mReactStyle?.values.orEmpty()) {
            when (key) {
                "circleRadius" -> native.set("circle-radius", value)
                "circleRadiusTransition" -> native.set("circle-radius-transition", value)
                "fillColor" -> native.set("fill-color", value)
                "fillOutlineColor" -> native.set("fill-outline-color", value)
                "visibility" -> native.set("visibility", value)
                else -> error("Unexpected style prop: $key")
            }
        }
    }
    override fun updateFilter(expression: Expression?) {
        mLayer!!.set("filter", expression!!.name)
    }
}

fun assertStyleReset(style: Style) {
    val fields = style.layers.getValue("editable")
    check("circle-radius" !in fields) { "Cleared paint property persisted" }
    check("circle-radius-transition" !in fields) { "Cleared transition persisted" }
    check("visibility" !in fields) { "Cleared layout property persisted" }
}

fun clearZoom(editable: RecordingLayer) {
    // Exercise nullable zoom setters while allowing the unpatched peer to compile.
    editable.javaClass.getMethod("setMinZoomLevel", java.lang.Double::class.java)
        .invoke(editable, null)
    editable.javaClass.getMethod("setMaxZoomLevel", java.lang.Double::class.java)
        .invoke(editable, null)
}

fun reapplyAtEnd(layer: RecordingLayer, style: Style) {
    layer.setLayerIndex(style.order.size)
    layer.setReactStyle(ReadableMap(mapOf("circleRadius" to 9)))
    style.rejectNull = true
    layer.setReactStyle(ReadableMap(emptyMap()))
    style.rejectNull = false
    check(style.order.last() == "editable")
    assertStyleReset(style)
}

fun main() {
    val style = Style()
    val map = RNMBXMapView(style)
    style.addLayer(Layer("basemap"))
    val editable = RecordingLayer("editable").apply {
        setReactStyle(ReadableMap(mapOf(
            "circleRadius" to 20, "circleRadiusTransition" to 30, "visibility" to "none"
        )))
        setFilter(ReadableArray(Expression("has")))
        setMinZoomLevel(3.0)
        setMaxZoomLevel(9.0)
        addToMap(map)
    }
    style.addLayer(Layer("other-source"))
    style.addLayer(Layer("raw-layer"))
    val props = style.layers.getValue("editable")
    check(props["circle-radius"]?.contents == 20)
    props["metadata"] = Value("externally-added")
    editable.setReactStyle(ReadableMap(mapOf("circleRadius" to 10)))
    editable.setReactStyle(ReadableMap(emptyMap()))
    assertStyleReset(style)
    clearZoom(editable)
    editable.setFilter(ReadableArray(null))
    check(props["filter"]?.contents == "all")
    check("minzoom" !in props && "maxzoom" !in props)
    check(props["metadata"]?.contents == "externally-added")
    check(style.order == listOf("basemap", "editable", "other-source", "raw-layer"))
    check(style.replacements == 4) { "Supported reset rebuilt the layer" }

    val captureStyle = RNMBXLayer::class.java.getDeclaredMethod("layerStyle").apply { isAccessible = true }
    val beforeReset = captureStyle.invoke(editable) as RNMBXStyle
    check(beforeReset.isCurrent())
    editable.setReactStyle(ReadableMap(mapOf("circleRadius" to 9)))
    check(!beforeReset.isCurrent()) { "Delayed image setter still owns old props" }
    editable.setReactStyle(ReadableMap(emptyMap()))

    val beforeMove = captureStyle.invoke(editable) as RNMBXStyle
    editable.setBelowLayerID("basemap")
    check(beforeMove.isCurrent()) { "Moving the same layer retired its pending image" }
    check(style.order == listOf("editable", "basemap", "other-source", "raw-layer"))
    editable.setReactStyle(ReadableMap(mapOf("circleRadius" to 7)))
    style.rejectNull = true
    editable.setReactStyle(ReadableMap(emptyMap()))
    assertStyleReset(style)
    check(style.order == listOf("editable", "basemap", "other-source", "raw-layer"))
    check(style.layers.getValue("editable")["metadata"]?.contents == "externally-added")
    style.rejectNull = false

    editable.setReactStyle(ReadableMap(mapOf("fillColor" to "red", "fillOutlineColor" to "blue")))
    style.materializeOutlineDefault = true
    editable.setReactStyle(ReadableMap(mapOf("fillColor" to "green")))
    val paint = style.layers.getValue("editable")
    check("fill-outline-color" !in paint) { "Outline must inherit the current fill" }
    check(paint["fill-color"]?.contents == "green")
    check(style.order == listOf("editable", "basemap", "other-source", "raw-layer"))

    val pending = RecordingLayer("waiting").apply {
        setBelowLayerID("arrives-later")
        setReactStyle(ReadableMap(mapOf("circleRadius" to 7)))
        addToMap(map)
    }
    pending.setReactStyle(ReadableMap(emptyMap()))
    val anchor = Layer("arrives-later")
    style.addLayer(anchor)
    map.layerAdded(anchor)
    check("circle-radius" !in style.layers.getValue("waiting"))
    check(style.order.takeLast(2) == listOf("waiting", "arrives-later"))

    pending.setBelowLayerID("next-anchor")
    pending.setMinZoomLevel(4.0)
    pending.setReactStyle(ReadableMap(mapOf("circleRadius" to 8)))
    pending.setFilter(ReadableArray(Expression("updated")))
    val nextAnchor = Layer("next-anchor")
    style.addLayer(nextAnchor)
    map.layerAdded(nextAnchor)
    val moved = style.layers.getValue("waiting")
    check(moved["minzoom"]?.contents == 4.0 && moved["filter"]?.contents == "updated")
    check(moved["circle-radius"]?.contents == 8)
    check(style.order.takeLast(2) == listOf("waiting", "next-anchor"))

    val detached = RecordingLayer("detached").apply {
        setBelowLayerID("anchor-after-unmount")
        addToMap(map)
    }
    detached.removeFromMap(map, RemovalReason.VIEW_REMOVAL)
    val lateAnchor = Layer("anchor-after-unmount")
    style.addLayer(lateAnchor)
    map.layerAdded(lateAnchor)
    check(!style.styleLayerExists("detached"))

    val beforeDetach = captureStyle.invoke(editable) as RNMBXStyle
    check(beforeDetach.isCurrent())
    editable.removeFromMap(map, RemovalReason.VIEW_REMOVAL)
    check(!beforeDetach.isCurrent())
    val remounted = RecordingLayer("editable")
    remounted.addToMap(map)
    check(style.order.last() == "editable")
    assertStyleReset(style)

    remounted.setReactStyle(ReadableMap(mapOf("circleRadius" to 9)))
    remounted.setReactStyle(ReadableMap(emptyMap()))
    reapplyAtEnd(remounted, style)
    val beforeReload = captureStyle.invoke(remounted) as RNMBXStyle
    remounted.removeFromMap(map, RemovalReason.STYLE_CHANGE)
    val reloaded = Style()
    map.savedStyle = reloaded
    reloaded.addLayer(Layer("reloaded-basemap"))
    remounted.addToMap(map)
    check(!beforeReload.isCurrent())
    check(reloaded.order == listOf("reloaded-basemap", "editable"))
    assertStyleReset(reloaded)
    println("PASS RNMapbox Android layer reset and style order")
}
