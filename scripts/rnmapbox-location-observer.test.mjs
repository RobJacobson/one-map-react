import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Compile the actual patched observer implementation with only SDK value types stubbed.
if (process.platform !== "darwin") {
  console.log(
    "SKIP Swift observer regression: requires the macOS Swift compiler."
  );
} else {
  const source = readFileSync(
    join(
      resolve(process.argv[2] ?? "node_modules/@rnmapbox/maps"),
      "ios/RNMBX/RNMBXCustomLocationProvider.swift"
    ),
    "utf8"
  );
  const start = source.indexOf("class CustomLocationProvider:");
  assert(start >= 0);
  const temporary = mkdtempSync(join(tmpdir(), "one-map-location-observer-"));
  try {
    const file = join(temporary, "Observer.swift");
    writeFileSync(
      file,
      `
import Foundation
import CoreLocation
protocol LocationProvider {}
protocol HeadingProvider {}
struct Location { let clLocation: CLLocation }
struct Heading { let direction: CLLocationDirection; let accuracy: CLLocationDirection }
protocol LocationObserver: AnyObject { func onLocationUpdateReceived(for locations: [Location]) }
protocol HeadingObserver: AnyObject { func onHeadingUpdate(_ heading: Heading) }
${source.slice(start)}
final class Observer: LocationObserver, HeadingObserver {
  var locations: [Location] = []
  var headings: [Heading] = []
  func onLocationUpdateReceived(for locations: [Location]) { self.locations += locations }
  func onHeadingUpdate(_ heading: Heading) { headings.append(heading) }
}
let provider = CustomLocationProvider()
provider.setLocation(latitude: 47.615, longitude: -122.34)
provider.setHeading(heading: 25)
let observer = Observer()
provider.addLocationObserver(for: observer)
provider.add(headingObserver: observer)
precondition(observer.locations.count == 1, "A late puck observer must receive the coordinate supplied before attachment")
precondition(observer.locations[0].clLocation.coordinate.longitude == -122.34)
precondition(observer.headings.count == 1 && observer.headings[0].direction == 25)
provider.setLocation(latitude: 47.62, longitude: -122.33)
provider.setHeading(heading: 30)
precondition(observer.locations.count == 2 && observer.headings.count == 2)
provider.removeLocationObserver(for: observer)
provider.remove(headingObserver: observer)
provider.setLocation(latitude: 47.63, longitude: -122.32)
provider.setHeading(heading: 35)
precondition(observer.locations.count == 2 && observer.headings.count == 2)
print("PASS actual Swift custom location/heading observers: initial replay, updates and removal")
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
