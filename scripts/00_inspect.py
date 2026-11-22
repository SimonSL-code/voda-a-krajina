"""
00_inspect.py – prehľad stiahnutých dát v priečinku data_raw/.

Pre každý vektorový súbor vypíše vrstvy, súradnicový systém, počet prvkov,
stĺpce a prvé riadky atribútov. Pre každý raster vypíše CRS, rozlíšenie,
rozsah, typ a nodata. Výsledok uloží do data_work/inspect_report.txt.

Spustenie (v Anaconda Prompt, v koreňovom priečinku projektu):
    conda activate vodakrajina
    python scripts/00_inspect.py
"""

from __future__ import annotations

import sys
import traceback
from pathlib import Path

import pandas as pd
import pyogrio
import rasterio

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data_raw"
WORK = ROOT / "data_work"
REPORT = WORK / "inspect_report.txt"

VECTOR_EXT = {".gpkg", ".shp", ".gml", ".geojson", ".json", ".fgb", ".kml"}
RASTER_EXT = {".tif", ".tiff", ".vrt", ".img", ".asc"}
MAX_UNIQUE = 60  # pri textových stĺpcoch vypíše unikátne hodnoty, ak ich je málo

lines: list[str] = []


def out(text: str = "") -> None:
    print(text)
    lines.append(text)


def size_mb(path: Path) -> str:
    if path.is_dir():
        total = sum(f.stat().st_size for f in path.rglob("*") if f.is_file())
    else:
        total = path.stat().st_size
    return f"{total / 1024 / 1024:,.1f} MB"


def inspect_vector(path: Path) -> None:
    out(f"\n=== VEKTOR: {path.relative_to(ROOT)}  ({size_mb(path)})")
    layers = pyogrio.list_layers(path)
    for name, geom_type in layers:
        info = pyogrio.read_info(path, layer=name)
        crs = info.get("crs")
        out(f"  -- vrstva: {name}")
        out(f"     geometria: {geom_type}   prvkov: {info.get('features')}   CRS: {crs}")
        fields = list(info.get("fields", []))
        dtypes = list(info.get("dtypes", []))
        out("     stĺpce: " + ", ".join(f"{f} ({t})" for f, t in zip(fields, dtypes)))
        if not fields:
            continue
        df = pyogrio.read_dataframe(path, layer=name, read_geometry=False, max_features=3)
        out("     prvé riadky:")
        for _, row in df.iterrows():
            out("       " + " | ".join(f"{k}={row[k]}" for k in df.columns))
        # Pri menších vrstvách vypíše unikátne hodnoty textových stĺpcov (napr. názvy okresov)
        n = info.get("features") or 0
        if 0 < n <= 20000:
            full = pyogrio.read_dataframe(path, layer=name, read_geometry=False)
            for col in full.columns:
                if pd.api.types.is_object_dtype(full[col]) or pd.api.types.is_string_dtype(full[col]):
                    uniq = full[col].dropna().unique()
                    if 1 < len(uniq) <= MAX_UNIQUE:
                        out(f"     unikátne hodnoty '{col}' ({len(uniq)}): "
                            + ", ".join(map(str, sorted(uniq))))


def inspect_raster(path: Path) -> None:
    out(f"\n=== RASTER: {path.relative_to(ROOT)}  ({size_mb(path)})")
    with rasterio.open(path) as src:
        out(f"     CRS: {src.crs}")
        out(f"     rozlíšenie: {src.res}   rozmer: {src.width} x {src.height}   pásma: {src.count}")
        out(f"     rozsah (bounds): {tuple(round(b, 3) for b in src.bounds)}")
        out(f"     typ: {src.dtypes[0]}   nodata: {src.nodata}   kompresia: {src.compression}")


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except AttributeError:
        pass

    if not RAW.exists():
        print(f"Priečinok {RAW} neexistuje. Vytvor ho a rozbaľ doň stiahnuté dáta.")
        return 1
    WORK.mkdir(exist_ok=True)

    out(f"Prehľad dát v {RAW}")
    found = 0
    # Esri File Geodatabase je priečinok s príponou .gdb
    for gdb in sorted(RAW.rglob("*.gdb")):
        if gdb.is_dir():
            found += 1
            try:
                inspect_vector(gdb)
            except Exception:
                out(f"  ! chyba pri čítaní {gdb}:\n{traceback.format_exc()}")

    for path in sorted(RAW.rglob("*")):
        if not path.is_file() or any(p.suffix.lower() == ".gdb" for p in path.parents):
            continue
        ext = path.suffix.lower()
        try:
            if ext in VECTOR_EXT:
                found += 1
                inspect_vector(path)
            elif ext in RASTER_EXT:
                found += 1
                inspect_raster(path)
            elif ext == ".zip":
                out(f"\n!!! ZIP nie je rozbalený: {path.relative_to(ROOT)} – rozbaľ ho.")
        except Exception:
            out(f"  ! chyba pri čítaní {path}:\n{traceback.format_exc()}")

    if found == 0:
        out("Nenašiel som žiadne vektorové ani rastrové súbory.")
    REPORT.write_text("\n".join(lines), encoding="utf-8")
    print(f"\nHotovo. Prehľad je uložený v {REPORT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
