import Foundation

public final class RCTBridge {}
public class UIView {}
protocol RNMBXMapComponent {}
public enum RemovalReason { case viewRemoval }

struct Logger {
  enum Level { case warn, error }
  static func log(level: Level, message: String, error: Error? = nil) {
    if level == .error { print(message, error as Any) }
  }
}

extension String.StringInterpolation {
  mutating func appendInterpolation<T>(optional value: T?) {
    appendInterpolation(String(describing: value))
  }
}

func logged(_ tag: String, info: () -> String, operation: () throws -> Void) {
  do { try operation() } catch { preconditionFailure("\(tag) \(info()): \(error)") }
}

enum Slot: String { case top, middle, bottom }
enum MapboxMaps { struct Expression {} }
protocol Source {}
final class RNMBXStyle {
  weak var bridge: RCTBridge?
  var isLayerImageCurrent: (String, Any) -> Bool = { _, _ in true }
  init(style: Style) {}
}
enum LayerPosition { case below(String), above(String), at(Int), `default` }

protocol Layer {
  init(jsonObject: [String: Any]) throws
  var id: String { get }
  var minZoom: Double? { get set }
  var maxZoom: Double? { get set }
  var slot: Slot? { get set }
  func jsonObject() throws -> [String: Any]
}

struct TestLayer: Layer {
  var id: String
  var minZoom: Double?
  var maxZoom: Double?
  var slot: Slot?
  var layout: [String: Any] = [:]
  var paint: [String: Any] = [:]
  var filter: [Any]?
  var metadata: String?

  init(_ id: String) { self.id = id }
  init(jsonObject: [String: Any]) throws {
    id = jsonObject["id"] as! String
    minZoom = jsonObject["minzoom"] as? Double
    maxZoom = jsonObject["maxzoom"] as? Double
    slot = (jsonObject["slot"] as? String).flatMap(Slot.init(rawValue:))
    layout = jsonObject["layout"] as? [String: Any] ?? [:]
    paint = jsonObject["paint"] as? [String: Any] ?? [:]
    filter = jsonObject["filter"] as? [Any]
    metadata = jsonObject["metadata"] as? String
  }

  func jsonObject() throws -> [String: Any] {
    var result: [String: Any] = ["id": id, "layout": layout, "paint": paint]
    result["minzoom"] = minZoom
    result["maxzoom"] = maxZoom
    result["slot"] = slot?.rawValue
    result["filter"] = filter
    result["metadata"] = metadata
    return result
  }
}

public final class Style {
  enum Failure: Error { case unavailable, rejected }
  var order: [String] = []
  var layers: [String: TestLayer] = [:]
  var rejectNull = false
  var materializeOutlineDefault = false
  var replacements = 0
  var allLayerIdentifiers: [(id: String, type: String)] {
    order.map { ($0, "circle") }
  }

  func source<T: Source>(withId id: String, type: T.Type) throws -> T { fatalError() }
  func layerExists(withId id: String) -> Bool { layers[id] != nil }
  func layer(withId id: String) throws -> Layer {
    guard let entry = layers[id] else { throw Failure.unavailable }
    return entry
  }
  func layerProperties(for id: String) throws -> [String: Any] {
    return try layer(withId: id).jsonObject()
  }
  func addLayer(_ layer: Layer, layerPosition: LayerPosition) throws {
    try addLayer(with: layer.jsonObject(), layerPosition: layerPosition)
  }
  func addLayer(with properties: [String: Any], layerPosition: LayerPosition) throws {
    let layer = try TestLayer(jsonObject: properties)
    precondition(!layerExists(withId: layer.id))
    let index: Int
    switch layerPosition {
    case .below(let id): index = order.firstIndex(of: id)!
    case .above(let id): index = order.firstIndex(of: id)! + 1
    case .at(let value): index = value
    case .default: index = order.endIndex
    }
    order.insert(layer.id, at: index)
    layers[layer.id] = layer
    replacements += 1
  }
  func removeLayer(withId id: String) throws {
    guard let index = order.firstIndex(of: id) else { throw Failure.unavailable }
    order.remove(at: index)
    layers[id] = nil
  }
  func setLayerProperty(for id: String, property: String, value: Any) throws {
    precondition(value is NSNull)
    if rejectNull { throw Failure.rejected }
    var raw = try layerProperties(for: id)
    if materializeOutlineDefault && property == "fill-outline-color" {
      var paint = raw["paint"] as? [String: Any] ?? [:]
      paint[property] = "black"
      raw["paint"] = paint
      layers[id] = try TestLayer(jsonObject: raw)
      return
    }
    raw[property] = nil
    for kind in ["layout", "paint"] {
      var fields = raw[kind] as? [String: Any]
      fields?[property] = nil
      raw[kind] = fields
    }
    layers[id] = try TestLayer(jsonObject: raw)
  }
}

public final class RNMBXMapView {
  let mapboxMap: (style: Style, unused: Bool)
  var waiters: [String: [(String) -> Void]] = [:]
  init(_ style: Style) { mapboxMap = (style, false) }
  func layerAdded(_ layer: Layer) {
    waiters.removeValue(forKey: layer.id)?.forEach { $0(layer.id) }
  }
  func waitForLayerWithID(_ id: String, _ callback: @escaping (String) -> Void) {
    if mapboxMap.style.layerExists(withId: id) {
      callback(id)
    } else {
      waiters[id, default: []].append(callback)
    }
  }
}

// Insert peer layer implementation here.

final class RecordingLayer: RNMBXLayer {
  override func makeLayer(style: Style) throws -> Layer { TestLayer(id) }
  override func layerType() -> Layer.Type { TestLayer.self }
  override func setOptions(_ layer: inout Layer) {
    super.setOptions(&layer)
    var typed = layer as! TestLayer
    if let filter = filter, !filter.isEmpty { typed.filter = filter }
    layer = typed
  }
  override func apply(style: Style) throws {
    precondition(style.layerExists(withId: id))
    style.layers[id] = styleLayer as? TestLayer
  }
  override func addStyles() {
    var layer = styleLayer as! TestLayer
    for (key, value) in reactStyle ?? [:] {
      switch key {
      case "circleRadius": layer.paint["circle-radius"] = value
      case "circleRadiusTransition": layer.paint["circle-radius-transition"] = value
      case "fillColor": layer.paint["fill-color"] = value
      case "fillOutlineColor": layer.paint["fill-outline-color"] = value
      case "visibility": layer.layout["visibility"] = value
      case "iconImage": layer.layout["icon-image"] = value
      default: preconditionFailure(key)
      }
    }
    styleLayer = layer
  }
}

func drainStyles() {
  var drained = false
  DispatchQueue.main.async { drained = true }
  while !drained {
    _ = RunLoop.current.run(mode: .default, before: Date(timeIntervalSinceNow: 1))
  }
}

// Insert image validity probe here.

func assertReset(in style: Style) {
  let layer = style.layers["editable"]!
  precondition(layer.paint["circle-radius"] == nil, "Cleared paint property persisted")
  precondition(layer.paint["circle-radius-transition"] == nil, "Cleared transition persisted")
  precondition(layer.layout["visibility"] == nil, "Cleared layout property persisted")
  precondition(layer.filter == nil, "Cleared filter persisted")
  precondition(layer.minZoom == nil && layer.maxZoom == nil, "Cleared zoom persisted")
}

let style = Style()
let map = RNMBXMapView(style)
try style.addLayer(TestLayer("basemap"), layerPosition: .default)
let editable = RecordingLayer()
editable.id = "editable"
editable.reactStyle = ["circleRadius": 20, "circleRadiusTransition": ["duration": 20], "visibility": "none"]
editable.filter = ["has", "name"]
editable.minZoomLevel = 3
editable.maxZoomLevel = 9
editable.addToMap(map, style: style)
try style.addLayer(TestLayer("other-source"), layerPosition: .default)
try style.addLayer(TestLayer("raw-layer"), layerPosition: .default)
drainStyles()
precondition(style.layers["editable"]?.paint["circle-radius"] as? Int == 20)
var withMetadata = style.layers["editable"]!
withMetadata.metadata = "externally-added"
style.layers["editable"] = withMetadata

editable.reactStyle = ["circleRadius": 10]
editable.reactStyle = [:]
editable.filter = []
editable.minZoomLevel = nil
editable.maxZoomLevel = nil
drainStyles()
assertReset(in: style)
precondition(style.layers["editable"]?.metadata == "externally-added")
precondition(style.order == ["basemap", "editable", "other-source", "raw-layer"])
precondition(style.replacements == 4, "Supported reset rebuilt the layer")

editable.belowLayerID = "basemap"
drainStyles()
precondition(style.order == ["editable", "basemap", "other-source", "raw-layer"])
editable.reactStyle = ["circleRadius": 6]
drainStyles()
style.rejectNull = true
editable.reactStyle = [:]
drainStyles()
assertReset(in: style)
precondition(style.order == ["editable", "basemap", "other-source", "raw-layer"])
style.rejectNull = false

editable.reactStyle = ["fillColor": "red", "fillOutlineColor": "blue"]
drainStyles()
style.materializeOutlineDefault = true
editable.reactStyle = ["fillColor": "green"]
drainStyles()
let paint = style.layers["editable"]!.paint
precondition(paint["fill-outline-color"] == nil, "Outline must inherit the current fill")
precondition(paint["fill-color"] as? String == "green")
precondition(style.order == ["editable", "basemap", "other-source", "raw-layer"])

let pending = RecordingLayer()
pending.id = "waiting"
pending.belowLayerID = "arrives-later"
pending.reactStyle = ["circleRadius": 7]
pending.addToMap(map, style: style)
pending.reactStyle = [:]
drainStyles()
let anchor = TestLayer("arrives-later")
try style.addLayer(anchor, layerPosition: .default)
map.layerAdded(anchor)
precondition(style.layers["waiting"]?.paint["circle-radius"] == nil)
precondition(style.order.suffix(2) == ["waiting", "arrives-later"])

let detached = RecordingLayer()
detached.id = "detached"
detached.belowLayerID = "anchor-after-unmount"
detached.addToMap(map, style: style)
detached.removeFromMap(map, style: style)
let lateAnchor = TestLayer("anchor-after-unmount")
try style.addLayer(lateAnchor, layerPosition: .default)
map.layerAdded(lateAnchor)
precondition(!style.layerExists(withId: "detached"))

editable.reactStyle = ["iconImage": ["kind": "image", "value": "a"]]
drainStyles()
let imageIsCurrent = imageValidity(for: editable, style: style)
precondition(imageIsCurrent("iconImage", ["kind": "image", "value": "a"]))
editable.reactStyle = [:]
precondition(!imageIsCurrent("iconImage", ["kind": "image", "value": "a"]))
editable.reactStyle = ["iconImage": ["kind": "image", "value": "a"]]
editable.removeFromMap(map, style: style)
precondition(!imageIsCurrent("iconImage", ["kind": "image", "value": "a"]))
let remounted = RecordingLayer()
remounted.id = "editable"
remounted.addToMap(map, style: style)
drainStyles()
precondition(style.order.last == "editable")
assertReset(in: style)

remounted.reactStyle = ["circleRadius": 9]
remounted.reactStyle = [:]
remounted.removeFromMap(map, style: style)
let reloadedStyle = Style()
let reloadedMap = RNMBXMapView(reloadedStyle)
try reloadedStyle.addLayer(TestLayer("reloaded-basemap"), layerPosition: .default)
remounted.addToMap(reloadedMap, style: reloadedStyle)
drainStyles()
precondition(reloadedStyle.order == ["reloaded-basemap", "editable"])
assertReset(in: reloadedStyle)
let topmost = RecordingLayer()
topmost.id = "topmost"
topmost.reactStyle = ["circleRadius": 7]
topmost.addToMap(map, style: style)
drainStyles()
style.rejectNull = true
topmost.reactStyle = nil
drainStyles()
precondition(style.order.last == "topmost" && style.layers["topmost"]?.paint["circle-radius"] == nil)
print("PASS RNMapbox iOS layer reset and style order")
