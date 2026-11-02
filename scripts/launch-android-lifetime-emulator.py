import json
import subprocess
import sys
from pathlib import Path

log_path = Path(sys.argv[1])
api36 = len(sys.argv) == 3 and sys.argv[2] == "--api36"
assert len(sys.argv) == 2 or api36, "Unknown fixed emulator mode."
arguments = [
    "emulator", "-avd", "OneMapF05MapboxApi36" if api36 else "OneMapU25F05", "-port", "5580", "-no-window",
    "-no-audio", "-no-snapshot", "-no-boot-anim", "-memory", "3072" if api36 else "2048",
    "-gpu", "auto", "-show-kernel",
]
if api36:
    arguments.extend(["-sysdir", "/Users/rob/code/mapbox-code/one-map-f05-android-recovery/android-api36-image"])
with log_path.open("xb") as output:
    process = subprocess.Popen(
        arguments, stdin=subprocess.DEVNULL, stdout=output,
        stderr=subprocess.STDOUT, start_new_session=True,
    )
    try:
        exit_code = process.wait(timeout=1)
    except subprocess.TimeoutExpired:
        print(json.dumps({
            "pid": process.pid, "pgid": process.pid, "log": str(log_path),
        }))
    else:
        raise SystemExit(exit_code or 1)
