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

    def test_exact_documented_adb_commands(self):
        script = self.cli_copy()
        commands = [shlex.split(line) for line in PLAN.read_text().splitlines() if line.startswith("python3 " + str(HELPER) + " ")]
        self.assertEqual(len(commands), 7)
        self.assertEqual(commands[0][-1], commands[1][-1])
        self.assertTrue(commands[0][-1].endswith("attempt07-hierarchy-001.xml"))
        for command in commands:
            self.assertEqual(command[3:5], [ROW, SCENARIO])
            if command[5] == "status":
                for body in (b"null", b'{"events":{"child-click":1}}'):
                    connection = self.response(body)
                    output = io.StringIO()
                    argv = [str(script), str(self.attempt), *command[3:]]
                    with patch.object(sys, "argv", argv), patch("http.client.HTTPConnection", return_value=connection) as boundary, patch("subprocess.run") as adb, contextlib.redirect_stdout(output):
                        with self.assertRaises(SystemExit) as result:
                            runpy.run_path(str(script), run_name="__main__")
                    self.assertEqual(result.exception.code, 0, output.getvalue())
                    self.assertIn(json.dumps(json.loads(body)), output.getvalue())
                    self.assertIn("COMPLETE 0", output.getvalue())
                    boundary.assert_called_once_with("127.0.0.1", 8797, timeout=30)
                    connection.request.assert_called_once_with("GET", "/tf07")
                    adb.assert_not_called()
            else:
                result = subprocess.run([sys.executable, str(script), str(self.attempt), *command[3:]], capture_output=True, text=True, timeout=10)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertIn(json.dumps(["-s", "emulator-5580", *command[6:]]), result.stdout)
                self.assertIn("COMPLETE 0", result.stdout)

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
