"""
04_toky.py – vodné toky v obciach z INSPIRE Hydrografia (ZBGIS, GKÚ).

Používa vrstvu Watercourse, len líniové prvky (osi tokov). Plošné prvky (široké koryta) sa
nepočítajú, lebo pre ne existujú aj osi. Dĺžka sa meria v EPSG:5514.

Výstupy:
  data_work/<okres>/toky.csv  – ukazovatele za obce
  data_work/<okres>/toky.gpkg – osi tokov orezané na okres (pre webovú mapu)
Stĺpce toky.csv: kod_obce, toky_dlzka_km, toky_stale_km (perennial), hustota_siete_km_km2,
        toky_hlavne (3 najdlhšie pomenované toky v obci), toky_vsetky (všetky pomenované, oddelené |)

Spustenie:
    python scripts/04_toky.py [id_okresu]
"""

from __future__ import annotations

import sys

import geopandas as gpd
import pandas as pd
import pyogrio

from common import ROOT, cesta, nacitaj_config, nacitaj_obce_okresu, okres_dir, okresy, spoj_vysledky, utf8_konzola

STALY = "perennial"


def fmt_km(km: float) -> str:
    return f"{km:.1f}".replace(".", ",")


def main() -> int:
    utf8_konzola()
    cfg = nacitaj_config()
    t = cfg["vstupy"]["toky"]
    subor = cesta(t["subor"])

    for okres in okresy(cfg, sys.argv[1:]):
        obce = nacitaj_obce_okresu(okres["id"])
        info = pyogrio.read_info(subor, layer=t["vrstva"])
        crs_zdroj = info["crs"] or "EPSG:4258"
        b = obce.to_crs(crs_zdroj).total_bounds
        okraj = 0.01
        print(f"Okres {okres['nazov_okresu']}: načítavam toky ...")
        toky = pyogrio.read_dataframe(subor, layer=t["vrstva"],
                                      bbox=(b[0] - okraj, b[1] - okraj, b[2] + okraj, b[3] + okraj))
        toky = toky.set_crs(crs_zdroj, allow_override=True).to_crs(obce.crs)
        toky = toky[toky.geom_type.isin(["LineString", "MultiLineString"])].copy()
        toky["nazov_toku"] = toky[t["stlpec_nazov"]].astype("string").str.strip()
        toky["staly"] = toky[t["stlpec_trvalost"]].astype("string").str.endswith(STALY).fillna(False)
        toky = toky[["nazov_toku", "staly", "geometry"]]

        cast = gpd.overlay(toky, obce[["kod_obce", "geometry"]], how="intersection", keep_geom_type=True)
        cast["km"] = cast.length / 1000

        riadky = []
        for _, obec in obce.iterrows():
            c = cast[cast["kod_obce"] == obec["kod_obce"]]
            celkom = c["km"].sum()
            pomenovane = (c.dropna(subset=["nazov_toku"]).groupby("nazov_toku")["km"].sum()
                          .sort_values(ascending=False))
            pomenovane = pomenovane[pomenovane >= 0.05]  # ignoruje kúsky pri hranici obce
            riadky.append({
                "kod_obce": int(obec["kod_obce"]),
                "toky_dlzka_km": round(celkom, 2),
                "toky_stale_km": round(c.loc[c["staly"], "km"].sum(), 2),
                "hustota_siete_km_km2": round(celkom / (obec.geometry.area / 1e6), 2),
                "toky_hlavne": "; ".join(f"{n} ({fmt_km(k)} km)" for n, k in pomenovane.head(3).items()),
                "toky_vsetky": "|".join(pomenovane.index),
            })

        d = okres_dir(okres["id"])
        df = pd.DataFrame(riadky)
        df.to_csv(d / "toky.csv", index=False, encoding="utf-8")

        okres_geom = obce.union_all()
        osi = gpd.clip(toky, okres_geom)
        osi = osi[~osi.is_empty]
        (d / "toky.gpkg").unlink(missing_ok=True)
        osi.to_file(d / "toky.gpkg", layer="toky", driver="GPKG")

        spolu = df["toky_dlzka_km"].sum()
        print(f"  dĺžka tokov v okrese: {spolu:.1f} km, hustota {spolu / (okres_geom.area / 1e6):.2f} km/km²")
        prehlad = df.merge(obce[["kod_obce", "nazov"]], on="kod_obce")
        print(prehlad[["nazov", "toky_dlzka_km", "hustota_siete_km_km2", "toky_hlavne"]].to_string(index=False))
        print(f"  uložené: {(d / 'toky.csv').relative_to(ROOT)}, {(d / 'toky.gpkg').relative_to(ROOT)}")
        print(f"  kontrolná vrstva: {spoj_vysledky(okres['id']).relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
