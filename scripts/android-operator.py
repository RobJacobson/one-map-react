"""Run one checked operation against the assigned Android acceptance device."""

import subprocess
import sys
import tempfile


ADB = "/Users/rob/Library/Android/sdk/platform-tools/adb"
SERIAL = "emulator-5580"
TIMEOUT_SECONDS = 30
OUTPUT_BYTES = 131072


def main(arguments):
    if not arguments:
        print("Use android-operator.py ADB_ARGUMENT...", file=sys.stderr)
        return 1

    command = [ADB, "-s", SERIAL, *arguments]
    print("START", command, flush=True)
    # Files keep capture memory bounded; screenshots use screencap then pull.
    with tempfile.TemporaryFile() as stdout, tempfile.TemporaryFile() as stderr:
        status = 0
        try:
            subprocess.run(
                command,
                timeout=TIMEOUT_SECONDS,
                check=True,
                shell=False,
                stdout=stdout,
                stderr=stderr,
            )
        except (subprocess.TimeoutExpired, subprocess.CalledProcessError, OSError) as error:
            print("FAILED", type(error).__name__, str(error), flush=True)
            status = 1
        else:
            print("COMPLETE 0", flush=True)

        for captured in (stdout, stderr):
            captured.seek(0, 2)
            captured.seek(max(0, captured.tell() - OUTPUT_BYTES))
            output = captured.read().decode("utf-8", errors="replace")
            if output:
                print(output, flush=True)
        return status


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
