import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

if (process.platform !== "darwin") {
  console.log("SKIP native camera intent regression: requires Xcode.");
  process.exit(0);
}

const maplibre = resolve(
  process.argv[2] ?? "node_modules/@maplibre/maplibre-react-native"
);
const peer = readFileSync(
  join(maplibre, "ios/components/camera/MLRNCameraComponentView.mm"),
  "utf8"
);
const first = peer.indexOf("  BOOL updateCamera = NO;");
const last = peer.indexOf("  [super updateProps:props", first);
assert.ok(first >= 0 && last > first, "Missing MapLibre iOS camera boundary.");

const temporary = mkdtempSync(join(tmpdir(), "one-map-camera-intent-"));
const source = join(temporary, "CameraIntent.mm");
const binary = join(temporary, "camera-intent");
const run = (command: string, args: string[]): void => {
  const result = spawnSync(command, args, {
    cwd: temporary,
    encoding: "utf8",
    timeout: 60000,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
};

try {
  writeFileSync(
    source,
    `#import <Foundation/Foundation.h>
#include <cassert>
#include <string>
#include <vector>
struct Props {
  struct {
    std::vector<double> center, bounds;
    struct { int top = 0, right = 0, bottom = 0, left = 0; } padding;
    double zoom = -1, bearing = -1, pitch = -1;
    int duration = -1, easing = 0;
  } stop;
  std::string trackUserLocation = "none";
};
namespace facebook::react {
  std::string toString(const std::string &value) { return value; }
}
@interface Camera : NSObject
@property(nonatomic, copy) NSDictionary *stop;
@property(nonatomic, copy) NSString *trackUserLocation;
@property(nonatomic, copy) NSArray *center;
@property(nonatomic) NSUInteger updates;
@end
@implementation Camera
- (void)updateCamera {
  if (self.stop[@"center"]) self.center = self.stop[@"center"];
  self.updates += 1;
}
@end
void update(Camera *_view, const Props &oldViewProps, const Props &newViewProps) {
${peer.slice(first, last)}
}
int main() { @autoreleasepool {
  Camera *camera = [Camera new];
  Props empty;
  Props first = empty;
  first.stop.center = {12, 24};
  first.stop.zoom = 8;
  first.stop.bearing = 35;
  first.stop.pitch = 20;
  first.stop.padding.left = 10;
  first.stop.duration = 0;
  update(camera, empty, first);
  assert(camera.updates == 1);
  assert(([camera.center isEqual:@[@12, @24]]));
  camera.center = @[@13, @25];
  Props padded = empty;
  padded.stop.padding.left = 40;
  padded.stop.duration = 0;
  update(camera, first, padded);
  assert(camera.updates == 2);
  assert(([camera.center isEqual:@[@13, @25]]));
  assert(camera.stop[@"zoom"] == nil && camera.stop[@"bearing"] == nil && camera.stop[@"pitch"] == nil);
  assert([camera.stop[@"padding"][@"left"] intValue] == 40);
  update(camera, padded, padded);
  assert(camera.updates == 2);

  Props released = padded;
  released.stop.duration = -1;
  update(camera, padded, released);
  assert(camera.updates == 2 && camera.stop == nil);
  update(camera, released, first);
  assert((camera.updates == 3 && [camera.center isEqual:@[@12, @24]]));
  update(camera, first, empty);
  assert(camera.updates == 4 && [camera.stop[@"padding"][@"left"] intValue] == 0);

  Props zero = empty;
  zero.stop.duration = 0;
  update(camera, empty, zero);
  assert(camera.updates == 5 && [camera.stop[@"padding"][@"left"] intValue] == 0);
  update(camera, zero, empty);
  assert(camera.updates == 5 && camera.stop == nil);

  Props tracking = empty;
  tracking.trackUserLocation = "default";
  update(camera, empty, tracking);
  assert(camera.updates == 6 && [camera.trackUserLocation isEqualToString:@"default"]);
  update(camera, tracking, first);
  assert(camera.updates == 7 && [camera.trackUserLocation isEqualToString:@"none"]);
  assert(([camera.center isEqual:@[@12, @24]]));
} }
`
  );
  run("xcrun", [
    "clang++",
    "-std=c++17",
    "-fobjc-arc",
    "-framework",
    "Foundation",
    source,
    "-o",
    binary,
  ]);
  run(binary, []);
  console.log("PASS MapLibre iOS camera stop, padding reset, and release.");
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
