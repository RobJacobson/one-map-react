"""Exercise the copyable CLI through a fake child, never adb."""

import contextlib
import io
import json
from pathlib import Path
import runpy
import shlex
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parent.parent
HELPER = ROOT / "scripts/android-operator.py"
PLAN = ROOT / "docs/revised-api-acceptance-plan.md"
REAL_RUN = subprocess.run
XML = '<hierarchy><node text="Read renderer" bounds="[10,20][90,60]" /></hierarchy>'


class OperatorTest(unittest.TestCase):
    def invoke(self, command, behavior="success"):
        arguments = shlex.split(command)
        self.assertEqual(arguments[:2], ["python3", str(HELPER)])
        output = io.StringIO()
        with tempfile.TemporaryDirectory() as temporary:
            fake = Path(temporary) / "fake-adb"
            fake.write_text(
                "#!/usr/bin/env python3\nimport json, sys\n"
                + ("print(" + repr(XML) + ")\n" if behavior == "success" else "")
                + "print(json.dumps(sys.argv[1:]))\n"
                + ("print('x' * 150000)\nsys.exit(7)\n" if behavior == "failure" else "")
            )
            fake.chmod(0o700)

            def fake_boundary(command, **options):
                self.assertEqual(command[:3], ["/Users/rob/Library/Android/sdk/platform-tools/adb", "-s", "emulator-5580"])
                self.assertEqual(command[3:], arguments[2:])
                self.assertEqual(options["timeout"], 30)
                self.assertTrue(options["check"])
                self.assertFalse(options["shell"])
                if behavior == "missing":
                    return REAL_RUN([str(fake) + "-missing"], **options)
                if behavior == "timeout":
                    options["timeout"] = 0.02
                    return REAL_RUN([sys.executable, "-c", "import time; time.sleep(5)"], **options)
                return REAL_RUN([str(fake), *command[1:]], **options)

            with patch.object(sys, "argv", arguments[1:]), patch("subprocess.run", side_effect=fake_boundary) as boundary, contextlib.redirect_stdout(output):
                with self.assertRaises(SystemExit) as result:
                    runpy.run_path(str(HELPER), run_name="__main__")
            boundary.assert_called_once()
        return result.exception.code, output.getvalue()

    def test_exact_documented_commands(self):
        commands = [line for line in PLAN.read_text().splitlines() if line.startswith("python3 " + str(HELPER) + " ")]
        self.assertEqual(len(commands), 6)
        dump = shlex.split(commands[0])
        read = shlex.split(commands[1])
        self.assertEqual(dump[2:5], ["shell", "uiautomator", "dump"])
        self.assertEqual(read[2:4], ["shell", "cat"])
        self.assertEqual(dump[-1], read[-1])
        self.assertTrue(dump[-1].endswith("hierarchy-001.xml"))
        for command in commands:
            self.assertFalse(any(token in shlex.split(command) for token in [";", "&&", "|", "try:"]))
            with self.subTest(command=command):
                status, output = self.invoke(command)
                self.assertEqual(status, 0)
                self.assertIn("START", output)
                self.assertIn("COMPLETE 0", output)
                self.assertNotIn("FAILED", output)
                child_arguments = json.loads(output.rstrip().splitlines()[-1])
                self.assertEqual(child_arguments, ["-s", "emulator-5580", *shlex.split(command)[2:]])
                if " shell cat " in command:
                    hierarchy = ET.fromstring(output.rstrip().splitlines()[-2])
                    self.assertEqual(hierarchy.find("node").attrib["bounds"], "[10,20][90,60]")

    def test_failures_stop_with_bounded_output(self):
        command = "python3 " + str(HELPER) + " shell input tap 50 40"
        for behavior, error in [("failure", "CalledProcessError"), ("timeout", "TimeoutExpired"), ("missing", "FileNotFoundError")]:
            with self.subTest(behavior=behavior):
                status, output = self.invoke(command, behavior)
                self.assertEqual(status, 1)
                self.assertIn("FAILED " + error, output)
                self.assertNotIn("COMPLETE", output)
                self.assertLess(len(output), 132000)

    def test_inline_compound_statement_regression(self):
        with self.assertRaises(SyntaxError):
            compile("import subprocess; try: subprocess.run(['fake-adb'])", "old-operator", "exec")
        compile(HELPER.read_text(), str(HELPER), "exec")


if __name__ == "__main__":
    unittest.main()
