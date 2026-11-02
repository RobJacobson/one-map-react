"""Prepare the one pinned API36 image and private AVD after execution approval."""
import hashlib
import json
from pathlib import Path, PurePosixPath
import shutil
import signal
import stat
import sys
import tempfile
import time
import urllib.request
import zipfile

ROOT = Path("/Users/rob/code/mapbox-code/one-map-f05-android-recovery")
URL = "https://dl.google.com/android/repository/sys-img/google_apis/arm64-v8a-36_r07.zip"
ARCHIVE_BYTES = 1872691175
ARCHIVE_SHA1 = "5a99183b6d924da606260e45fd41a3eb8eca6eb7"
UNPACKED_BYTES = 4575096761
ENTRY_COUNT = 28
IMAGE_FILES = frozenset(
    ('NOTICE.txt',
     'VerifiedBootParams.textproto',
     'advancedFeatures.ini',
     'build.prop',
     'data/empty_data_disk',
     'data/local.prop',
     'data/misc/GoldfishSkinConfig',
     'data/misc/emulator/config/radioconfig.xml',
     'data/misc/emulator/version.txt',
     'data/misc/modem_simulator/etc/modem_simulator/files/numeric_operator.xml',
     'data/misc/modem_simulator/iccprofile_for_carrierapitests.xml',
     'data/misc/modem_simulator/iccprofile_for_sim0.xml',
     'data/misc/modem_simulator/iccprofile_for_sim_tel_alaska.xml',
     'data/misc/pixel_9_pro_fold/devicestate/device_state_configuration.xml',
     'data/misc/pixel_9_pro_fold/display_settings.xml',
     'data/misc/pixel_9_pro_fold/displayconfig/display_layout_configuration.xml',
     'data/misc/pixel_9_pro_fold/extra_feature.xml',
     'data/misc/pixel_fold/devicestate/device_state_configuration.xml',
     'data/misc/pixel_fold/display_settings.xml',
     'data/misc/pixel_fold/displayconfig/display_layout_configuration.xml',
     'data/misc/pixel_fold/extra_feature.xml',
     'encryptionkey.img',
     'kernel-ranchu',
     'kernel_cmdline.txt',
     'ramdisk.img',
     'source.properties',
     'system.img',
     'vendor.img')
)
SOURCE_SHA256 = "f53d5fbbb89420d911b9e5ed9243aff60caad24132a76e649efc8dfd96295731"
BUILD_SHA256 = "999e509f85b5edd5522e867842f27a10f4cb077082bbd70d8eea27fc073463af"
KERNEL_SHA256 = "9b300ef4ee5ea5ee21c0a1924991e92a740d93127b19edead1a9365e83df95ca"
AVD_NAME = "OneMapF05MapboxApi36"
BATCH_FREE_BYTES = 12 * 1024 ** 3
DOWNLOAD_SECONDS = 1200


def prepare(output):
    """Atomically install only an owned verified image, then create its private AVD."""
    assert output.parent == ROOT and output.is_dir() and not output.is_symlink(), \
        "Use the owned attempt directory."
    image = ROOT / "android-api36-image"
    assert not image.is_symlink(), "Image destination must not be a symlink."
    avd = ROOT / "android-avd" / (AVD_NAME + ".avd")
    ini = avd.with_suffix(".ini")
    assert not avd.exists() and not ini.exists(), "Private API36 AVD already exists."
    marker = image / ".one-map-image.json"
    if image.exists():
        receipt = json.loads(marker.read_text())
        assert receipt["archiveSha1"] == ARCHIVE_SHA1 and receipt["unpackedBytes"] == UNPACKED_BYTES \
            and receipt["archiveBytes"] == ARCHIVE_BYTES, \
            "Image provenance differs."
        assert set(receipt["sha256"]) == IMAGE_FILES, "Image manifest is incomplete."
        for name, expected in receipt["sha256"].items():
            assert all(not parent.is_symlink() for parent in (image / name).parents
                       if parent.is_relative_to(image)), "Image contains a symlink directory."
            assert (image / name).is_file() and not (image / name).is_symlink(), "Invalid owned image file."
            assert digest(image / name, "sha256") == expected, "Owned image changed: " + name
        assert sum((image / name).stat().st_size for name in IMAGE_FILES) == UNPACKED_BYTES
    else:
        assert shutil.disk_usage(ROOT).free >= UNPACKED_BYTES + BATCH_FREE_BYTES, \
            "Hold before download: image plus complete-unit reserve required."
        staging = Path(tempfile.mkdtemp(prefix=".one-map-api36-", dir=ROOT))
        try:
            archive = staging / "image.zip"
            download(archive)
            extracted = staging / "extracted"
            extracted.mkdir()
            hashes = extract(archive, extracted)
            source = extracted / "arm64-v8a"
            validate_image(source)
            receipt = {"archiveSha1": ARCHIVE_SHA1, "archiveBytes": ARCHIVE_BYTES,
                       "unpackedBytes": UNPACKED_BYTES, "sha256": hashes}
            (source / ".one-map-image.json").write_text(json.dumps(receipt, indent=2) + "\n")
            assert not image.exists(), "Image appeared during setup; preserve it."
            source.rename(image)
        except BaseException as error:
            try:
                shutil.rmtree(staging)
            except OSError as cleanup_error:
                message = f"Owned staging cleanup failed: {staging}: {cleanup_error}"
                error.add_note(message)
                print(message, file=sys.stderr)
            raise
        else:
            shutil.rmtree(staging)

    validate_image(image)
    assert shutil.disk_usage(ROOT).free >= BATCH_FREE_BYTES, \
        "Hold before AVD creation: complete-unit reserve required."
    config = {
        "AvdId": AVD_NAME, "avd.ini.displayname": AVD_NAME,
        "image.sysdir.1": str(image) + "/", "target": "android-36",
        "abi.type": "arm64-v8a", "hw.cpu.arch": "arm64", "hw.cpu.ncore": "4",
        "tag.id": "google_apis", "tag.display": "Google APIs", "PlayStore.enabled": "false",
        "hw.lcd.width": "1080", "hw.lcd.height": "2400", "hw.lcd.density": "420",
        "hw.ramSize": "3072", "disk.dataPartition.size": "2G", "sdcard.size": "128M",
        "hw.gpu.enabled": "yes", "hw.gpu.mode": "auto", "hw.keyboard": "yes",
        "hw.initialOrientation": "portrait", "showDeviceFrame": "no",
        "fastboot.forceFastBoot": "no", "fastboot.forceColdBoot": "yes",
        "fastboot.forceChosenSnapshotBoot": "no",
    }
    result_path = output / "api36-image-setup.json"
    owned = []
    try:
        assert not avd.exists() and not ini.exists(), "Private AVD appeared during image setup."
        avd.mkdir(parents=True)
        owned.append(avd)
        (avd / "config.ini").write_text("".join(f"{key}={value}\n" for key, value in config.items()))
        with ini.open("x") as metadata:
            owned.append(ini)
            metadata.write(f"avd.ini.encoding=UTF-8\npath={avd}\ntarget=android-36\n")
        with result_path.open("x") as result:
            owned.append(result_path)
            json.dump({"image": str(image), "avd": str(avd), **receipt}, result, indent=2)
            result.write("\n")
    except BaseException as error:
        for path in reversed(owned):
            try:
                if path == avd:
                    shutil.rmtree(path)
                else:
                    path.unlink()
            except OSError as cleanup_error:
                message = f"Owned setup cleanup failed: {path}: {cleanup_error}"
                error.add_note(message)
                print(message, file=sys.stderr)
        raise


def download(destination):
    """Bound download bytes, read deadlines and total duration before accepting the official digest."""
    deadline = time.monotonic() + DOWNLOAD_SECONDS
    size = 0
    with urllib.request.urlopen(URL, timeout=30) as response, destination.open("xb") as target:
        assert response.status == 200, "Unexpected image HTTP status."
        while True:
            assert time.monotonic() < deadline, "Image download deadline exceeded."
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            assert size <= ARCHIVE_BYTES, "Image exceeds pinned archive size."
            target.write(chunk)
    assert size == ARCHIVE_BYTES and digest(destination, "sha1") == ARCHIVE_SHA1, \
        "Image archive size or SHA1 differs."


def extract(archive, destination):
    """Reject unsafe names/types and expansion before writing any archive member."""
    with zipfile.ZipFile(archive) as package:
        entries = package.infolist()
        assert len(entries) == ENTRY_COUNT, "Image entry count differs."
        names = set()
        for entry in entries:
            parts = entry.filename.rstrip("/").split("/")
            assert "\\" not in entry.filename and parts[0] == "arm64-v8a", "Unexpected image root."
            assert all(part not in ("", ".", "..") for part in parts), "Unsafe image path."
            normalized = str(PurePosixPath(*parts)).casefold()
            assert normalized not in names, "Duplicate image path."
            names.add(normalized)
            mode = entry.external_attr >> 16
            assert not entry.is_dir() and stat.S_IFMT(mode) in (0, stat.S_IFREG), "Special image entry."
            assert not entry.flag_bits & 1, "Encrypted image entry."
        assert {str(PurePosixPath(entry.filename).relative_to("arm64-v8a")) for entry in entries} == IMAGE_FILES, "Image member list differs."
        assert sum(entry.file_size for entry in entries) == UNPACKED_BYTES, "Image expansion differs."
        hashes = {}
        for entry in entries:
            target = destination / entry.filename
            target.parent.mkdir(parents=True, exist_ok=True)
            count = 0
            sha256 = hashlib.sha256()
            with package.open(entry) as source, target.open("xb") as output:
                while chunk := source.read(1024 * 1024):
                    count += len(chunk)
                    assert count <= entry.file_size, "Image member exceeds declared size."
                    sha256.update(chunk)
                    output.write(chunk)
            assert count == entry.file_size, "Truncated image member."
            hashes[str(PurePosixPath(entry.filename).relative_to("arm64-v8a"))] = sha256.hexdigest()
        return hashes


def validate_image(image):
    assert digest(image / "source.properties", "sha256") == SOURCE_SHA256, "Image source metadata differs."
    assert digest(image / "build.prop", "sha256") == BUILD_SHA256, "Image build metadata differs."
    assert digest(image / "kernel-ranchu", "sha256") == KERNEL_SHA256, "Pinned 4K image kernel differs."
    properties = dict(tuple(part.strip() for part in line.split("=", 1))
                      for line in (image / "source.properties").read_text().splitlines() if "=" in line)
    assert properties.get("AndroidVersion.ApiLevel", "").strip() == "36"
    assert properties.get("SystemImage.Abi", "").strip() == "arm64-v8a"
    assert properties.get("SystemImage.TagId", "").strip() == "google_apis"
    assert properties.get("Pkg.Revision", "").strip() == "7"
    for name in ("kernel-ranchu", "ramdisk.img", "system.img", "vendor.img"):
        assert (image / name).is_file(), "Required image member missing: " + name


def digest(path, algorithm):
    value = hashlib.new(algorithm)
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            value.update(chunk)
    return value.hexdigest()


def interrupted(signum, frame):
    raise SystemExit(128 + signum)


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    prepare(Path(sys.argv[1]))
