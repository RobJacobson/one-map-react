"""Build bounded populated databases from verified upstream pre-v10 schemas."""

import argparse
import hashlib
import json
import plistlib
import shutil
import sqlite3
import struct
import zlib
from pathlib import Path


UPSTREAM = {
    "revision": "f2778251c97ba3403582b9c04290c50f927fd338",
    "offline_sideload.db": "fb9bcac791da7c171d08b3fb43401a4afd9e7565b26ac2ea072b5d86f049318a",
    "v5.db": "b93b5649847b7cf9b234e950ae5ddbef90ebc341c40883b48678d3a50f6e7da2",
}


def chunk(kind, data):
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))


def yellow_tile():
    row = b"\0" + bytes([255, 255, 0, 255]) * 256
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", 256, 256, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(row * 256))
        + chunk(b"IEND", b"")
    )


def archived_string(value):
    return plistlib.dumps(
        {"$archiver": "NSKeyedArchiver", "$version": 100000,
         "$top": {"root": plistlib.UID(1)}, "$objects": ["$null", value]},
        fmt=plistlib.FMT_BINARY,
    )


def build(seed, output, engine, platform, purpose):
    name = "v5.db" if purpose == "migration" else "offline_sideload.db"
    source = seed / name
    assert hashlib.sha256(source.read_bytes()).hexdigest() == UPSTREAM[name]
    target = output / f"{engine}-{platform}-{purpose}.db"
    shutil.copyfile(source, target)
    connection = sqlite3.connect(target)
    if engine == "mapbox" and purpose == "import":
        # SDK 11 merges schema 9, whose region columns are absent from schema 6.
        connection.execute("ALTER TABLE regions ADD COLUMN style TEXT")
        connection.execute("ALTER TABLE regions ADD COLUMN required_resource_count INTEGER")
        connection.execute("PRAGMA user_version = 9")
    for table in ["region_resources", "region_tiles", "regions", "resources", "tiles"]:
        connection.execute(f"DELETE FROM {table}")
    identity = f"tf08-{engine}-{platform}-{purpose}"
    style_url = f"http://127.0.0.1:8798/storage-{purpose}.json"
    tile_url = f"http://127.0.0.1:8798/storage-{purpose}/{{z}}/{{x}}/{{y}}.png"
    style = json.dumps({
        "version": 8, "sources": {"fixture": {"type": "raster", "tiles": [tile_url],
        "tileSize": 256, "minzoom": 0, "maxzoom": 0}},
        "layers": [{"id": "fixture", "type": "raster", "source": "fixture"}],
    }, separators=(",", ":")).encode()
    metadata = {"name": identity, "id": identity, "test": "tf08-populated-storage",
                "styleURL": style_url, "purpose": purpose}
    context = metadata if engine == "mapbox" else {
        "migrationVersion": 1, "id": identity, "metadata": json.dumps(metadata)}
    description = json.dumps(context)
    description = archived_string(description) if platform == "ios" else description.encode()
    # The SDK decoder requires JSON doubles, including integral-valued coordinates.
    definition = json.dumps({"style_url": style_url, "bounds": [-10.0, -10.0, 10.0, 10.0],
                             "min_zoom": 0.0, "max_zoom": 0.0, "pixel_ratio": 2.0 if platform == "ios" else 1.0})
    decoded = json.loads(definition)
    assert all(type(value) is float for value in [*decoded["bounds"], decoded["min_zoom"], decoded["max_zoom"], decoded["pixel_ratio"]])
    connection.execute("INSERT INTO regions(id,definition,description) VALUES(1,?,?)",
                       (definition, description))
    connection.execute("INSERT INTO resources(id,url,kind,expires,data,compressed,accessed) VALUES(1,?,1,4102444800,?,0,1792022400)",
                       (style_url, style))
    connection.execute("INSERT INTO region_resources VALUES(1,1)")
    tile = yellow_tile()
    for ratio in [1, 2]:
        connection.execute("INSERT INTO tiles(id,url_template,pixel_ratio,z,x,y,expires,data,compressed,accessed) VALUES(?,?,?,0,0,0,4102444800,?,0,1792022400)",
                           (ratio, tile_url, ratio, tile))
        connection.execute("INSERT INTO region_tiles VALUES(1,?)", (ratio,))
    connection.commit()
    assert connection.execute("PRAGMA integrity_check").fetchone() == ("ok",)
    assert connection.execute("PRAGMA foreign_key_check").fetchall() == []
    assert connection.execute("SELECT count(*) FROM regions").fetchone() == (1,)
    assert connection.execute("SELECT sum(length(data)) FROM tiles").fetchone()[0] > 0
    version = connection.execute("PRAGMA user_version").fetchone()[0]
    assert version == (9 if engine == "mapbox" and purpose == "import" else 5 if purpose == "migration" else 6)
    if engine == "mapbox" and purpose == "import":
        # Legacy regions keep the SDK-added columns null after native migration.
        assert connection.execute("SELECT style,required_resource_count FROM regions").fetchone() == (None, None)
    connection.close()
    return {"file": str(target), "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
            "schemaVersion": version, "identity": identity, "styleURL": style_url,
            "regionCount": 1, "resourceCount": 1, "tileCount": 2, "tileBytes": len(tile) * 2}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    fixtures = [build(args.seed, args.output, engine, platform, purpose)
                for engine in ["mapbox", "maplibre"] for platform in ["ios", "android"]
                for purpose in (["import", "migration"] if engine == "mapbox" else ["import"])]
    report = {"source": UPSTREAM, "scope": "Synthetic populated fixtures using pinned upstream schemas; not a user database or an actual older-app download.",
              "fixtures": fixtures}
    (args.output / "manifest.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))
