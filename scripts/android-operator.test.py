"""Exercise the operator CLI and fresh-process failure latch without a device."""

import contextlib
import http.client
import io
import json
from pathlib import Path
import re
import runpy
import shlex
import socket
import threading
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch


ROOT = Path(__file__).resolve().parent.parent
HELPER = ROOT / "scripts/android-operator.py"
PLAN = ROOT / "docs/revised-api-acceptance-plan.md"
NODE = "/Users/rob/code/mapbox-code/one-map-f05-android-recovery/runtime-bin/node"
ROW = "mapbox-android-core"
SCENARIO = "live-child-button"


class OperatorTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.stage = Path(self.temporary.name).resolve()
        self.attempt = self.stage / "android-platform-batch-attempt-07"
        self.attempt.mkdir()
        module = runpy.run_path(str(HELPER))
        self.main = module["main"]
        self.globals = self.main.__globals__
        self.globals["STAGE"] = self.stage
        self.report = self.attempt / (ROW + "-manual.json")
        names = re.findall(r'"([^"]+)"', (ROOT / "scripts/tf07-smoke-contract.mjs").read_text().split("[", 1)[1].split("]", 1)[0])
        self.original = {"installedBinarySha256": "a" * 64, "libraryDistSha256": "b" * 64,
                         "environment": "mapbox-android", "runId": "12345678-1234-4234-8234-123456789012",
                         "scenarios": dict.fromkeys(names, "unverified"), "metadata": {"keep": True}}
        self.report.write_text(json.dumps(self.original))
        (self.attempt / "checkpoint.json").write_text(json.dumps({"currentRow": ROW, "result": "failed"}))
        self.latch = self.attempt / "operator-first-failure.json"

    def invoke(self, tail, prefix=None):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            status = self.main([str(self.attempt), *(prefix or [ROW, SCENARIO]), *tail])
        return status, output.getvalue()

    def response(self, body, status=200):
        response = Mock(status=status)
        response.isclosed.return_value = False
        response.read1.side_effect = [body, b""]
        connection = Mock()
        connection.getresponse.return_value = response
        return connection

    def test_startup_waits_for_assigned_row_and_report_before_boundary(self):
        self.report.unlink()
        checkpoint = self.attempt / "checkpoint.json"
        checkpoint.unlink()
        connection = self.response(b"null")
        sleeps = []
        def advance(seconds):
            boundary.assert_not_called()
            adb.assert_not_called()
            sleeps.append(seconds)
            if len(sleeps) == 1:
                checkpoint.write_text(json.dumps({"result": "failed", "checkpoints": []}))
            elif len(sleeps) == 2:
                checkpoint.write_text(json.dumps({"result": "failed", "currentRow": ROW}))
            else:
                self.report.write_text(json.dumps(self.original))
        with patch("time.sleep", side_effect=advance), patch("time.monotonic", return_value=0), patch("http.client.HTTPConnection", return_value=connection) as boundary, patch("subprocess.run") as adb:
            status, output = self.invoke(["status"])
        self.assertEqual(status, 0, output)
        self.assertEqual(sleeps, [0.2] * 3)
        boundary.assert_called_once()
        connection.request.assert_called_once_with("GET", "/tf07")
        self.assertFalse(self.latch.exists())

    def test_wait_stops_for_failure_receipt_and_timeout_without_boundary(self):
        for stop in ("latch", "receipt", "error", "cleanup", "timeout"):
            with self.subTest(stop=stop):
                self.setUp()
                checkpoint = self.attempt / "checkpoint.json"
                checkpoint.write_text(json.dumps({"result": "failed"}))
                def advance(seconds):
                    if stop == "latch": self.latch.write_text('{"error":"original"}')
                    if stop == "receipt": (self.attempt / "receipt.json").write_text("{}")
                    if stop in ("error", "cleanup"):
                        checkpoint.write_text(json.dumps({stop: "stopped"}))
                clock = [0, 0, 300] if stop == "timeout" else [0, 0]
                with patch("time.sleep", side_effect=advance), patch("time.monotonic", side_effect=clock), patch("subprocess.run") as adb, patch("http.client.HTTPConnection") as boundary:
                    status, output = self.invoke(["status"])
                    self.assertEqual(status, 1, output)
                    adb.assert_not_called()
                    boundary.assert_not_called()
                    saved = self.latch.read_bytes()
                    self.assertEqual(self.invoke(["adb", "shell", "input", "tap", "50", "40"])[0], 1)
                    self.assertEqual(self.latch.read_bytes(), saved)
                if stop == "latch": self.assertEqual(json.loads(saved)["error"], "original")
                if stop == "timeout": self.assertIn("readiness deadline", json.loads(saved)["error"])

    def test_ready_report_after_deadline_cannot_reach_transport(self):
        self.report.unlink()
        def advance(seconds):
            self.report.write_text(json.dumps(self.original))
        with patch("time.sleep", side_effect=advance), patch("time.monotonic", side_effect=[0, 0, 299, 301]), patch("subprocess.run") as adb, patch("http.client.HTTPConnection") as boundary:
            status, output = self.invoke(["status"])
        self.assertEqual(status, 1, output)
        self.assertIn("readiness deadline", json.loads(self.latch.read_text())["error"])
        adb.assert_not_called()
        boundary.assert_not_called()

    def test_only_completed_previous_row_is_a_transition(self):
        next_row = "mapbox-android-retained"
        for completed in (False, True):
            with self.subTest(completed=completed):
                self.setUp()
                next_report = self.attempt / (next_row + "-manual.json")
                checkpoint = self.attempt / "checkpoint.json"
                checkpoint.write_text(json.dumps({"currentRow": ROW, "rows": [{"rowId": ROW, "status": "passed"}] if completed else []}))
                def advance(seconds):
                    checkpoint.write_text(json.dumps({"currentRow": next_row}))
                    next_report.write_text(json.dumps(self.original))
                with patch("time.sleep", side_effect=advance) as sleep, patch("http.client.HTTPConnection", return_value=self.response(b"null")) as boundary:
                    status, output = self.invoke(["status"], [next_row, SCENARIO])
                self.assertEqual(status, 0 if completed else 1, output)
                self.assertEqual(sleep.call_count, 1 if completed else 0)
                self.assertEqual(boundary.call_count, 1 if completed else 0)

    def test_partial_publication_gets_only_one_poll(self):
        for repaired in (True, False):
            with self.subTest(repaired=repaired):
                self.setUp()
                self.report.write_text("{")
                def advance(seconds):
                    if repaired: self.report.write_text(json.dumps(self.original))
                with patch("time.sleep", side_effect=advance) as sleep, patch("http.client.HTTPConnection", return_value=self.response(b"null")) as boundary, patch("subprocess.run") as adb:
                    status, output = self.invoke(["status"])
                self.assertEqual(status, 0 if repaired else 1, output)
                sleep.assert_called_once_with(0.2)
                self.assertEqual(boundary.call_count, 1 if repaired else 0)
                adb.assert_not_called()

    def test_distinct_checkpoint_publications_each_get_one_poll(self):
        checkpoint = self.attempt / "checkpoint.json"
        checkpoint.write_text("{")
        updates = [json.dumps({"result": "failed"}), "{", json.dumps({"currentRow": ROW})]
        def advance(seconds):
            checkpoint.write_text(updates.pop(0))
        with patch("time.sleep", side_effect=advance) as sleep, patch("http.client.HTTPConnection", return_value=self.response(b"null")) as boundary:
            status, output = self.invoke(["status"])
        self.assertEqual(status, 0, output)
        self.assertEqual(sleep.call_count, 3)
        boundary.assert_called_once()

    def test_actual_cli_waits_then_runs_one_fake_child(self):
        script = self.cli_copy()
        self.report.unlink()
        (self.attempt / "checkpoint.json").write_text(json.dumps({"result": "failed"}))
        child = subprocess.Popen([sys.executable, str(script), str(self.attempt), ROW, SCENARIO, "adb", "shell", "input", "tap", "50", "40"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        self.addCleanup(lambda: child.kill() if child.poll() is None else None)
        self.assertIn("WAIT row readiness", child.stdout.readline())
        (self.attempt / "checkpoint.json").write_text(json.dumps({"result": "failed", "currentRow": ROW}))
        self.report.write_text(json.dumps(self.original))
        output, error = child.communicate(timeout=5)
        self.assertEqual(child.returncode, 0, output + error)
        self.assertEqual(output.count("START"), 1)
        self.assertEqual(output.count('"-s", "emulator-5580"'), 1)
        self.assertIn("COMPLETE 0", output)

    def test_status_null_and_object_are_normal(self):
        for body in (b"null", b'{"events":{"child-click":1}}'):
            connection = self.response(body)
            with patch("http.client.HTTPConnection", return_value=connection) as boundary, patch("subprocess.run") as adb:
                status, output = self.invoke(["status"])
            self.assertEqual(status, 0)
            self.assertIn(json.dumps(json.loads(body)), output)
            boundary.assert_called_once_with("127.0.0.1", 8797, timeout=30)
            connection.request.assert_called_once_with("GET", "/tf07")
            connection.close.assert_called_once()
            adb.assert_not_called()
            self.assertFalse(self.latch.exists())

    def test_real_http_response_over_fake_socket(self):
        for protocol in (b"HTTP/1.0", b"HTTP/1.1"):
            client, server = socket.socketpair()
            def serve():
                with server:
                    request = server.recv(4096)
                    self.assertIn(b"GET /tf07 HTTP/1.1", request)
                    server.sendall(protocol + b" 200 OK\r\nContent-Length: 4\r\nConnection: close\r\n\r\nnull")
            worker = threading.Thread(target=serve)
            worker.start()
            transport = Mock(wraps=client)
            transport.setsockopt = Mock()
            with patch("socket.create_connection", return_value=transport):
                status, output = self.invoke(["status"])
            worker.join(2)
            self.assertFalse(worker.is_alive())
            self.assertEqual(status, 0, output)
            self.assertIn("null", output)

    def test_status_failures_publish_and_block_every_later_operation(self):
        failures = [ConnectionRefusedError("refused"), TimeoutError("timed out"),
                    self.response(b"{}", 503), self.response(b"{"), self.response(b"[]"),
                    self.response(b"x" * 131073)]
        for failure in failures:
            with self.subTest(failure=failure):
                self.setUp()
                connection = failure if not isinstance(failure, Exception) else Mock()
                if isinstance(failure, Exception):
                    connection.connect.side_effect = failure
                with patch("http.client.HTTPConnection", return_value=connection):
                    status, output = self.invoke(["status"])
                self.assertEqual(status, 1)
                self.assertIn("FAILED", output)
                first = self.latch.read_bytes()
                report = json.loads(self.report.read_text())
                expected = dict(self.original, scenarios={**self.original["scenarios"], SCENARIO: "failed"})
                self.assertEqual({key: report[key] for key in expected}, expected)
                self.assertIn("Operator failure", report["observations"][SCENARIO]["seenResult"])
                with patch("subprocess.run") as adb, patch("http.client.HTTPConnection") as http:
                    for tail in (["adb", "shell", "input", "tap", "50", "40"], ["status"]):
                        status, output = self.invoke(tail)
                        self.assertEqual(status, 1)
                        self.assertIn("BLOCKED", output)
                    adb.assert_not_called()
                    http.assert_not_called()
                self.assertEqual(self.latch.read_bytes(), first)
                connection.close.assert_called_once()

    def test_total_status_deadline(self):
        connection = self.response(b"{}")
        with patch("http.client.HTTPConnection", return_value=connection), patch("time.monotonic", side_effect=[0, 1, 2, 31]):
            status, output = self.invoke(["status"])
        self.assertEqual(status, 1)
        self.assertIn("deadline exceeded", output)

    def test_writer_failure_keeps_original_failure(self):
        with patch("http.client.HTTPConnection", side_effect=ConnectionRefusedError("original refusal")), patch("subprocess.run", side_effect=OSError("writer unavailable")):
            status, output = self.invoke(["status"])
        self.assertEqual(status, 1)
        self.assertIn("SECONDARY failed report publication", output)
        self.assertEqual(json.loads(self.latch.read_text())["error"], "ConnectionRefusedError: original refusal")
        self.assertEqual(json.loads(self.report.read_text()), self.original)

    def test_binding_rejects_wrong_row_identity_slot_and_finished_attempt(self):
        for mutation in ("environment", "digest", "runId", "slot", "row", "finished", "failed"):
            with self.subTest(mutation=mutation):
                self.setUp()
                report = dict(self.original, scenarios=dict(self.original["scenarios"]))
                if mutation == "environment": report["environment"] = "maplibre-android"
                if mutation == "digest": report["libraryDistSha256"] = "bad"
                if mutation == "runId": report["runId"] = "bad"
                if mutation == "failed": report["scenarios"][SCENARIO] = "failed"
                self.report.write_text(json.dumps(report))
                if mutation == "finished": (self.attempt / "receipt.json").write_text("{}")
                prefix = ["../other", SCENARIO] if mutation == "row" else [ROW, "unknown"] if mutation == "slot" else None
                with patch("subprocess.run") as adb, patch("http.client.HTTPConnection") as http:
                    status, _ = self.invoke(["status"], prefix)
                    adb.assert_not_called()
                    http.assert_not_called()
                self.assertEqual(status, 1)
                self.assertEqual(json.loads(self.report.read_text()), report)

    def cli_copy(self):
        fake = self.attempt / "fake-adb"
        fake.write_text("#!/usr/bin/env python3\nimport json, sys\nprint(json.dumps(sys.argv[1:]))\nif 'fail' in sys.argv: sys.exit(7)\nif 'timeout' in sys.argv:\n import time\n time.sleep(5)\n")
        fake.chmod(0o700)
        script = self.attempt / "android-operator.py"
        source = HELPER.read_text()
        source = source.replace('ADB = "/Users/rob/Library/Android/sdk/platform-tools/adb"', "ADB = " + repr(str(fake)))
        source = re.sub(r'^STAGE = .*$', "STAGE = Path(" + repr(str(self.stage)) + ")", source, flags=re.M)
        source = source.replace('WRITER = Path(__file__).with_name("record-native-ui-observation.mjs")', "WRITER = Path(" + repr(str(ROOT / "scripts/record-native-ui-observation.mjs")) + ")")
        script.write_text(source)
        return script

    def test_real_child_timeout(self):
        self.cli_copy()
        self.globals["ADB"] = str(self.attempt / "fake-adb")
        self.globals["TIMEOUT_SECONDS"] = 0.02
        status, output = self.invoke(["adb", "timeout"])
        self.assertEqual(status, 1)
        self.assertIn("TimeoutExpired", output)
        self.assertIn("TimeoutExpired", json.loads(self.latch.read_text())["error"])

    def test_actual_cli_and_fresh_process_failure_latch(self):
        script = self.cli_copy()
        def run(tail):
            return subprocess.run([sys.executable, str(script), str(self.attempt), ROW, SCENARIO, *tail], capture_output=True, text=True, timeout=10)
        first = run(["adb", "fail"])
        self.assertEqual(first.returncode, 1, first.stderr)
        self.assertIn("CalledProcessError", first.stdout)
        saved = self.latch.read_bytes()
        for tail in (["adb", "shell", "input", "swipe", "1000", "110", "100", "110", "450"], ["status"]):
            later = run(tail)
            self.assertEqual(later.returncode, 1)
            self.assertIn("BLOCKED", later.stdout)
            self.assertNotIn("START", later.stdout)
            self.assertEqual(self.latch.read_bytes(), saved)

    def toolbar_xml(self, buttons):
        # Real UIAutomator classes/labels and 1080px toolbar bounds from saved TF07 XML.
        children = "".join(
            f'<node class="android.widget.Button" package="com.onemapmapbox" '
            f'content-desc="{label}" clickable="true" enabled="true" bounds="{bounds}"/>'
            for label, bounds in buttons
        )
        return ('<hierarchy><node bounds="[0,0][1080,2400]">'
                '<node class="android.widget.HorizontalScrollView" package="com.onemapmapbox" '
                'bounds="[0,63][1080,156]">' + children + '</node></node></hierarchy>')

    def toolbar_child(self, snapshots, fail=None, after=None):
        calls = []
        def run(command, **options):
            if command[0] != self.globals["ADB"]:
                raise OSError("writer unavailable")
            arguments = command[3:]
            calls.append(arguments)
            self.assertTrue(options["check"])
            self.assertFalse(options["shell"])
            self.assertLessEqual(options["timeout"], 30)
            if fail is not None and len(calls) == fail:
                raise subprocess.CalledProcessError(7, command)
            if arguments[:2] == ["shell", "cat"]:
                options["stdout"].write(snapshots.pop(0).encode())
            if after is not None:
                after(arguments)
        return calls, run

    def rejection_xml(self):
        return Path("/Users/rob/code/mapbox-code/one-map-f05-android-recovery/android-platform-batch-attempt-25/toolbar-036-hierarchy-001.xml").read_text()

    def rejection_result_xml(self, label="Reject view draggable"):
        message = "Native Marker does not support dragging. Use a selected raw native annotation for SDK dragging."
        return self.toolbar_xml([("READ RENDERER", "[700,63][1050,156]")]).replace(
            "</hierarchy>", '<node class="android.widget.TextView" package="com.onemapmapbox" '
            'resource-id="tf07-marker-rejection" bounds="[0,160][1080,400]" text="' + label + ': ' + message + '" /></hierarchy>')

    def test_expected_marker_overlays_dismiss_with_decreasing_count_then_check_boundary_and_toolbar(self):
        for label in ("Reject view draggable", "Reject view callback", "Reject annotation draggable", "Reject annotation callback"):
            with self.subTest(label=label):
                self.setUp()
                calls, child = self.toolbar_child([self.rejection_xml(), self.rejection_xml().replace("Log 2 of 2", "Log 1 of 1"), self.rejection_result_xml(label)])
                with patch("subprocess.run", side_effect=child):
                    status, output = self.invoke(["dismiss-marker-rejection", label], [ROW, "marker-prop-rejection"])
                self.assertEqual(status, 0, output)
                self.assertEqual([args for args in calls if args[:2] == ["shell", "input"]],
                                 [["shell", "input", "tap", "180", "2274"]] * 2)
                self.assertEqual(json.loads(self.report.read_text()), self.original)

    def warning_xml(self):
        return Path("/Users/rob/code/mapbox-code/one-map-f05-android-recovery/android-platform-batch-attempt-26/toolbar-003-hierarchy-002.xml").read_text()

    def test_actual_cli_marker_and_notice_bind_to_selected_backend_and_result(self):
        labels = ("Reject view draggable", "Reject view callback",
                  "Reject annotation draggable", "Reject annotation callback")
        cases = [("mapbox", labels[0], None)] + [("maplibre", label, None) for label in labels]
        cases += [("maplibre", labels[0], wrong) for wrong in ("overlay", "notice", "result")]
        for backend, label, wrong in cases:
            with self.subTest(backend=backend, label=label, wrong=wrong):
                self.setUp()
                row = backend + "-android-core"
                self.original["environment"] = backend + "-android"
                self.report.unlink()
                self.report = self.attempt / (row + "-manual.json")
                self.report.write_text(json.dumps(self.original))
                (self.attempt / "checkpoint.json").write_text(json.dumps({"currentRow": row}))
                script = self.cli_copy()
                saved = Path("/Users/rob/code/mapbox-code/one-map-f05-android-recovery/android-platform-batch-attempt-26/toolbar-003-hierarchy-001.xml").read_text()
                snapshots = [saved, self.warning_xml(), self.rejection_result_xml(label)]
                snapshots = [xml.replace("com.onemapmapbox", "com.onemap" + backend) for xml in snapshots]
                if wrong is not None:
                    index = ("overlay", "notice", "result").index(wrong)
                    if wrong == "result":
                        # Keep the selected toolbar, but reject the other app's boundary result.
                        snapshots[index] = snapshots[index].replace('class="android.widget.TextView" package="com.onemapmaplibre"', 'class="android.widget.TextView" package="com.onemapmapbox"')
                    else:
                        snapshots[index] = snapshots[index].replace("com.onemapmaplibre", "com.onemapmapbox")
                (self.attempt / "snapshots.json").write_text(json.dumps(snapshots))
                (self.attempt / "fake-adb").write_text(r"""#!/usr/bin/env python3
import json, pathlib, sys
root = pathlib.Path(__file__).parent
args = sys.argv[1:]
with (root / 'calls.jsonl').open('a') as output:
    output.write(json.dumps(args) + '\n')
if args[2:4] == ['shell', 'cat']:
    path = root / 'snapshots.json'
    snapshots = json.loads(path.read_text())
    print(snapshots.pop(0))
    path.write_text(json.dumps(snapshots))
""")
                command = [sys.executable, str(script), str(self.attempt), row, "marker-prop-rejection", "dismiss-marker-rejection", label]
                result = subprocess.run(command, capture_output=True, text=True, timeout=10)
                self.assertEqual(result.returncode, 0 if wrong is None else 1, result.stdout + result.stderr)
                calls = [json.loads(line) for line in (self.attempt / "calls.jsonl").read_text().splitlines()]
                taps = 2 if wrong is None else ("overlay", "notice", "result").index(wrong)
                self.assertEqual([args for args in calls if args[2:4] == ["shell", "input"]],
                                 [["-s", "emulator-5580", "shell", "input", "tap", "180", "2274"]] * taps)
                report = json.loads(self.report.read_text())
                if wrong is None:
                    self.assertEqual(report, self.original)
                else:
                    self.assertEqual(report["scenarios"]["marker-prop-rejection"], "failed")
                    self.assertEqual(report["metadata"], self.original["metadata"])
                receipt = json.loads((self.attempt / "toolbar-001.json").read_text())
                self.assertEqual(receipt["status"], "rejection-verified" if wrong is None else "failed")
                if wrong is None:
                    self.assertEqual(json.loads((self.attempt / "snapshots.json").read_text()), [])
                    self.assertFalse(self.latch.exists())
                else:
                    saved_latch = self.latch.read_bytes()
                    saved_calls = (self.attempt / "calls.jsonl").read_bytes()
                    retry = subprocess.run(command, capture_output=True, text=True, timeout=10)
                    self.assertEqual(retry.returncode, 1)
                    self.assertIn("BLOCKED", retry.stdout)
                    self.assertEqual(self.latch.read_bytes(), saved_latch)
                    self.assertEqual((self.attempt / "calls.jsonl").read_bytes(), saved_calls)

    def test_migration_notice_rejects_unknown_content_identity_controls_and_order(self):
        xml = self.warning_xml()
        cases = {
            "actual-warning": xml.replace("Open debugger to view warnings.", "Unexpected application warning."),
            "package": xml.replace("com.onemapmapbox", "com.foreign"),
            "header": xml.replace("Console Warning", "Console Error"),
            "counter": xml.replace("Log 1 of 1", "Log 1 of 2"),
            "duplicate": xml.replace("</hierarchy>", '<node package="com.onemapmapbox" text="Open debugger to view warnings." /></hierarchy>'),
            "unknown-message": xml.replace("</hierarchy>", '<node package="com.onemapmapbox" text="Unexpected warning" /></hierarchy>'),
            "component-stack": xml.replace("</hierarchy>", '<node package="com.onemapmapbox" text="&lt;OtherComponent /&gt;" /></hierarchy>'),
            "description": xml.replace('content-desc="Copy"', 'content-desc="Unknown"'),
            "missing": xml.replace('content-desc="Dismiss"', 'content-desc="Other"'),
            "disabled": xml.replace('content-desc="Dismiss" checkable="false" checked="false" clickable="true" enabled="true"', 'content-desc="Dismiss" checkable="false" checked="false" clickable="true" enabled="false"'),
            "clipped": xml.replace('[0,2211][360,2337]', '[0,2211][360,2500]'),
            "malformed": '<hierarchy>',
        }
        for name, followup in cases.items():
            with self.subTest(name=name):
                self.setUp()
                calls, child = self.toolbar_child([self.rejection_xml(), followup])
                with patch("subprocess.run", side_effect=child):
                    status, output = self.invoke(["dismiss-marker-rejection", "Reject view draggable"], [ROW, "marker-prop-rejection"])
                    self.assertEqual(status, 1, output)
                    saved = self.latch.read_bytes()
                    count = len(calls)
                    self.assertEqual(self.invoke(["dismiss-marker-rejection", "Reject view draggable"], [ROW, "marker-prop-rejection"])[0], 1)
                    self.assertEqual(len(calls), count)
                self.assertEqual(self.latch.read_bytes(), saved)
                self.assertEqual(len([args for args in calls if args[:2] == ["shell", "input"]]), 1)
        self.setUp()
        calls, child = self.toolbar_child([xml])
        with patch("subprocess.run", side_effect=child):
            status, output = self.invoke(["dismiss-marker-rejection", "Reject view draggable"], [ROW, "marker-prop-rejection"])
        self.assertEqual(status, 1, output)
        self.assertFalse(any(args[:2] == ["shell", "input"] for args in calls))

    def test_migration_notice_requires_current_row_bounded_progress_and_exact_postcondition(self):
        for failure in ("repeated", "wrong-result", "binding", "receipt", "external-latch", "deadline", "child"):
            with self.subTest(failure=failure):
                self.setUp()
                end = self.warning_xml() if failure == "repeated" else self.rejection_result_xml("Reject view callback") if failure == "wrong-result" else self.rejection_result_xml()
                taps = []
                def after(arguments):
                    if arguments[:3] != ["shell", "input", "tap"]: return
                    taps.append(arguments)
                    if len(taps) != 1: return
                    if failure == "binding": self.report.write_text(json.dumps(dict(self.original, runId="12345678-1234-4234-8234-123456789013")))
                    if failure == "receipt": (self.attempt / "receipt.json").write_text("{}")
                    if failure == "external-latch": self.latch.write_text('{"error":"external first failure"}')
                calls, child = self.toolbar_child([self.rejection_xml(), self.warning_xml(), end], fail=6 if failure == "child" else None, after=after)
                self.globals["TOOLBAR_SECONDS"] = 0 if failure == "deadline" else 120
                with patch("subprocess.run", side_effect=child):
                    status, output = self.invoke(["dismiss-marker-rejection", "Reject view draggable"], [ROW, "marker-prop-rejection"])
                self.assertEqual(status, 1, output)
                self.assertLessEqual(len(taps), 2)
                if failure in ("binding", "receipt", "external-latch", "child"): self.assertEqual(len(taps), 1)
                if failure == "deadline": self.assertEqual(len(taps), 0)
                if failure == "external-latch": self.assertEqual(json.loads(self.latch.read_text())["error"], "external first failure")

    def test_single_expected_log_dismisses_once_and_validates_fixture(self):
        calls, child = self.toolbar_child([self.rejection_xml().replace("Log 2 of 2", "Log 1 of 1"), self.rejection_result_xml()])
        with patch("subprocess.run", side_effect=child):
            status, output = self.invoke(["dismiss-marker-rejection", "Reject view draggable"], [ROW, "marker-prop-rejection"])
        self.assertEqual(status, 0, output)
        self.assertEqual(len([args for args in calls if args[:2] == ["shell", "input"]]), 1)

    def test_marker_overlay_rejects_wrong_identity_controls_and_followup_without_input_retry(self):
        xml = self.rejection_xml()
        cases = {
            "message": xml.replace("Native Marker does not support dragging.", "Unexpected failure."),
            "package": xml.replace("com.onemapmapbox", "com.foreign"),
            "boundary": xml.replace("NativeMarkerRejectionBoundary", "OtherBoundary"),
            "title": xml.replace("Render Error", "Syntax Error"),
            "counter": xml.replace("Log 2 of 2", "Log 3 of 3"),
            "not-last": xml.replace("Log 2 of 2", "Log 1 of 2"),
            "missing": xml.replace('content-desc="Dismiss"', 'content-desc="Other"'),
            "disabled": xml.replace('content-desc="Dismiss" checkable="false" checked="false" clickable="true" enabled="true"', 'content-desc="Dismiss" checkable="false" checked="false" clickable="true" enabled="false"'),
            "duplicate": xml.replace('</hierarchy>', '<node class="android.view.ViewGroup" package="com.onemapmapbox" content-desc="Dismiss" clickable="true" enabled="true" bounds="[0,2211][360,2337]" /></hierarchy>'),
            "clipped": xml.replace('[0,2211][360,2337]', '[0,2211][360,2500]'),
            "malformed": '<hierarchy>',
        }
        for name, snapshot in cases.items():
            with self.subTest(name=name):
                self.setUp()
                calls, child = self.toolbar_child([snapshot])
                with patch("subprocess.run", side_effect=child):
                    status, output = self.invoke(["dismiss-marker-rejection", "Reject view draggable"], [ROW, "marker-prop-rejection"])
                    self.assertEqual(status, 1, output)
                    saved = self.latch.read_bytes()
                    self.assertEqual(self.invoke(["dismiss-marker-rejection", "Reject view draggable"], [ROW, "marker-prop-rejection"])[0], 1)
                self.assertEqual(self.latch.read_bytes(), saved)
                self.assertFalse(any(args[:2] == ["shell", "input"] for args in calls))
        for followup in (xml, xml.replace("Log 2 of 2", "Log 1 of 1").replace("Native Marker does not support dragging.", "Unexpected failure."), self.rejection_result_xml("Reject annotation callback"), self.rejection_result_xml().replace("Native Marker", "Unexpected Marker")):
            self.setUp()
            calls, child = self.toolbar_child([xml, followup])
            with patch("subprocess.run", side_effect=child):
                status, output = self.invoke(["dismiss-marker-rejection", "Reject view draggable"], [ROW, "marker-prop-rejection"])
            self.assertEqual(status, 1, output)
            self.assertEqual(len([args for args in calls if args[:2] == ["shell", "input"]]), 1)

    def test_marker_overlay_is_never_handled_for_another_scenario_or_row(self):
        for prefix in ([ROW, SCENARIO], ["maplibre-android-retained", "marker-prop-rejection"], [ROW, "marker-prop-rejection"]):
            self.setUp()
            with patch("subprocess.run") as child:
                status, output = self.invoke(["dismiss-marker-rejection", "wrong" if prefix == [ROW, "marker-prop-rejection"] else "Reject view draggable"], prefix)
            self.assertEqual(status, 1, output)
            self.assertFalse(any(call.args[0][0] == self.globals["ADB"] for call in child.call_args_list))

    def test_toolbar_offscreen_then_visible_and_return_to_earlier_action(self):
        early = self.toolbar_xml([("REMOUNT", "[0,63][217,156]"), ("OFFSET", "[368,63][543,156]")])
        late = self.toolbar_xml([("CLEAR REJECTION", "[300,63][700,156]"), ("READ RENDERER", "[700,63][1050,156]")])
        snapshots = [early, late, late, early]
        calls, child = self.toolbar_child(snapshots)
        with patch("subprocess.run", side_effect=child):
            status, output = self.invoke(["toolbar", "Read renderer"])
            self.assertEqual(status, 0, output)
            self.assertFalse(self.latch.exists())
            status, output = self.invoke(["toolbar", "offset"])
        self.assertEqual(status, 0, output)
        inputs = [args for args in calls if args[:2] == ["shell", "input"]]
        self.assertEqual(inputs, [
            ["shell", "input", "swipe", "810", "109", "270", "109", "450"],
            ["shell", "input", "tap", "875", "109"],
            ["shell", "input", "swipe", "270", "109", "810", "109", "450"],
            ["shell", "input", "tap", "455", "109"],
        ])
        dumps = [args[-1] for args in calls if args[:3] == ["shell", "uiautomator", "dump"]]
        self.assertEqual(len(set(dumps)), 4)
        self.assertTrue(all("hierarchy-" in path for path in dumps))
        self.assertEqual(json.loads(self.report.read_text()), self.original)
        self.assertEqual(json.loads((self.attempt / "toolbar-001.json").read_text())["swipes"], 1)
        self.assertNotIn("<hierarchy>", output)

    def test_toolbar_visible_has_no_swipe_and_clipped_target_is_not_tapped(self):
        visible = self.toolbar_xml([("READ RENDERER", "[700,63][1050,156]")])
        clipped = self.toolbar_xml([("OFFSET", "[300,63][500,156]"), ("READ RENDERER", "[1000,63][1300,156]")])
        for snapshots, expected_swipes in (([visible], 0), ([clipped, visible], 1)):
            self.setUp()
            calls, child = self.toolbar_child(snapshots)
            with patch("subprocess.run", side_effect=child):
                status, output = self.invoke(["toolbar", "Read renderer"])
            self.assertEqual(status, 0, output)
            inputs = [args for args in calls if args[:2] == ["shell", "input"]]
            self.assertEqual(sum(args[2] == "swipe" for args in inputs), expected_swipes)
            self.assertEqual(inputs[-1], ["shell", "input", "tap", "875", "109"])

    def test_toolbar_failures_latch_and_never_send_later_input(self):
        early = self.toolbar_xml([("OFFSET", "[300,63][500,156]")])
        late = self.toolbar_xml([("READ RENDERER", "[700,63][1050,156]")])
        for failure in ("no-progress", "limit", "deadline", "ambiguous", "child", "external-latch", "receipt", "binding"):
            with self.subTest(failure=failure):
                self.setUp()
                snapshots = [early, early]
                if failure == "ambiguous":
                    snapshots = [self.toolbar_xml([("READ RENDERER", "[50,63][300,156]"), ("READ RENDERER", "[400,63][700,156]")])]
                def after(arguments):
                    if arguments[:3] != ["shell", "input", "swipe"]: return
                    if failure == "external-latch": self.latch.write_text('{"error":"external first failure"}')
                    if failure == "receipt": (self.attempt / "receipt.json").write_text("{}")
                    if failure == "binding":
                        identity = dict(self.original, runId="12345678-1234-4234-8234-123456789013")
                        self.report.write_text(json.dumps(identity))
                calls, child = self.toolbar_child(snapshots, fail=1 if failure == "child" else None, after=after)
                self.globals["TOOLBAR_SWIPES"] = 0 if failure == "limit" else 12
                self.globals["TOOLBAR_SECONDS"] = 0 if failure == "deadline" else 120
                with patch("subprocess.run", side_effect=child):
                    status, output = self.invoke(["toolbar", "Read renderer"])
                    self.assertEqual(status, 1, output)
                    saved = self.latch.read_bytes()
                    count = len(calls)
                    self.assertEqual(self.invoke(["toolbar", "Read renderer"])[0], 1)
                    self.assertEqual(len(calls), count)
                self.assertEqual(self.latch.read_bytes(), saved)
                self.assertFalse(any(args[:3] == ["shell", "input", "tap"] for args in calls))
                if failure == "external-latch": self.assertEqual(json.loads(saved)["error"], "external first failure")
                if failure == "child": self.assertIn("CalledProcessError", json.loads(saved)["error"])

    def test_toolbar_terminal_tap_does_not_query_closed_or_replaced_row(self):
        for transition in ("completed", "next-row", "receipt"):
            with self.subTest(transition=transition):
                self.setUp()
                xml = self.toolbar_xml([("READ RENDERER", "[700,63][1050,156]")])
                def after(arguments):
                    if arguments[:3] != ["shell", "input", "tap"]: return
                    if transition == "receipt": (self.attempt / "receipt.json").write_text("{}")
                    else:
                        checkpoint = {"currentRow": "mapbox-android-retained" if transition == "next-row" else ROW,
                                      "rows": [{"rowId": ROW, "status": "passed"}]}
                        (self.attempt / "checkpoint.json").write_text(json.dumps(checkpoint))
                calls, child = self.toolbar_child([xml], after=after)
                with patch("subprocess.run", side_effect=child):
                    status, output = self.invoke(["toolbar", "Read renderer"])
                self.assertEqual(status, 0, output)
                self.assertFalse(self.latch.exists())
                self.assertEqual(calls[-1], ["shell", "input", "tap", "875", "109"])
                self.assertEqual(json.loads((self.attempt / "toolbar-001.json").read_text())["status"], "input-complete")

    def test_toolbar_case_and_whitespace_resolve_fixture_labels(self):
        xml = self.toolbar_xml([("Offset", "[368,63][543,156]")])
        calls, child = self.toolbar_child([xml])
        with patch("subprocess.run", side_effect=child):
            status, output = self.invoke(["toolbar", "  OFFSET  "])
        self.assertEqual(status, 0, output)
        self.assertEqual(json.loads((self.attempt / "toolbar-001.json").read_text())["label"], "offset")
        self.assertEqual([args for args in calls if args[:2] == ["shell", "input"]],
                         [["shell", "input", "tap", "455", "109"]])

    def test_toolbar_receipt_failure_preserves_navigation_error(self):
        original = Path.write_text
        def write(path, *arguments, **options):
            if path.name == "toolbar-001.json":
                raise OSError("receipt unavailable")
            return original(path, *arguments, **options)
        calls, child = self.toolbar_child([], fail=1)
        with patch("subprocess.run", side_effect=child), patch.object(Path, "write_text", write):
            status, output = self.invoke(["toolbar", "Read renderer"])
        self.assertEqual(status, 1, output)
        self.assertIn("SECONDARY toolbar receipt publication", output)
        self.assertIn("CalledProcessError", json.loads(self.latch.read_text())["error"])
        self.assertNotIn("receipt unavailable", json.loads(self.latch.read_text())["error"])

    def test_actual_cli_toolbar_uses_fresh_transcripts(self):
        script = self.cli_copy()
        early = self.toolbar_xml([("OFFSET", "[368,63][543,156]")])
        late = self.toolbar_xml([("READ RENDERER", "[700,63][1050,156]")])
        (self.attempt / "snapshots.json").write_text(json.dumps([early, late]))
        fake = self.attempt / "fake-adb"
        fake.write_text(r"""#!/usr/bin/env python3
import json, pathlib, sys
root = pathlib.Path(__file__).parent
args = sys.argv[1:]
with (root / 'calls.jsonl').open('a') as output:
    output.write(json.dumps(args) + '\n')
if args[2:4] == ['shell', 'cat']:
    path = root / 'snapshots.json'
    snapshots = json.loads(path.read_text())
    print(snapshots.pop(0))
    path.write_text(json.dumps(snapshots))
""")
        command = [sys.executable, str(script), str(self.attempt), ROW, SCENARIO, "toolbar", "Read renderer"]
        result = subprocess.run(command, capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        calls = [json.loads(line) for line in (self.attempt / "calls.jsonl").read_text().splitlines()]
        inputs = [args for args in calls if args[2:4] == ["shell", "input"]]
        self.assertEqual(inputs, [["-s", "emulator-5580", "shell", "input", "swipe", "810", "109", "270", "109", "450"],
                                  ["-s", "emulator-5580", "shell", "input", "tap", "875", "109"]])
        self.assertEqual(json.loads((self.attempt / "snapshots.json").read_text()), [])
        self.assertFalse(self.latch.exists())

    def test_retained_top_edge_toolbar_uses_fresh_lower_interior_for_taps_and_swipes(self):
        saved = Path("/Users/rob/code/mapbox-code/one-map-f05-android-recovery/android-platform-batch-attempt-27/toolbar-019-hierarchy-001.xml").read_text()
        self.original["scenarios"] = {"simultaneous-named-maps": "unverified"}
        self.report = self.attempt / "mapbox-android-retained-manual.json"
        self.report.write_text(json.dumps(self.original))
        (self.attempt / "checkpoint.json").write_text(json.dumps({"currentRow": "mapbox-android-retained"}))
        calls, child = self.toolbar_child([saved])
        with patch("subprocess.run", side_effect=child):
            status, output = self.invoke(["toolbar", "Read focus"], ["mapbox-android-retained", "simultaneous-named-maps"])
        self.assertEqual(status, 0, output)
        self.assertEqual([args for args in calls if args[:2] == ["shell", "input"]],
                         [["shell", "input", "tap", "130", "81"]])
        early = self.toolbar_xml([("READ FOCUS", "[0,0][261,93]")]).replace('[0,63][1080,156]', '[0,0][1080,93]')
        late = self.toolbar_xml([("IMAGE", "[700,0][1050,93]")]).replace('[0,63][1080,156]', '[0,0][1080,93]')
        calls, child = self.toolbar_child([early, late])
        with patch("subprocess.run", side_effect=child):
            status, output = self.invoke(["toolbar", "Image"], ["mapbox-android-retained", "simultaneous-named-maps"])
        self.assertEqual(status, 0, output)
        self.assertEqual([args for args in calls if args[:2] == ["shell", "input"]],
                         [["shell", "input", "swipe", "810", "81", "270", "81", "450"],
                          ["shell", "input", "tap", "875", "81"]])

    def test_toolbar_unknown_label_rejects_before_boundary(self):
        with patch("subprocess.run") as child, patch("http.client.HTTPConnection") as http:
            status, output = self.invoke(["toolbar", "Unknown"])
        self.assertEqual(status, 1, output)
        child.assert_not_called()
        http.assert_not_called()

    def test_exact_packet_marker_commands_reach_the_expected_transport(self):
        packet = json.loads((ROOT / "records/evidence/revised-api-u26-mapbox-android-api36-console-resume-preparation.json").read_text())
        protocol = packet["markerRejectionProtocol"]
        self.assertEqual(len(protocol["cases"]), 4)
        for case in protocol["cases"]:
            for field in ("request", "recoverAndVerify", "readRenderer", "status", "clear"):
                with self.subTest(label=case["label"], field=field):
                    self.setUp()
                    command = shlex.split(case[field])
                    self.assertEqual(command[:2], ["python3", str(HELPER)])
                    self.assertEqual(command[2], packet["operatorProtocol"]["output"])
                    self.assertEqual(command[3:5], [ROW, "marker-prop-rejection"])
                    if field == "recoverAndVerify":
                        self.assertEqual(command[5:], ["dismiss-marker-rejection", case["label"]])
                        snapshots = [self.rejection_xml(), self.warning_xml(), self.rejection_result_xml(case["label"])]
                    elif field == "status":
                        self.assertEqual(command[5:], ["status"])
                        snapshots = []
                    else:
                        expected = case["label"] if field == "request" else "Read renderer" if field == "readRenderer" else "Clear rejection"
                        self.assertEqual(command[5:], ["toolbar", expected])
                        snapshots = [self.toolbar_xml([(expected.upper(), "[300,63][1000,156]")])]
                    calls, child = self.toolbar_child(snapshots)
                    with patch("subprocess.run", side_effect=child), patch("http.client.HTTPConnection", return_value=self.response(b"null")):
                        status, output = self.invoke(command[5:], command[3:5])
                    self.assertEqual(status, 0, output)
                    self.assertFalse(self.latch.exists())

    def test_adb_boundaries_and_bounded_output(self):
        for failure in (subprocess.TimeoutExpired("fake", 30), OSError("missing"), subprocess.CalledProcessError(7, "fake")):
            with self.subTest(failure=failure):
                self.setUp()
                def boundary(command, **options):
                    self.assertEqual(command[:3], ["/Users/rob/Library/Android/sdk/platform-tools/adb", "-s", "emulator-5580"])
                    self.assertEqual(options["timeout"], 30)
                    self.assertTrue(options["check"])
                    self.assertFalse(options["shell"])
                    options["stdout"].write(b"x" * 150000)
                    raise failure
                with patch("subprocess.run", side_effect=boundary):
                    status, output = self.invoke(["adb", "shell", "input", "tap", "50", "40"])
                self.assertEqual(status, 1)
                self.assertLess(len(output), 133000)
                self.assertIn(type(failure).__name__, json.loads(self.latch.read_text())["error"])


if __name__ == "__main__":
    unittest.main()
