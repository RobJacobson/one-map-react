"""Verify only the reviewed pre-v10 schema migration without losing stored data."""

import hashlib
import json
import re
import sqlite3
import sys
from pathlib import Path


TABLES = {"regions", "resources", "tiles", "region_resources", "region_tiles", "sqlite_sequence"}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def quoted(identifier):
    return '"' + identifier.replace('"', '""') + '"'


def inspect(connection):
    connection.execute("BEGIN")
    assert connection.execute("PRAGMA integrity_check").fetchall() == [("ok",)], "Invalid database integrity."
    assert connection.execute("PRAGMA foreign_key_check").fetchall() == [], "Invalid region/resource relations."
    tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    assert tables == TABLES, "Unexpected database tables."
    return connection.execute("PRAGMA user_version").fetchone()[0]


def verify(original, destination):
    source = sqlite3.connect(original.resolve().as_uri() + "?mode=ro&immutable=1", uri=True)
    target = sqlite3.connect(destination.resolve().as_uri() + "?mode=ro", uri=True)
    try:
        source_version = inspect(source)
        target_version = inspect(target)
        assert source_version == 5 and target_version in (5, 6), "Unexpected schema version."
        objects = "SELECT type,name,tbl_name,sql FROM sqlite_master WHERE type!='table' ORDER BY type,name"
        assert source.execute(objects).fetchall() == target.execute(objects).fetchall(), "Unexpected indexes, views or triggers."
        rows = {}
        blobs = {}
        for table in sorted(TABLES):
            source_columns = source.execute(f"PRAGMA table_xinfo({quoted(table)})").fetchall()
            target_columns = target.execute(f"PRAGMA table_xinfo({quoted(table)})").fetchall()
            added = target_version == 6 and table in ("resources", "tiles")
            expected = source_columns + ([(len(source_columns), "must_revalidate", "INTEGER", 1, "0", 0, 0)] if added else [])
            assert target_columns == expected, f"Unexpected column schema: {table}."
            table_sql = "SELECT sql FROM sqlite_master WHERE type='table' AND name=?"
            old_sql = source.execute(table_sql, (table,)).fetchone()[0]
            new_sql = target.execute(table_sql, (table,)).fetchone()[0]
            if added:
                new_sql, removed = re.subn(r",\s*must_revalidate\s+INTEGER\s+NOT\s+NULL\s+DEFAULT\s+0(?=\s*[,\)])", "", new_sql)
                assert removed == 1, f"Unknown added column definition: {table}."
            assert re.sub(r"\s+", "", old_sql) == re.sub(r"\s+", "", new_sql), f"Changed table constraints: {table}."
            foreign_keys = f"PRAGMA foreign_key_list({quoted(table)})"
            assert source.execute(foreign_keys).fetchall() == target.execute(foreign_keys).fetchall(), f"Changed foreign keys: {table}."
            columns = ",".join(quoted(column[1]) for column in source_columns)
            query = f"SELECT {columns} FROM {quoted(table)} ORDER BY {columns}"
            before = source.execute(query).fetchall()
            after = target.execute(query).fetchall()
            assert after == before, f"Changed original rows or payloads: {table}."
            if added:
                assert target.execute(f"SELECT count(*) FROM {quoted(table)} WHERE must_revalidate IS NOT 0").fetchone()[0] == 0, f"Nonzero must_revalidate: {table}."
            rows[table] = len(before)
            blobs[table] = [
                {source_columns[index][1]: hashlib.sha256(value).hexdigest()
                 for index, value in enumerate(row) if isinstance(value, bytes)}
                for row in before
            ]
        return {
            "originalSha256": digest(original),
            "destinationSha256": digest(destination),
            "destinationWalSha256": digest(Path(str(destination) + "-wal")) if Path(str(destination) + "-wal").exists() else None,
            "originalSchemaVersion": source_version,
            "destinationSchemaVersion": target_version,
            "schemaChange": "resources/tiles must_revalidate INTEGER NOT NULL DEFAULT 0" if target_version == 6 else "none",
            "originalRowsPreserved": True,
            "rawFileBytesIdentical": digest(original) == digest(destination),
            "allowedSchemaUpgrade": target_version == 6,
            "rowCounts": rows,
            "blobSha256": blobs,
        }
    finally:
        source.close()
        target.close()


if __name__ == "__main__":
    assert len(sys.argv) == 3, "Pass original fixture and quiesced destination database paths."
    print(json.dumps(verify(Path(sys.argv[1]), Path(sys.argv[2]))))
