import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

if (process.platform !== "darwin") {
  console.log("SKIP native light-color regression: requires macOS Swift.");
} else {
  const source = readFileSync(
    join(
      resolve(process.argv[2] ?? "node_modules/@rnmapbox/maps"),
      "ios/RNMBX/RNMBXStyleValue.swift"
    ),
    "utf8"
  );
  const section = (start, end) => {
    const first = source.indexOf(start);
    const last = source.indexOf(end, first + start.length);
    assert(first >= 0 && last > first, `Missing native color section ${start}`);
    return source.slice(first, last);
  };
  const temporary = mkdtempSync(join(tmpdir(), "one-map-light-color-"));
  try {
    const file = join(temporary, "Color.swift");
    writeFileSync(
      file,
      `
import Foundation
extension String.StringInterpolation {
  mutating func appendInterpolation(optional: Any?) { appendInterpolation(String(describing: optional)) }
}
struct UIColor: Equatable {
  let r: CGFloat; let g: CGFloat; let b: CGFloat; let a: CGFloat
  init(red: CGFloat, green: CGFloat, blue: CGFloat, alpha: CGFloat) { r=red; g=green; b=blue; a=alpha }
  static let red = UIColor(red: 1, green: 0, blue: 0, alpha: 1)
}
struct StyleColor { let color: UIColor; init(_ color: UIColor) { self.color = color } }
enum Value<T> { case constant(T) }
enum Level { case error }
enum Logger { static var errors = 0; static func log(level: Level, message: String) { errors += 1 } }
final class RNMBXStyleValue {
  let value: Any
  init(_ value: Any) { self.value = value }
  ${section("  static func convert(", "  func mglStyleValueNumber(")}
  ${section("  func uicolor(", "  func mglStyleValueColor()")}
  ${section("  func mglStyleValueColorRaw()", "  func mglStyleValueBoolean()")}
}
for (number, rgba) in [(Int(0xffffffff), [1.0,1.0,1.0,1.0]), (Int(0xff0000ff), [0.0,0.0,1.0,1.0]), (Int(0x8044aa22), [68.0/255,170.0/255,34.0/255,128.0/255]), (-16776961, [0.0,0.0,1.0,1.0])] {
  let input: [String:Any] = ["stylevalue": ["type":"number", "value": NSNumber(value:number)]]
  let result = RNMBXStyleValue(input).mglStyleValueColorRaw()
  if case let .constant(style) = result {
    for (actual, expected) in zip([style.color.r,style.color.g,style.color.b,style.color.a], rgba) {
      precondition(abs(Double(actual)-expected)<0.000001, "Converted light RGBA must match supplied packed color")
    }
  }
}
precondition(Logger.errors == 0, "Valid color must not fall back to red")
for input: Any in ["invalid", ["stylevalue":["type":"string", "value":"invalid"]]] {
  if case let .constant(style) = RNMBXStyleValue(input).mglStyleValueColorRaw() { precondition(style.color == .red) }
}
precondition(Logger.errors == 2, "Malformed colors must retain visible error fallback")
print("PASS actual Swift light-color conversion: packed and signed RGBA, alpha, and invalid-input fallback")
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
