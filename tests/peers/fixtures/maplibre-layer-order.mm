#import <Foundation/Foundation.h>
#import <CoreGraphics/CoreGraphics.h>
#include <cassert>
typedef struct { CGFloat top, left, bottom, right; } UIEdgeInsets;
typedef double CLLocationDistance;
typedef struct { double duration, delay; } MLNTransition;
typedef double MLNSphericalPosition;
#define MLNTransitionMake(d, l) (MLNTransition){d, l}
#define MLNSphericalPositionMake(r, a, p) (r)
#define UIColor NSObject
@interface NSExpression (MLNTest)
+ (instancetype)expressionWithMLNJSONObject:(id)object;
@end
@interface NSValue (MLNTest)
+ (instancetype)valueWithCGVector:(CGVector)vector;
+ (instancetype)valueWithUIEdgeInsets:(UIEdgeInsets)edges;
@end
@interface MLRNUtils : NSObject
+ (UIColor *)toColor:(id)value;
+ (CGVector)toCGVector:(id)value;
+ (UIEdgeInsets)toUIEdgeInsets:(id)value;
@end
@implementation MLRNUtils
+ (UIColor *)toColor:(id)value { abort(); }
+ (CGVector)toCGVector:(id)value { abort(); }
+ (UIEdgeInsets)toUIEdgeInsets:(id)value { abort(); }
@end

// Insert peer style value here.

#include <cmath>
#include <string>
#define UIView NSObject
#define RCTLogError(...)
#define RCTLogWarn(...)
#define MLRN_DYNAMIC_TO_ARRAY(value) (value)
#define MLRN_DYNAMIC_TO_DICT(value) (value)
static NSString *RCTNSStringFromStringNilIfEmpty(const std::string &value) {
  return value.empty() ? nil : @(value.c_str());
}
@interface MLNSource : NSObject
@property(nonatomic, copy) NSString *identifier;
@end
@implementation MLNSource @end
@interface MLNStyleLayer : NSObject
@property(nonatomic, copy) NSString *identifier;
@property(nonatomic, copy) NSString *sourceIdentifier;
@property(nonatomic) float minimumZoomLevel, maximumZoomLevel;
@property(nonatomic) NSMutableDictionary *properties;
- (instancetype)initWithIdentifier:(NSString *)identifier;
- (instancetype)initWithIdentifier:(NSString *)identifier source:(MLNSource *)source;
@end
@implementation MLNStyleLayer
- (instancetype)initWithIdentifier:(NSString *)identifier {
  if ((self = [super init])) {
    _identifier = identifier;
    _properties = [NSMutableDictionary new];
    _minimumZoomLevel = -INFINITY;
    _maximumZoomLevel = INFINITY;
  }
  return self;
}
- (instancetype)initWithIdentifier:(NSString *)identifier source:(MLNSource *)source {
  self = [self initWithIdentifier:identifier];
  self.sourceIdentifier = source.identifier;
  return self;
}
@end
#define MLNForegroundStyleLayer MLNStyleLayer
@interface MLNVectorStyleLayer : MLNStyleLayer
@property(nonatomic) NSString *sourceLayerIdentifier;
@property(nonatomic) NSPredicate *predicate;
@end
@implementation MLNVectorStyleLayer @end
// Declare SDK layer types here.
@interface MLNStyle : NSObject
@property(nonatomic, readonly) NSMutableArray<MLNStyleLayer *> *layers;
- (MLNSource *)sourceWithIdentifier:(NSString *)id;
- (MLNStyleLayer *)layerWithIdentifier:(NSString *)id;
- (void)addLayer:(MLNStyleLayer *)layer;
- (void)removeLayer:(MLNStyleLayer *)layer;
- (void)insertLayer:(MLNStyleLayer *)layer belowLayer:(MLNStyleLayer *)next;
- (void)insertLayer:(MLNStyleLayer *)layer aboveLayer:(MLNStyleLayer *)previous;
- (void)insertLayer:(MLNStyleLayer *)layer atIndex:(NSUInteger)index;
@end
@implementation MLNStyle
- (instancetype)init { if ((self = [super init])) _layers = [NSMutableArray new]; return self; }
- (MLNSource *)sourceWithIdentifier:(NSString *)id {
  if (!id) return nil;
  MLNSource *source = [MLNSource new];
  source.identifier = id;
  return source;
}
- (MLNStyleLayer *)layerWithIdentifier:(NSString *)id {
  for (MLNStyleLayer *layer in _layers) if ([layer.identifier isEqual:id]) return layer;
  return nil;
}
- (void)addLayer:(MLNStyleLayer *)layer {
  assert(![self layerWithIdentifier:layer.identifier]);
  [_layers addObject:layer];
}
- (void)removeLayer:(MLNStyleLayer *)layer {
  [_layers removeObjectIdenticalTo:layer];
}
- (void)insertLayer:(MLNStyleLayer *)layer atIndex:(NSUInteger)index {
  assert(index < _layers.count);
  assert(![self layerWithIdentifier:layer.identifier]);
  [_layers insertObject:layer atIndex:index];
}
- (void)insertLayer:(MLNStyleLayer *)layer belowLayer:(MLNStyleLayer *)next {
  [self insertLayer:layer atIndex:[_layers indexOfObjectIdenticalTo:next]];
}
- (void)insertLayer:(MLNStyleLayer *)layer aboveLayer:(MLNStyleLayer *)previous {
  NSUInteger index = [_layers indexOfObjectIdenticalTo:previous] + 1;
  if (index == _layers.count) [self addLayer:layer];
  else [self insertLayer:layer atIndex:index];
}
@end
@interface MLRNMapView : NSObject
@property(nonatomic) MLNStyle *style;
@property(nonatomic) NSMutableDictionary<NSString *, NSMutableArray *> *waiters;
- (void)layerAdded:(MLNStyleLayer *)layer;
- (void)waitForLayerWithId:(NSString *)anchor then:(void (^)(MLNStyleLayer *))callback;
@end
@implementation MLRNMapView
- (instancetype)init {
  if ((self = [super init])) {
    _style = [MLNStyle new];
    _waiters = [NSMutableDictionary new];
  }
  return self;
}
- (void)layerAdded:(MLNStyleLayer *)layer {
  NSArray *callbacks = _waiters[layer.identifier];
  [_waiters removeObjectForKey:layer.identifier];
  for (void (^callback)(MLNStyleLayer *) in callbacks) callback(layer);
}
- (void)waitForLayerWithId:(NSString *)anchor then:(void (^)(MLNStyleLayer *))callback {
  MLNStyleLayer *layer = [_style layerWithIdentifier:anchor];
  if (layer) callback(layer);
  else {
    if (!_waiters[anchor]) _waiters[anchor] = [NSMutableArray new];
    [_waiters[anchor] addObject:[callback copy]];
  }
}
@end
@interface FilterParser : NSObject
+ (NSPredicate *)parse:(NSArray *)filter;
@end
@implementation FilterParser
+ (NSPredicate *)parse:(NSArray *)filter {
  return filter.count ? [NSPredicate predicateWithValue:[filter[0] boolValue]] : nil;
}
@end
@interface MLRNStyle : NSObject
- (instancetype)initWithMLNStyle:(MLNStyle *)style;
// Declare style setters here.
@end
static void applyStyle(MLNStyleLayer *layer, NSDictionary *fields) {
  for (NSString *key in fields) {
    id value = fields[key];
    if ([value isKindOfClass:NSDictionary.class]) {
      MLRNStyleValue *reset = [MLRNStyleValue make:value];
      assert(reset.mlnStyleValue == nil && [reset isVisible] && ![reset shouldAddImage]);
      [layer.properties removeObjectForKey:key];
    } else {
      layer.properties[key] = value;
    }
  }
}

@implementation MLRNStyle
- (instancetype)initWithMLNStyle:(MLNStyle *)style { return [super init]; }
// Implement style setters here.
@end

// Insert peer layer and Fabric update here.

static MLRNLayer *mount(MLRNMapView *map, NSString *id, Props props = {}) {
  MLRNLayer *layer = [MLRNLayer new];
  layer.id = id;
  layer.layerType = MLRNLayerTypeLine;
  layer.sourceID = [map.style layerWithIdentifier:id] ? nil : [id stringByAppendingString:@"-source"];
  update(layer, {}, props);
  [layer addToMap:map style:map.style];
  return layer;
}
static NSArray *ids(MLRNMapView *map) { return [map.style.layers valueForKey:@"identifier"]; }
int main() { @autoreleasepool {
  MLRNMapView *map = [MLRNMapView new];
  [map.style addLayer:[[MLNBackgroundStyleLayer alloc] initWithIdentifier:@"base"]];
  MLRNLayer *first = mount(map, @"first");
  Props initial;
  initial.reactStyle = @{@"lineWidth": @2, @"lineOpacity": @0.6, @"lineWidthTransition": @200, @"visibility": @"none"};
  initial.filter = @[@NO];
  initial.minzoom = 2;
  initial.maxzoom = 18;
  MLRNLayer *middle = mount(map, @"middle", initial);
  MLRNLayer *last = mount(map, @"last");
  const NSArray *order = @[@"base", @"first", @"middle", @"last"];

  Props updated = initial;
  updated.reactStyle = @{@"lineWidth": @3, @"lineOpacity": @0.7, @"lineWidthTransition": @200, @"visibility": @"none"};
  MLNStyleLayer *old = middle.styleLayer;
  update(middle, initial, updated);
  assert(middle.styleLayer == old);
  // Drain the upstream asynchronous style setter on the red path too.
  [[NSRunLoop mainRunLoop] runUntilDate:[NSDate dateWithTimeIntervalSinceNow:0.03]];
  assert([middle.styleLayer.properties[@"lineWidth"] isEqual:@3]);

  Props reset = updated;
  reset.reactStyle = @{@"lineOpacity": @0.7};
  update(middle, updated, reset);
  [[NSRunLoop mainRunLoop] runUntilDate:[NSDate dateWithTimeIntervalSinceNow:0.03]];
  assert(middle.styleLayer.properties[@"lineWidth"] == nil && "removed paint must reset");
  assert(middle.styleLayer.properties[@"visibility"] == nil);
  assert(middle.styleLayer.properties[@"lineWidthTransition"] == nil);
  assert([middle.styleLayer.properties[@"lineOpacity"] isEqual:@0.7]);
  assert([ids(map) isEqual:order] && "reset must preserve full SDK order");
  assert(middle.styleLayer.minimumZoomLevel == 2 && middle.styleLayer.maximumZoomLevel == 18);
  assert(((MLNVectorStyleLayer *)middle.styleLayer).predicate != nil);

  Props cleared = reset;
  cleared.reactStyle = nil;
  cleared.filter = @[];
  cleared.minzoom = Props{}.minzoom;
  cleared.maxzoom = Props{}.maxzoom;
  update(middle, reset, cleared);
  assert([ids(map) isEqual:order] && middle.styleLayer.properties.count == 0);
  assert(middle.styleLayer.minimumZoomLevel == -INFINITY && middle.styleLayer.maximumZoomLevel == INFINITY);
  assert(((MLNVectorStyleLayer *)middle.styleLayer).predicate == nil);

  Props placed = cleared;
  placed.afterId = "last";
  placed.beforeId = "first";
  placed.layerIndex = 0;
  update(middle, cleared, placed);
  assert(([ids(map) isEqual:@[@"base", @"first", @"last", @"middle"]]));
  Props shadowed = placed;
  shadowed.beforeId = "base";
  update(middle, placed, shadowed);
  assert(([ids(map) isEqual:@[@"base", @"first", @"last", @"middle"]]));

  Props afterRemoved = shadowed;
  afterRemoved.afterId.clear();
  update(middle, shadowed, afterRemoved);
  assert(([ids(map) isEqual:@[@"middle", @"base", @"first", @"last"]]));
  Props indexOnly = afterRemoved;
  indexOnly.beforeId.clear();
  indexOnly.layerIndex = 2;
  update(middle, afterRemoved, indexOnly);
  assert([ids(map) isEqual:order]);
  update(middle, indexOnly, cleared);
  assert(([ids(map) isEqual:@[@"base", @"first", @"last", @"middle"]]));

  MLNStyleLayer *beforeZoom = middle.styleLayer;
  Props atZero = cleared;
  atZero.minzoom = 0;
  atZero.maxzoom = 0;
  update(middle, cleared, atZero);
  assert(beforeZoom.minimumZoomLevel == 0 && beforeZoom.maximumZoomLevel == 0);
  update(middle, atZero, cleared);
  assert(middle.styleLayer == beforeZoom);
  assert(beforeZoom.minimumZoomLevel == -INFINITY && beforeZoom.maximumZoomLevel == INFINITY);

  Props waiting = initial;
  waiting.afterId = "anchor";
  MLRNLayer *later = mount(map, @"waiting", waiting);
  Props waitingReset = cleared;
  waitingReset.afterId = "anchor";
  update(later, waiting, waitingReset);
  assert(![map.style layerWithIdentifier:@"waiting"]);
  MLRNLayer *anchor = mount(map, @"anchor");
  assert(([ids(map) isEqual:@[@"base", @"first", @"last", @"middle", @"anchor", @"waiting"]]));
  assert(later.styleLayer.properties.count == 0);

  Props missing;
  missing.beforeId = "obsolete-anchor";
  MLRNLayer *retired = mount(map, @"retired", missing);
  [retired removeFromMap:map.style];
  [map layerAdded:[[MLNBackgroundStyleLayer alloc] initWithIdentifier:@"obsolete-anchor"]];
  assert(![map.style layerWithIdentifier:@"retired"]);

  [later removeFromMap:map.style];
  [middle removeFromMap:map.style];
  MLRNLayer *remounted = mount(map, @"middle");
  assert(([ids(map) isEqual:@[@"base", @"first", @"last", @"anchor", @"middle"]]));
  [first removeFromMap:map.style];
  [last removeFromMap:map.style];
  [anchor removeFromMap:map.style];
  [remounted removeFromMap:map.style];

  MLRNMapView *soloMap = [MLRNMapView new];
  MLRNLayer *sole = mount(soloMap, @"sole", initial);
  update(sole, initial, cleared);
  assert(([ids(soloMap) isEqual:@[@"sole"]]));
  assert(sole.styleLayer.properties.count == 0);

  MLNSource *source = [soloMap.style sourceWithIdentifier:@"original-source"];
  MLNLineStyleLayer *authored = [[MLNLineStyleLayer alloc] initWithIdentifier:@"authored" source:source];
  authored.sourceLayerIdentifier = @"original-source-layer";
  authored.properties[@"lineColor"] = @"original";
  [soloMap.style addLayer:authored];
  MLRNLayer *adopted = mount(soloMap, @"authored", initial);
  update(adopted, initial, reset);
  assert(adopted.styleLayer == authored);
  assert([authored.properties[@"lineColor"] isEqual:@"original"]);
  Props selected = cleared;
  selected.oneMapResetAdoptedStyle = true;
  update(adopted, reset, selected);
  assert(adopted.styleLayer == authored && "clearing ordinary paint must keep the original SDK layer");
  assert([authored.properties[@"lineColor"] isEqual:@"original"]);
  assert(authored.properties[@"lineOpacity"] == nil);
  assert([adopted.styleLayer.sourceIdentifier isEqual:@"original-source"]);
  assert([((MLNVectorStyleLayer *)adopted.styleLayer).sourceLayerIdentifier isEqual:@"original-source-layer"]);
  Props transition = selected;
  transition.reactStyle = @{@"lineWidthTransition": @200};
  update(adopted, selected, transition);
  update(adopted, transition, selected);
  assert(adopted.styleLayer != authored && adopted.styleLayer.properties[@"lineWidthTransition"] == nil);
  assert([adopted.styleLayer.sourceIdentifier isEqual:@"original-source"]);
  assert([((MLNVectorStyleLayer *)adopted.styleLayer).sourceLayerIdentifier isEqual:@"original-source-layer"]);
  assert(([ids(soloMap) isEqual:@[@"sole", @"authored"]]));
} }
