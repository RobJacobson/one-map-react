import XCTest

final class TapDriver: XCTestCase {
  func testDriveTaps() {
    let deadline = Date().addingTimeInterval(2400)
    var seen = ""
    var app: XCUIApplication?
    var bundle = ""

    while Date() < deadline {
      let request = tapRequest()

      if (request.hasPrefix("tap ") || request.hasPrefix("locate ") || request.hasPrefix("drag ") || request.hasPrefix("gesture ") || request.hasPrefix("inspect ") || request.hasPrefix("button ") || request.hasPrefix("scroll ")), request != seen {
        seen = request
        (app, bundle) = perform(request, current: app, bundle: bundle)
        print("ONE_MAP_INPUT_DONE \(request)")

        if request.split(separator: " ").last == "once" {
          return
        }
      }

      Thread.sleep(forTimeInterval: 0.15)
    }
  }

  private func perform(
    _ request: String,
    current: XCUIApplication?,
    bundle: String
  ) -> (XCUIApplication?, String) {
    let parts = request.split(separator: " ")

    if parts.count >= 2, parts[0] == "inspect" || parts[0] == "button" || parts[0] == "scroll" {
      let nextBundle = String(parts[1])
      let app = nextBundle == bundle && current != nil
        ? current!
        : XCUIApplication(bundleIdentifier: nextBundle)
      if app.state != .runningForeground { app.activate() }
      if parts[0] == "inspect" {
        print("ONE_MAP_AX_BEGIN\n\(app.debugDescription)\nONE_MAP_AX_END")
      } else if parts.count >= 4 {
        let label = parts[2..<(parts.count - 1)].joined(separator: " ")
        if parts[0] == "scroll" {
          app.scrollViews.containing(.staticText, identifier: label).firstMatch.swipeUp(velocity: .slow)
        } else {
          app.buttons[label].firstMatch.tap()
        }
      }
      return (app, nextBundle)
    }

    // TF07 markers need a hold before moving; nested scrolling needs its own bounds.
    if parts.count >= 8, parts[0] == "gesture",
      let startX = Double(parts[2]), let startY = Double(parts[3]),
      let endX = Double(parts[4]), let endY = Double(parts[5]),
      let holdSeconds = Double(parts[6]) {
      let nextBundle = String(parts[1])
      let app = nextBundle == bundle && current != nil
        ? current!
        : XCUIApplication(bundleIdentifier: nextBundle)
      if app.state != .runningForeground { app.activate() }
      let start = app.coordinate(withNormalizedOffset: CGVector(dx: startX, dy: startY))
      let end = app.coordinate(withNormalizedOffset: CGVector(dx: endX, dy: endY))
      start.press(forDuration: holdSeconds, thenDragTo: end, withVelocity: .slow, thenHoldForDuration: 0.1)
      return (app, nextBundle)
    }

    if parts.count >= 2, parts[0] == "locate" || parts[0] == "drag" {
      let nextBundle = String(parts[1])
      let app = nextBundle == bundle && current != nil
        ? current!
        : XCUIApplication(bundleIdentifier: nextBundle)

      if app.state != .runningForeground { app.activate() }
      if parts[0] == "locate" {
        let button = app.buttons["Locate me"].firstMatch
        if button.waitForExistence(timeout: 15) { button.tap() }
      } else {
        let start = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        let end = app.coordinate(withNormalizedOffset: CGVector(dx: 0.7, dy: 0.6))
        start.press(forDuration: 0.1, thenDragTo: end)
      }
      return (app, nextBundle)
    }

    guard parts.count >= 5,
      let x = Double(parts[2]),
      let y = Double(parts[3]),
      let times = Int(parts[4])
    else {
      return (current, bundle)
    }

    let nextBundle = String(parts[1])
    let app = nextBundle == bundle && current != nil
      ? current!
      : XCUIApplication(bundleIdentifier: nextBundle)

    if app.state != .runningForeground {
      app.activate()
    }

    let point = app.coordinate(withNormalizedOffset: CGVector(dx: x, dy: y))

    if times > 1 {
      point.doubleTap()
      return (app, nextBundle)
    }

    point.tap()
    return (app, nextBundle)
  }

  private func tapRequest() -> String {
    let address = "http://127.0.0.1:8799/tap"
    guard let url = URL(string: address) else {
      return ""
    }

    var request = URLRequest(url: url)
    request.timeoutInterval = 1
    let semaphore = DispatchSemaphore(value: 0)
    var body = ""
    let task = URLSession.shared.dataTask(with: request) { data, _, _ in
      if let data {
        body = String(data: data, encoding: .utf8) ?? ""
      }
      semaphore.signal()
    }

    task.resume()
    _ = semaphore.wait(timeout: .now() + 2)
    return body.trimmingCharacters(in: .whitespacesAndNewlines)
  }
}
