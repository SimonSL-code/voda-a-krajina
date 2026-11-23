"""
10_export_web.py – pripraví dáta pre webovú mapu do docs/data/.

Pre každý okres:
  docs/data/<okres>/obce.geojson     – hranice obcí (zjednodušené) + všetky ukazovatele
  docs/data/<okres>/toky.geojson     – osi vodných tokov
  docs/data/<okres>/q100.geojson     – záplavové územie Q100 (SVP), orezané na okres
  docs/data/<okres>/stanice.geojson  – stanice SHMÚ v okrese a do 10 km okolo
Spoločne:
  docs/data/okresy.json              – zoznam okresov (názov, rozsah, súbory, dátum exportu)

Súradnice sú vo WGS 84 (EPSG:4326) zaokrúhlené na ~1 m, hranice zjednodušené s toleranciou
nastavenou v config.yaml (parametre.web_zjednodusenie_m).

Spustenie:
    python scripts/10_export_web.py [id_okresu]
"""

from __future__ import annotations

import json
import sys
from datetime import date

import geopandas as gpd
import pandas as pd
import shapely

from common import ROOT, nacitaj_config, okres_dir, okresy, spoj_vysledky, utf8_konzola

DOCS_DATA = ROOT / "docs" / "data"
PRESNOST = 1e-5  # ~1 m v stupňoch

# stĺpec v obce_ukazovatele -> kľúč v GeoJSON (kratšie názvy = menší súbor)
STLPCE = {
    "kod_obce": "kod", "nazov": "nazov", "okres": "okres", "lau2": "lau2", "vymera_km2": "vymera_km2",
    "vyska_min": "v_min", "vyska_max": "v_max", "vyska_priemer": "v_priemer", "vyskove_rozpatie": "v_rozpatie",
    "sklon_priemer": "s_priemer", "sklon_p95": "s_p95", "sklon_max": "s_max",
    "pokr_les": "p_les", "pokr_trava": "p_trava", "pokr_polnohosp": "p_polno",
    "pokr_zastavane": "p_zast", "pokr_ostatne": "p_ost", "wc_80": "p_voda",
    "toky_dlzka_km": "t_dlzka", "toky_stale_km": "t_stale", "hustota_siete_km_km2": "t_hustota",
    "toky_hlavne": "t_hlavne", "toky_vsetky": "t_vsetky",
    "q100_zasah": "q_zasah", "q100_plocha_ha": "q_ha", "q100_podiel_pct": "q_pct", "q100_verzia_dat": "q_verzia",
    "zrazkomerna_nazov": "z_nazov", "zrazkomerna_typ": "z_typ", "zrazkomerna_km": "z_km",
    "vodomerna_nazov": "h_nazov", "vodomerna_km": "h_km",
    "vodomerna_tok_nazov": "ht_nazov", "vodomerna_tok_km": "ht_km",
    "zrazkomerna_id": "z_id", "vodomerna_id": "h_id", "vodomerna_tok": "h_tok",
    "kraj_shdi": "k_shdi", "kraj_plosky": "k_plosky", "kraj_hust_plosok": "k_pd", "kraj_hust_okrajov": "k_ed",
    "kraj_lpi": "k_lpi", "kraj_les_meff": "k_meff",
    "datum_hranic": "datum_hranic",
}


def zaokruhli(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    gdf = gdf.copy()
    gdf["geometry"] = shapely.set_precision(gdf.geometry.values, PRESNOST)
    return gdf[gdf.geometry.apply(lambda g: g is not None and not g.is_empty)]


def uloz(gdf: gpd.GeoDataFrame, cesta) -> float:
    cesta.parent.mkdir(parents=True, exist_ok=True)
    cesta.unlink(missing_ok=True)
    gdf.to_file(cesta, driver="GeoJSON", COORDINATE_PRECISION=5, RFC7946="YES")
    return cesta.stat().st_size / 1024


def main() -> int:
    utf8_konzola()
    cfg = nacitaj_config()
    tol = float(cfg.get("parametre", {}).get("web_zjednodusenie_m", 5))
    zoznam_path = DOCS_DATA / "okresy.json"
    zoznam = json.loads(zoznam_path.read_text(encoding="utf-8")) if zoznam_path.exists() else {"okresy": []}
    ostatne = [o for o in zoznam.get("okresy", [])]

    for okres in okresy(cfg, sys.argv[1:]):
        oid = okres["id"]
        d = okres_dir(oid)
        out = DOCS_DATA / oid
        print(f"Okres {okres['nazov_okresu']}:")

        obce = gpd.read_file(spoj_vysledky(oid))
        chybaju = [c for c in STLPCE if c not in obce.columns]
        if chybaju:
            print(f"  ! chýbajú stĺpce {chybaju} – spusti skripty 01–07")
        obce = obce[[c for c in STLPCE if c in obce.columns] + ["geometry"]].rename(columns=STLPCE)
        # sklonové triedy ako zoznam, aby sa ľahko kreslil graf
        rel = pd.read_csv(d / "relief.csv")
        triedy = [c for c in rel.columns if c.startswith("sklon_") and c.split("_")[1].isdigit()]
        obce = obce.merge(
            pd.DataFrame({"kod": rel["kod_obce"],
                          "s_triedy": rel[triedy].values.tolist()}), on="kod", how="left")
        obce["s_triedy"] = obce["s_triedy"].map(json.dumps)
        okres_geom = obce.union_all()
        obce["geometry"] = obce.geometry.simplify(tol, preserve_topology=True)
        obce = zaokruhli(obce.to_crs("EPSG:4326"))
        velkosti = {"obce": uloz(obce, out / "obce.geojson")}

        subory = {"obce": "obce.geojson"}
        toky_p = d / "toky.gpkg"
        if toky_p.exists():
            toky = gpd.read_file(toky_p)
            toky["geometry"] = toky.geometry.simplify(tol)
            toky = zaokruhli(toky.to_crs("EPSG:4326"))[["nazov_toku", "staly", "geometry"]]
            toky["staly"] = toky["staly"].astype(int)
            velkosti["toky"] = uloz(toky, out / "toky.geojson")
            subory["toky"] = "toky.geojson"

        q_p = ROOT / "data_raw" / "povodne" / f"q100_{oid}.geojson"
        if q_p.exists():
            q = gpd.read_file(q_p).set_crs("EPSG:4326", allow_override=True).to_crs("EPSG:5514")
            q["geometry"] = q.geometry.make_valid()
            q = gpd.GeoDataFrame(geometry=[q.union_all().intersection(okres_geom)], crs="EPSG:5514")
            q = q.explode(index_parts=False)
            q = q[q.geom_type.isin(["Polygon", "MultiPolygon"])]
            q["geometry"] = q.geometry.simplify(tol)
            q = zaokruhli(q.to_crs("EPSG:4326"))
            velkosti["q100"] = uloz(q, out / "q100.geojson")
            subory["q100"] = "q100.geojson"

        st_dir = ROOT / "data_raw" / "stanice"
        if (st_dir / "shmu_vodomerne.geojson").exists() and (st_dir / "shmu_zrazkomerne.csv").exists():
            vod = gpd.read_file(st_dir / "shmu_vodomerne.geojson")
            vod = gpd.GeoDataFrame({"nazov": vod["name"].str.replace(r"\s+", " ", regex=True).str.strip(),
                                    "druh": "vodomerná", "typ": ""}, geometry=vod.geometry, crs="EPSG:4326")
            z = pd.read_csv(st_dir / "shmu_zrazkomerne.csv")
            zra = gpd.GeoDataFrame({"nazov": z["nazov"], "druh": "zrážkomerná", "typ": z["typ"]},
                                   geometry=gpd.points_from_xy(z.lon, z.lat), crs="EPSG:4326")
            st = pd.concat([vod, zra], ignore_index=True)
            okolie = gpd.GeoSeries([okres_geom.buffer(10000)], crs="EPSG:5514").to_crs("EPSG:4326").iloc[0]
            st = zaokruhli(st[st.within(okolie)])
            velkosti["stanice"] = uloz(st, out / "stanice.geojson")
            subory["stanice"] = "stanice.geojson"

        minx, miny, maxx, maxy = obce.total_bounds
        zaznam = {"id": oid, "nazov": okres["nazov_okresu"], "pocet_obci": int(len(obce)),
                  "bbox": [round(minx, 4), round(miny, 4), round(maxx, 4), round(maxy, 4)],
                  "subory": subory, "exportovane": date.today().isoformat()}
        ostatne = [o for o in ostatne if o.get("id") != oid] + [zaznam]
        print("  " + ", ".join(f"{k}: {v:,.0f} kB" for k, v in velkosti.items()))

    zoznam = {"okresy": sorted(ostatne, key=lambda o: o["nazov"]), "aktualizovane": date.today().isoformat()}
    DOCS_DATA.mkdir(parents=True, exist_ok=True)
    zoznam_path.write_text(json.dumps(zoznam, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Uložené do {DOCS_DATA.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
