#!/usr/bin/env python3
"""Pack a recoverable runtime source zip for the 08:00 acceptance pass.

Run only after the parent has saved real page-download SVGs and review stills
for the 07:00 export closeout. This script does not certify the package.

It refuses the 03:04 filename SunCraft-runtime-source-20261126.zip.
"""
from __future__ import annotations
import argparse, hashlib, sys
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED, ZIP_STORED

ROOT = Path(__file__).resolve().parents[2]
PARENT = ROOT.parent
FORBIDDEN = "SunCraft-runtime-source-20261126.zip"
DEFAULT_NAME = "SunCraft-runtime-source-20261126-closeout.zip"
EXCLUDE_DIR_NAMES = {
    "node_modules", "dist", "build", "out", "coverage", "target",
    "__pycache__", ".cache", ".git", ".pytest_cache", ".vite", ".turbo",
    ".next", "browser-cdp", "screenshots",
}
# Hidden tool caches only; keep .gitignore and similar project files.
EXCLUDE_DIR_PREFIX_DOT_TOOLS = True

def skip(rel: Path) -> bool:
    parts = rel.parts
    for p in parts:
        if p in EXCLUDE_DIR_NAMES:
            return True
        if p.startswith(".") and p not in {".gitignore"} and p in {".cache", ".vite", ".turbo", ".next", ".pytest_cache", ".git"}:
            return True
    if rel.suffix in {".pyc", ".pyo"}:
        return True
    return False

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--output", default=str(PARENT / DEFAULT_NAME), help="Destination zip path (parent dir by default)")
    args = ap.parse_args()
    dest = Path(args.output).resolve()
    if dest.name == FORBIDDEN:
        print(f"Refusing to write {FORBIDDEN} (the 03:04 package name).", file=sys.stderr)
        return 2
    if dest.exists():
        print(f"Refusing to overwrite existing {dest}", file=sys.stderr)
        return 2
    dest.parent.mkdir(parents=True, exist_ok=True)
    files = sorted(p for p in ROOT.rglob("*") if p.is_file() and not skip(p.relative_to(ROOT)))
    # Store already-compressed media uncompressed? keep DEFLATED for all; fine.
    with ZipFile(dest, "w", ZIP_DEFLATED) as z:
        for p in files:
            z.write(p, str(p.relative_to(ROOT)))
    digest = hashlib.sha256(dest.read_bytes()).hexdigest()
    sha_path = dest.with_name(dest.name + ".sha256.txt")
    sha_path.write_text(digest + "  " + dest.name + "\n")
    print(f"Wrote {dest} ({len(files)} files, {dest.stat().st_size} bytes)")
    print(f"SHA-256 {digest}")
    print(f"Wrote {sha_path}")
    print("This is not an accepted 08:00 package until the parent has real downloads and stills.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
