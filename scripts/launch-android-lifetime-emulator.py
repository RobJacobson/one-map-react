import json
import subprocess
import sys
from pathlib import Path

log_path = Path(sys.argv[1])
arguments = [
    "emulator", "-avd", "OneMapU25F05", "-port", "5580", "-no-window",
    "-no-audio", "-no-snapshot", "-no-boot-anim", "-memory", "2048",
    "-gpu", "auto", "-show-kernel",
]
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
