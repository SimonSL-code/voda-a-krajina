"""
common.py – spoločné funkcie pre skripty 01–09 (načítanie konfigurácie, cesty, spájanie výsledkov).
Samostatne sa nespúšťa.
"""

from __future__ import annotations

import sys
from pathlib import Path

import geopandas as gpd
import pandas as pd
import yaml

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "data_work"


def utf8_konzola() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except AttributeError:
        pass


def nacitaj_config() -> dict:
    with open(ROOT / "config" / "config.yaml", encoding="utf-8") as f:
        return yaml.safe_load(f)


def cesta(rel: str) -> Path:
    return ROOT / rel


def okresy(cfg: dict, vyber: list[str] | None = None) -> list[dict]:
    """Vráti zoznam okresov z konfigurácie; voliteľne len tie s danými id (argumenty príkazového riadku)."""
    vsetky = cfg["okresy"]
    if vyber:
        vsetky = [o for o in vsetky if o["id"] in vyber]
        if not vsetky:
            raise SystemExit(f"Okres {vyber} nie je v config.yaml.")
    return vsetky


def okres_dir(okres_id: str) -> Path:
    d = WORK / okres_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def nacitaj_obce_okresu(okres_id: str) -> gpd.GeoDataFrame:
    """Obce okresu pripravené skriptom 01_obce.py (EPSG:5514)."""
    p = okres_dir(okres_id) / "obce.gpkg"
    if not p.exists():
        raise SystemExit(f"Chýba {p.relative_to(ROOT)} – najprv spusti: python scripts/01_obce.py")
    return gpd.read_file(p, layer="obce")


def spoj_vysledky(okres_id: str) -> Path:
    """Spojí obce.gpkg so všetkými CSV výsledkami v priečinku okresu do obce_ukazovatele.gpkg (na kontrolu v QGIS)."""
    d = okres_dir(okres_id)
    obce = nacitaj_obce_okresu(okres_id)
    for csv in sorted(d.glob("*.csv")):
        df = pd.read_csv(csv, dtype={"kod_obce": "int64"})
        nove = [c for c in df.columns if c != "kod_obce" and c not in obce.columns]
        obce = obce.merge(df[["kod_obce", *nove]], on="kod_obce", how="left")
    out = d / "obce_ukazovatele.gpkg"
    obce.to_file(out, layer="obce_ukazovatele", driver="GPKG")
    return out
