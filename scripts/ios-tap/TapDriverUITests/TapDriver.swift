import XCTest

final class TapDriver: XCTestCase {
  func testDriveTaps() {
    let deadline = Date().addingTimeInterval(2400)
    var seen = ""
    var app: XCUIApplication?
    var bundle = ""

    while Date() < deadline {
      let request = tapRequest()

      if request.hasPrefix("tap "), request != seen {
        seen = request
        (app, bundle) = perform(request, current: app, bundle: bundle)

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
