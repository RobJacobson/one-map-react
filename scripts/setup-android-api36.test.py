"""Exercise image download/extraction and ownership against tiny temporary fixtures only."""
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import stat
import tempfile
import unittest
from unittest.mock import patch
import zipfile

SPEC = importlib.util.spec_from_file_location("api36", Path(__file__).with_name("setup-android-api36.py"))
setup = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(setup)


class ImageTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.output = self.root / "attempt"
        self.output.mkdir()
        self.files = {
            "source.properties": b"AndroidVersion.ApiLevel=36\nSystemImage.Abi=arm64-v8a\nSystemImage.TagId=google_apis\nPkg.Revision=7\n",
            "build.prop": b"ro.build.version.sdk=36\n",
            "kernel-ranchu": b"kernel", "ramdisk.img": b"ramdisk",
            "system.img": b"system", "vendor.img": b"vendor",
        }
        self.archive = self.zip_bytes(self.files)
        self.values = dict(ROOT=self.root, ARCHIVE_BYTES=len(self.archive),
                           ARCHIVE_SHA1=hashlib.sha1(self.archive).hexdigest(),
                           UNPACKED_BYTES=sum(map(len, self.files.values())),
                           ENTRY_COUNT=len(self.files), IMAGE_FILES=frozenset(self.files),
                           SOURCE_SHA256=hashlib.sha256(self.files["source.properties"]).hexdigest(),
                           BUILD_SHA256=hashlib.sha256(self.files["build.prop"]).hexdigest(),
                           KERNEL_SHA256=hashlib.sha256(self.files["kernel-ranchu"]).hexdigest())
        self.addCleanup(patch.stopall)
        patch.multiple(setup, **self.values).start()
        patch.object(setup.shutil, "disk_usage", return_value=type("Disk", (), {"free": 100 * 1024**3})()).start()

    def zip_bytes(self, files):
        output = io.BytesIO()
        # Force standard ZIP64 metadata even for these tiny fixtures.
        with patch.object(zipfile, "ZIP64_LIMIT", 0), zipfile.ZipFile(output, "w", allowZip64=True) as package:
            for name, content in files.items():
                package.writestr("arm64-v8a/" + name, content)
        return output.getvalue()

    def transport(self, content=None):
        response = io.BytesIO(self.archive if content is None else content)
        response.status = 200
        return response

    def test_verified_zip64_atomic_image_and_private_avd_then_reuse(self):
        with patch.object(setup.urllib.request, "urlopen", return_value=self.transport()) as download:
            setup.prepare(self.output)
            download.assert_called_once_with(setup.URL, timeout=30)
        image = self.root / "android-api36-image"
        self.assertEqual((image / "system.img").read_bytes(), b"system")
        config = (self.root / "android-avd" / (setup.AVD_NAME + ".avd/config.ini")).read_text()
        for expected in ("hw.ramSize=3072", "hw.lcd.density=420", "disk.dataPartition.size=2G",
                         "sdcard.size=128M", "hw.gpu.mode=auto", "target=android-36"):
            self.assertIn(expected, config)
        self.assertNotIn("Medium_Phone", config)
        setup.shutil.rmtree(self.root / "android-avd")
        (self.output / "api36-image-setup.json").unlink()
        with patch.object(setup.urllib.request, "urlopen") as download:
            setup.prepare(self.output)
            download.assert_not_called()
        self.assertFalse(list(self.root.glob(".one-map-api36-*")))

    def test_bad_digest_or_size_never_installs_or_creates_avd(self):
        for content in (b"x" * len(self.archive), self.archive[:-1], self.archive + b"x"):
            with self.subTest(size=len(content)), patch.object(setup.urllib.request, "urlopen", return_value=self.transport(content)):
                with self.assertRaises(AssertionError):
                    setup.prepare(self.output)
                self.assertFalse((self.root / "android-api36-image").exists())
                self.assertFalse((self.root / "android-avd").exists())
                self.assertFalse(list(self.root.glob(".one-map-api36-*")))

    def test_capacity_gate_before_transport(self):
        with patch.object(setup.shutil, "disk_usage", return_value=type("Disk", (), {"free": 1})()), \
                patch.object(setup.urllib.request, "urlopen") as download:
            with self.assertRaises(AssertionError):
                setup.prepare(self.output)
            download.assert_not_called()

    def test_download_deadline_and_transport_failure_cleanup(self):
        for failure in (TimeoutError("network deadline"), OSError("network failed")):
            with patch.object(setup.urllib.request, "urlopen", side_effect=failure):
                with self.assertRaises(type(failure)):
                    setup.prepare(self.output)
                self.assertFalse(list(self.root.glob(".one-map-api36-*")))
        with patch.object(setup.urllib.request, "urlopen", return_value=self.transport()), \
                patch.object(setup.time, "monotonic", side_effect=[0, setup.DOWNLOAD_SECONDS + 1]):
            with self.assertRaises(AssertionError):
                setup.prepare(self.output)

    def test_unsafe_names_duplicates_symlinks_and_expansion_reject(self):
        for names, symlink in [(["../outside"], False), (["/absolute"], False),
                               (["bad\\name"], False), (["same", "same"], False),
                               (["name", "NAME"], False), (["link"], True)]:
            raw = io.BytesIO()
            with zipfile.ZipFile(raw, "w") as package:
                for name in names:
                    entry = zipfile.ZipInfo("arm64-v8a/" + name)
                    if symlink:
                        entry.external_attr = (stat.S_IFLNK | 0o777) << 16
                    package.writestr(entry, b"x")
            path = self.root / "unsafe.zip"
            path.write_bytes(raw.getvalue())
            destination = self.root / "unpack"
            destination.mkdir(exist_ok=True)
            with patch.object(setup, "ENTRY_COUNT", len(names)):
                with self.assertRaises(AssertionError):
                    setup.extract(path, destination)
            self.assertFalse(list(destination.iterdir()))
        path.write_bytes(self.archive)
        with patch.object(setup, "UNPACKED_BYTES", 1):
            with self.assertRaises(AssertionError):
                setup.extract(path, destination)

    def test_foreign_destination_and_changed_owned_image_are_preserved(self):
        image = self.root / "android-api36-image"
        image.mkdir()
        (image / "foreign").write_text("preserve")
        with self.assertRaises(FileNotFoundError):
            setup.prepare(self.output)
        self.assertEqual((image / "foreign").read_text(), "preserve")
        setup.shutil.rmtree(image)
        with patch.object(setup.urllib.request, "urlopen", return_value=self.transport()):
            setup.prepare(self.output)
        setup.shutil.rmtree(self.root / "android-avd")
        (image / "system.img").write_bytes(b"changed")
        with self.assertRaises(AssertionError):
            setup.prepare(self.output)
        self.assertEqual((image / "system.img").read_bytes(), b"changed")

    def test_empty_missing_unsafe_and_symlink_reuse_manifests_reject(self):
        with patch.object(setup.urllib.request, "urlopen", return_value=self.transport()):
            setup.prepare(self.output)
        setup.shutil.rmtree(self.root / "android-avd")
        image = self.root / "android-api36-image"
        marker = image / ".one-map-image.json"
        original = json.loads(marker.read_text())
        for hashes in ({}, {"../foreign": "hash"}, {"system.img": original["sha256"]["system.img"]}):
            value = {**original, "sha256": hashes}
            marker.write_text(json.dumps(value))
            with self.assertRaises(AssertionError):
                setup.prepare(self.output)
        marker.write_text(json.dumps(original))
        (image / "system.img").unlink()
        (self.root / "foreign").write_bytes(b"system")
        (image / "system.img").symlink_to(self.root / "foreign")
        with self.assertRaises(AssertionError):
            setup.prepare(self.output)
        self.assertEqual((self.root / "foreign").read_bytes(), b"system")
        (image / "system.img").unlink()
        (image / "system.img").write_bytes(b"system")
        outside = self.root / "outside"
        outside.mkdir()
        (outside / "file").write_bytes(b"foreign")
        (image / "data").symlink_to(outside, target_is_directory=True)
        original["sha256"]["data/file"] = hashlib.sha256(b"foreign").hexdigest()
        marker.write_text(json.dumps(original))
        with patch.object(setup, "IMAGE_FILES", setup.IMAGE_FILES | {"data/file"}):
            with self.assertRaisesRegex(AssertionError, "symlink directory"):
                setup.prepare(self.output)

    def test_foreign_ini_appearing_during_download_is_preserved(self):
        response = self.transport()
        read = response.read
        ini = self.root / "android-avd" / (setup.AVD_NAME + ".ini")
        def race(size):
            ini.parent.mkdir(exist_ok=True)
            ini.write_text("foreign")
            return read(size)
        response.read = race
        with patch.object(setup.urllib.request, "urlopen", return_value=response):
            with self.assertRaises(AssertionError):
                setup.prepare(self.output)
        self.assertEqual(ini.read_text(), "foreign")
        self.assertFalse(ini.with_suffix(".avd").exists())

    def test_config_and_receipt_failure_release_only_acquired_paths(self):
        write_text = Path.write_text
        def config_failure(path, *args, **kwargs):
            if path.name == "config.ini":
                raise OSError("config primary")
            return write_text(path, *args, **kwargs)
        with patch.object(setup.urllib.request, "urlopen", return_value=self.transport()), \
                patch.object(Path, "write_text", config_failure):
            with self.assertRaisesRegex(OSError, "config primary"):
                setup.prepare(self.output)
        self.assertFalse(list((self.root / "android-avd").iterdir()))
        with patch.object(setup.json, "dump", side_effect=OSError("receipt primary")):
            with self.assertRaisesRegex(OSError, "receipt primary"):
                setup.prepare(self.output)
        self.assertFalse(list((self.root / "android-avd").iterdir()))
        self.assertFalse((self.output / "api36-image-setup.json").exists())

    def test_secondary_staging_cleanup_preserves_primary_failure(self):
        with patch.object(setup.urllib.request, "urlopen", side_effect=OSError("network primary")), \
                patch.object(setup.shutil, "rmtree", side_effect=OSError("cleanup secondary")):
            with self.assertRaisesRegex(OSError, "network primary") as raised:
                setup.prepare(self.output)
            self.assertIn("cleanup secondary", "\n".join(raised.exception.__notes__))
            self.assertIn(".one-map-api36-", "\n".join(raised.exception.__notes__))


if __name__ == "__main__":
    unittest.main()
