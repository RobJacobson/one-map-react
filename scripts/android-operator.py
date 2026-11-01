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


ADB = "/Users/rob/Library/Android/sdk/platform-tools/adb"
SERIAL = "emulator-5580"
NODE = "/Users/rob/code/mapbox-code/one-map-f05-android-recovery/runtime-bin/node"
STAGE = Path("/Users/rob/code/mapbox-code/one-map-f05-android-recovery")
WRITER = Path(__file__).with_name("record-native-ui-observation.mjs")
TIMEOUT_SECONDS = 30
OUTPUT_BYTES = 131072
READINESS_SECONDS = 300
POLL_SECONDS = 0.2
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
                "Use OUTPUT ROW SCENARIO status | OUTPUT ROW SCENARIO adb ADB_ARGUMENT..."
            )
        row, scenario, operation, *adb_arguments = arguments
        if not re.fullmatch(r"(mapbox|maplibre)-android-(core|retained)", row):
            raise ValueError("Unknown Android UI row.")
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
        elif operation == "adb" and adb_arguments:
            run_checked([ADB, "-s", SERIAL, *adb_arguments])
        else:
            raise ValueError("Use status or adb ADB_ARGUMENT...")
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


def wait_for_row(attempt, row, latch):
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
        if deadline is None:
            deadline = time.monotonic() + READINESS_SECONDS
            print("WAIT row readiness", row, flush=True)
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError("Row readiness deadline exceeded.")
        time.sleep(min(POLL_SECONDS, remaining))


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


def run_checked(command):
    print("START", command, flush=True)
    # Files keep capture memory bounded; screenshots use screencap then pull.
    with tempfile.TemporaryFile() as stdout, tempfile.TemporaryFile() as stderr:
        try:
            subprocess.run(
                command,
                timeout=TIMEOUT_SECONDS,
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
                if output:
                    print(output, flush=True)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
