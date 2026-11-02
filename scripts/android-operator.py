"""Run one bounded operation bound to the current Android acceptance row."""

import http.client
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time
import uuid
import xml.etree.ElementTree as ET


ADB = "/Users/rob/Library/Android/sdk/platform-tools/adb"
SERIAL = "emulator-5580"
NODE = "/Users/rob/code/mapbox-code/one-map-f05-android-recovery/runtime-bin/node"
STAGE = Path("/Users/rob/code/mapbox-code/one-map-f05-android-recovery")
WRITER = Path(__file__).with_name("record-native-ui-observation.mjs")
TIMEOUT_SECONDS = 30
OUTPUT_BYTES = 131072
READINESS_SECONDS = 300
POLL_SECONDS = 0.2
TOOLBAR_LABELS = {
    "core": ("remount", "style", "offset", "popup", "Target A", "Target B",
             "Repeat target", "Clear target", "Reject view draggable",
             "Reject view callback", "Reject annotation draggable",
             "Reject annotation callback", "Clear rejection", "Read renderer"),
    "retained": ("Read focus", "Finish focus", "Theme", "Resize", "Target A",
                 "Repeat A", "Clear A", "Image"),
}
TOOLBAR_SWIPES = 12
TOOLBAR_SECONDS = 120
ROWS = (
    "mapbox-android-core",
    "mapbox-android-retained",
    "maplibre-android-camera",
    "maplibre-android-core",
    "maplibre-android-retained",
)


def main(arguments):
    try:
        attempt = Path(arguments[0])
        if (
            attempt.parent != STAGE
            or not re.fullmatch(r"android-platform-batch-attempt-[0-9]{2}", attempt.name)
            or attempt.resolve() != attempt
        ):
            raise ValueError("Use the canonical owned Android attempt output path.")
    except (IndexError, ValueError, OSError) as error:
        print("FAILED", str(error), flush=True)
        return 1
    arguments = arguments[1:]
    latch = attempt / "operator-first-failure.json"
    if latch.exists():
        print("BLOCKED first operator failure:", latch.read_text(), flush=True)
        return 1

    report = None
    scenario = None
    try:
        if len(arguments) < 3:
            raise ValueError(
                "Use OUTPUT ROW SCENARIO status | toolbar LABEL | adb ADB_ARGUMENT..."
            )
        row, scenario, operation, *adb_arguments = arguments
        if not re.fullmatch(r"(mapbox|maplibre)-android-(core|retained)", row):
            raise ValueError("Unknown Android UI row.")
        if operation == "toolbar":
            allowed = TOOLBAR_LABELS[row.rsplit("-", 1)[1]]
            label = next((name for name in allowed if len(adb_arguments) == 1
                          and name.casefold() == adb_arguments[0].strip().casefold()), None)
            if label is None:
                raise ValueError("Unknown toolbar label for this row.")
            adb_arguments = [label]
        candidate_report, identity = wait_for_row(attempt, row, latch)
        if identity.get("environment") != row.rsplit("-", 1)[0]:
            raise ValueError("Report environment differs from row.")
        for field in ("installedBinarySha256", "libraryDistSha256"):
            if not re.fullmatch(r"[a-f0-9]{64}", identity.get(field, "")):
                raise ValueError("Invalid report " + field)
        uuid.UUID(identity["runId"])
        if scenario not in identity["scenarios"]:
            raise ValueError("Unknown report scenario.")
        if any(
            value not in ("unverified", "passed")
            for value in identity["scenarios"].values()
        ):
            raise ValueError("Report contains a failed or invalid scenario.")
        report = candidate_report
        if operation == "status" and not adb_arguments:
            read_status()
        elif operation == "toolbar":
            activate_toolbar(attempt, row, scenario, identity, adb_arguments[0], latch)
        elif operation == "adb" and adb_arguments:
            run_checked([ADB, "-s", SERIAL, *adb_arguments])
        else:
            raise ValueError("Use status, toolbar LABEL or adb ADB_ARGUMENT...")
        print("COMPLETE 0", flush=True)
        return 0
    except Exception as error:
        first = {
            "row": arguments[0] if arguments else None,
            "scenario": scenario,
            "operation": arguments[2:],
            "error": type(error).__name__ + ": " + str(error),
        }
        print("FAILED", first["error"], flush=True)
        try:
            # Exclusive publication preserves the first failure across separate calls.
            with latch.open("x") as output:
                json.dump(first, output, indent=2)
                output.write("\n")
        except FileExistsError:
            print("FIRST FAILURE PRESERVED", flush=True)
            return 1
        except OSError as secondary:
            print("SECONDARY failure latch publication:", secondary, flush=True)
        if report is not None and scenario is not None:
            try:
                observation = attempt / "operator-failure-observation.json"
                with observation.open("x") as output:
                    json.dump(
                        {
                            "action": "Operator command " + repr(arguments[2:]),
                            "seenResult": "Operator failure; scenario not accepted: "
                            + first["error"],
                        },
                        output,
                    )
                run_checked(
                    [NODE, str(WRITER), str(report), scenario, "failed", str(observation)]
                )
            except Exception as secondary:
                print("SECONDARY failed report publication:", secondary, flush=True)
        return 1


def wait_for_row(attempt, row, latch, ready_only=False):
    deadline = None
    incomplete_json = set()
    report = attempt / (row + "-manual.json")
    while True:
        if latch.exists():
            raise ValueError("First operator failure already latched: " + latch.read_text())
        if (attempt / "receipt.json").exists():
            raise ValueError("Attempt has a final receipt.")
        if deadline is not None and time.monotonic() >= deadline:
            raise TimeoutError("Row readiness deadline exceeded.")
        try:
            checkpoint_path = attempt / "checkpoint.json"
            checkpoint = json.loads(checkpoint_path.read_text())
            incomplete_json.discard(checkpoint_path)
            if checkpoint.get("error") or checkpoint.get("cleanup"):
                raise ValueError("Attempt is failing or cleaning up.")
            if any(
                entry.get("rowId") == row for entry in checkpoint.get("rows", [])
            ):
                raise ValueError("Requested row has already completed.")
            active = checkpoint.get("currentRow")
            if active == row:
                checkpoint_path = report
                identity = json.loads(report.read_text())
                incomplete_json.discard(report)
                if deadline is not None and time.monotonic() >= deadline:
                    raise TimeoutError("Row readiness deadline exceeded.")
                return report, identity
            if active is not None:
                previous = ROWS[ROWS.index(row) - 1] if ROWS.index(row) else None
                completed = checkpoint.get("rows", [])
                if active != previous or not any(
                    entry.get("rowId") == active and entry.get("status") == "passed"
                    for entry in completed
                ):
                    raise ValueError("Row is not the active attempt row.")
        except FileNotFoundError:
            pass
        except json.JSONDecodeError:
            # Driver file publication is synchronous but not atomic; allow one poll.
            if checkpoint_path in incomplete_json:
                raise
            incomplete_json.add(checkpoint_path)
        if ready_only:
            raise ValueError("Toolbar row is no longer ready.")
        if deadline is None:
            deadline = time.monotonic() + READINESS_SECONDS
            print("WAIT row readiness", row, flush=True)
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError("Row readiness deadline exceeded.")
        time.sleep(min(POLL_SECONDS, remaining))


def activate_toolbar(attempt, row, scenario, identity, label, latch):
    """Reveal a fixture toolbar button using fresh hierarchies, then tap once."""
    print("START toolbar", label, flush=True)
    deadline = time.monotonic() + TOOLBAR_SECONDS
    number = 1
    while True:
        receipt_path = attempt / f"toolbar-{number:03d}.json"
        try:
            receipt_path.open("x").close()
            break
        except FileExistsError:
            number += 1
    receipt = {"row": row, "scenario": scenario, "runId": identity["runId"],
               "label": label, "swipes": 0, "hierarchies": [], "status": "failed"}

    def command(arguments):
        # A running navigation must also stop when another boundary closes the row.
        current_report, current = wait_for_row(attempt, row, latch, ready_only=True)
        if current != identity or current_report != attempt / (row + "-manual.json"):
            raise ValueError("Toolbar row identity or observations changed.")
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError("Toolbar navigation deadline exceeded.")
        return run_checked([ADB, "-s", SERIAL, *arguments], quiet=True,
                           timeout=min(TIMEOUT_SECONDS, remaining))

    def hierarchy():
        index = len(receipt["hierarchies"]) + 1
        name = f"toolbar-{number:03d}-hierarchy-{index:03d}.xml"
        device_path = f"/sdcard/one-map-{attempt.name}-{name}"
        command(["shell", "uiautomator", "dump", device_path])
        xml = command(["shell", "cat", device_path])
        local_path = attempt / name
        local_path.write_text(xml)
        receipt["hierarchies"].append(str(local_path))
        command(["shell", "rm", device_path])
        return toolbar_snapshot(xml, row)

    try:
        previous = None
        while True:
            toolbar, buttons, signature = hierarchy()
            targets = [bounds for name, bounds in buttons if name == label.upper()]
            if len(targets) > 1:
                raise ValueError("Ambiguous visible toolbar target.")
            if targets:
                left, top, right, bottom = targets[0]
                command(["shell", "input", "tap", str((left + right) // 2),
                         str((top + bottom) // 2)])
                receipt["targetBounds"] = targets[0]
                receipt["status"] = "input-complete"
                break
            if signature == previous:
                raise ValueError("Toolbar navigation made no progress.")
            if receipt["swipes"] >= TOOLBAR_SWIPES:
                raise ValueError("Toolbar navigation swipe limit exceeded.")
            left, top, right, bottom = toolbar
            labels = [name.upper() for name in TOOLBAR_LABELS[row.rsplit("-", 1)[1]]]
            target_index = labels.index(label.upper())
            visible_indices = [labels.index(name) for name, _ in buttons]
            if target_index < min(visible_indices):
                start, end = 1, 3
            elif target_index > max(visible_indices):
                start, end = 3, 1
            else:
                raise ValueError("Missing target within visible toolbar range.")
            width = right - left
            y = str((top + bottom) // 2)
            command(["shell", "input", "swipe", str(left + width * start // 4), y,
                     str(left + width * end // 4), y, "450"])
            receipt["swipes"] += 1
            previous = signature
    except Exception as error:
        receipt["reason"] = type(error).__name__ + ": " + str(error)
        raise
    finally:
        try:
            receipt_path.write_text(json.dumps(receipt, indent=2) + "\n")
        except OSError as secondary:
            if "reason" not in receipt:
                raise
            print("SECONDARY toolbar receipt publication:", secondary, flush=True)
        print("TOOLBAR", json.dumps({**receipt, "receipt": str(receipt_path)}), flush=True)


def toolbar_snapshot(xml, row):
    root = ET.fromstring(xml)
    package = "com.onemap" + row.split("-", 1)[0]
    labels = {label.upper() for label in TOOLBAR_LABELS[row.rsplit("-", 1)[1]]}

    def bounds(node):
        match = re.fullmatch(r"\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]", node.get("bounds", ""))
        if match is None:
            raise ValueError("Invalid hierarchy bounds.")
        return tuple(map(int, match.groups()))

    display = bounds(next(iter(root)))
    candidates = []
    for node in root.iter("node"):
        if node.get("class") != "android.widget.HorizontalScrollView" or node.get("package") != package:
            continue
        rectangle = bounds(node)
        left, top, right, bottom = rectangle
        if not (display[0] <= left < right <= display[2]
                and display[1] <= top < bottom <= display[3]
                and bottom <= display[1] + (display[3] - display[1]) // 4
                and right - left >= (display[2] - display[0]) // 2):
            continue
        buttons = []
        for child in node.iter("node"):
            name = (child.get("content-desc") or child.get("text") or "").strip().upper()
            if (child.get("class") == "android.widget.Button" and name in labels
                    and child.get("package") == package
                    and child.get("enabled") == "true" and child.get("clickable") == "true"):
                child_bounds = bounds(child)
                x1, y1, x2, y2 = child_bounds
                if left <= x1 < x2 <= right and top <= y1 < y2 <= bottom:
                    buttons.append((name, child_bounds))
        if buttons:
            candidates.append((rectangle, buttons))
    if len(candidates) != 1:
        raise ValueError("Expected one visible fixture toolbar.")
    rectangle, buttons = candidates[0]
    return rectangle, buttons, (rectangle, tuple(buttons))


def read_status():
    print("START status http://127.0.0.1:8797/tf07", flush=True)
    deadline = time.monotonic() + TIMEOUT_SECONDS
    connection = http.client.HTTPConnection("127.0.0.1", 8797, timeout=TIMEOUT_SECONDS)
    try:
        connection.connect()
        status_socket = connection.sock
        status_socket.settimeout(max(0.001, deadline - time.monotonic()))
        connection.request("GET", "/tf07")
        status_socket.settimeout(max(0.001, deadline - time.monotonic()))
        response = connection.getresponse()
        if response.status != 200:
            raise ValueError("Status HTTP " + str(response.status))
        body = bytearray()
        while not response.isclosed():
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError("Status deadline exceeded.")
            status_socket.settimeout(remaining)
            chunk = response.read1(min(4096, OUTPUT_BYTES + 1 - len(body)))
            if not chunk:
                break
            body.extend(chunk)
            if len(body) > OUTPUT_BYTES:
                raise ValueError("Status body exceeds output limit.")
        value = json.loads(body)
        if value is not None and not isinstance(value, dict):
            raise ValueError("Status must be an object or null.")
        print(json.dumps(value), flush=True)
    finally:
        connection.close()


def run_checked(command, quiet=False, timeout=None):
    if not quiet:
        print("START", command, flush=True)
    # Files keep capture memory bounded; screenshots use screencap then pull.
    with tempfile.TemporaryFile() as stdout, tempfile.TemporaryFile() as stderr:
        try:
            subprocess.run(
                command,
                timeout=TIMEOUT_SECONDS if timeout is None else timeout,
                check=True,
                shell=False,
                stdout=stdout,
                stderr=stderr,
            )
        finally:
            for captured in (stdout, stderr):
                captured.seek(0, 2)
                captured.seek(max(0, captured.tell() - OUTPUT_BYTES))
                output = captured.read().decode("utf-8", errors="replace")
                if output and (not quiet or captured is stderr):
                    print(output, flush=True)
        stdout.seek(0, 2)
        if stdout.tell() > OUTPUT_BYTES:
            raise ValueError("Command stdout exceeds output limit.")
        stdout.seek(0)
        return stdout.read().decode("utf-8", errors="strict")


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
