"""
01_obce.py – vyberie obce okresu z hraníc ÚGKK/GKÚ a spočíta výmeru.

Výstup: data_work/<okres>/obce.gpkg (vrstva "obce", EPSG:5514)
Stĺpce: kod_obce, nazov, okres, lau2, vymera_km2 (z geometrie), vymera_gku_km2 (atribút VYMERA),
        datum_hranic

Spustenie:
    python scripts/01_obce.py                  # všetky okresy z config.yaml
    python scripts/01_obce.py stara-lubovna    # len vybraný okres
"""

from __future__ import annotations

import sys

import geopandas as gpd
import shapely

from common import ROOT, cesta, nacitaj_config, okres_dir, okresy, spoj_vysledky, utf8_konzola


def main() -> int:
    utf8_konzola()
    cfg = nacitaj_config()
    h = cfg["vstupy"]["hranice"]
    crs = cfg["projekt"]["crs_vypocty"]

    print(f"Načítavam {h['subor']} / {h['vrstva_obce']} ...")
    vsetky = gpd.read_file(cesta(h["subor"]), layer=h["vrstva_obce"])
    if vsetky.crs is None or vsetky.crs.to_epsg() != 5514:
        vsetky = vsetky.to_crs(crs)

    for okres in okresy(cfg, sys.argv[1:]):
        obce = vsetky[vsetky[h["stlpec_okres"]] == okres["nazov_okresu"]].copy()
        if obce.empty:
            dostupne = ", ".join(sorted(vsetky[h["stlpec_okres"]].unique()))
            raise SystemExit(f"Okres '{okres['nazov_okresu']}' sa nenašiel. Dostupné: {dostupne}")

        # Z-súradnice nepotrebujeme – zjednodušíme na 2D
        obce["geometry"] = shapely.force_2d(obce.geometry.values)
        obce = obce.rename(columns={
            h["stlpec_kod"]: "kod_obce",
            h["stlpec_nazov"]: "nazov",
            h["stlpec_okres"]: "okres",
            h["stlpec_lau2"]: "lau2",
        })
        obce["vymera_km2"] = (obce.geometry.area / 1e6).round(3)
        obce["vymera_gku_km2"] = (obce[h["stlpec_vymera"]] / 1e6).round(3)
        obce["datum_hranic"] = obce[h["stlpec_datum"]].astype(str).str[:10]
        obce = obce[["kod_obce", "nazov", "okres", "lau2", "vymera_km2", "vymera_gku_km2",
                     "datum_hranic", "geometry"]].sort_values("nazov").reset_index(drop=True)

        d = okres_dir(okres["id"])
        # starý výstup zmažeme, aby sa nehromadili vrstvy
        for f in ("obce.gpkg", "obce_ukazovatele.gpkg"):
            (d / f).unlink(missing_ok=True)
        obce.to_file(d / "obce.gpkg", layer="obce", driver="GPKG")

        rozdiel = (obce["vymera_km2"] - obce["vymera_gku_km2"]).abs().max()
        print(f"\nOkres {okres['nazov_okresu']}: {len(obce)} obcí, "
              f"spolu {obce['vymera_km2'].sum():.1f} km²")
        print(f"  najväčší rozdiel výmery geometria vs. atribút GKÚ: {rozdiel:.3f} km²")
        print(f"  hranice platné k: {', '.join(sorted(obce['datum_hranic'].unique()))}")
        print(f"  uložené: {(d / 'obce.gpkg').relative_to(ROOT)}")
        print(f"  kontrolná vrstva: {spoj_vysledky(okres['id']).relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
