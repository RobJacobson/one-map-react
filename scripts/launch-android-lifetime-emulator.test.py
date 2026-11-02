"""Exercise the actual emulator launcher without creating a process or device."""
import contextlib
import io
import json
from pathlib import Path
import runpy
import subprocess
import tempfile
import unittest
from unittest.mock import Mock, patch

LAUNCHER = Path(__file__).with_name("launch-android-lifetime-emulator.py")


class LauncherTests(unittest.TestCase):
    def run_launcher(self, log_path, process):
        output = io.StringIO()
        with patch("sys.argv", [str(LAUNCHER), str(log_path)]), \
                patch("subprocess.Popen", return_value=process) as spawn, \
                contextlib.redirect_stdout(output):
            runpy.run_path(str(LAUNCHER), run_name="__main__")
        return output.getvalue(), spawn

    def test_owned_running_process_and_kernel_console(self):
        process = Mock(pid=501)
        process.wait.side_effect = subprocess.TimeoutExpired("emulator", 1)
        with tempfile.TemporaryDirectory() as directory:
            log_path = Path(directory) / "emulator.log"
            output, spawn = self.run_launcher(log_path, process)
            arguments = spawn.call_args.args[0]
            self.assertEqual(arguments, [
                "emulator", "-avd", "OneMapU25F05", "-port", "5580",
                "-no-window", "-no-audio", "-no-snapshot", "-no-boot-anim",
                "-memory", "2048", "-gpu", "auto", "-show-kernel",
            ])
            self.assertEqual(arguments.count("-show-kernel"), 1)
            options = spawn.call_args.kwargs
            self.assertEqual(options["stdin"], subprocess.DEVNULL)
            self.assertEqual(options["stderr"], subprocess.STDOUT)
            self.assertTrue(options["start_new_session"])
            self.assertEqual(options["stdout"].name, str(log_path))
            self.assertEqual(options["stdout"].mode, "xb")
            self.assertTrue(options["stdout"].closed)
            process.wait.assert_called_once_with(timeout=1)
            self.assertEqual(json.loads(output), {
                "pid": 501, "pgid": 501, "log": str(log_path),
            })
            self.assertEqual(log_path.read_bytes(), b"")

    def test_existing_log_is_not_overwritten_or_spawned(self):
        with tempfile.TemporaryDirectory() as directory:
            log_path = Path(directory) / "emulator.log"
            log_path.write_bytes(b"previous")
            with patch("sys.argv", [str(LAUNCHER), str(log_path)]), \
                    patch("subprocess.Popen") as spawn:
                with self.assertRaises(FileExistsError):
                    runpy.run_path(str(LAUNCHER), run_name="__main__")
                spawn.assert_not_called()
            self.assertEqual(log_path.read_bytes(), b"previous")

    def test_early_exit_is_failure_even_for_zero(self):
        for exit_code in (0, 7):
            with self.subTest(exit_code=exit_code), \
                    tempfile.TemporaryDirectory() as directory:
                process = Mock(pid=501)
                process.wait.return_value = exit_code
                with self.assertRaises(SystemExit) as failure:
                    self.run_launcher(Path(directory) / "emulator.log", process)
                self.assertEqual(failure.exception.code, exit_code or 1)


if __name__ == "__main__":
    unittest.main()
