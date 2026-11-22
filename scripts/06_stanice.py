"""
06_stanice.py – najbližšie stanice SHMÚ k obciam.

Zdroj polôh staníc: verejné mapy na webe SHMÚ (www.shmu.sk)
  vodomerné stanice:  /popups/hydro/vodne_toky/hydro_stations_geojson.php
  zrážkomerné stanice: stránka ?page=1&id=hydro_zra_all (zoznam staníc v mape)
Skript ich stiahne do data_raw/stanice/ (ak tam ešte nie sú) pre celé Slovensko.
Ručné doplnky alebo opravy môžeš zapísať do config/stanice_shmu.csv – majú prednosť.

Pre každú obec (vzdialenosť od ťažiska obce, v km):
  zrazkomerna_*      – najbližšia zrážkomerná stanica
  vodomerna_*        – najbližšia vodomerná stanica
  vodomerna_tok_*    – najbližšia vodomerná stanica na toku, ktorý preteká obcou
                       (podľa názvov tokov zo 04_toky.py)

Výstup: data_work/<okres>/stanice.csv

Spustenie:
    python scripts/06_stanice.py [id_okresu]
    python scripts/06_stanice.py --znova [id_okresu]   # stiahne zoznamy staníc znova
"""

from __future__ import annotations

import json
import re
import sys
import urllib.request

import geopandas as gpd
import pandas as pd

from common import ROOT, nacitaj_config, nacitaj_obce_okresu, okres_dir, okresy, spoj_vysledky, utf8_konzola

URL_VODOMERNE = "https://www.shmu.sk/popups/hydro/vodne_toky/hydro_stations_geojson.php"
URL_ZRAZKOMERNE = "https://www.shmu.sk/sk/?page=1&id=hydro_zra_all"
DIR_STANICE = ROOT / "data_raw" / "stanice"
F_VODOMERNE = DIR_STANICE / "shmu_vodomerne.geojson"
F_ZRAZKOMERNE = DIR_STANICE / "shmu_zrazkomerne.csv"

VZOR_ZRAZKOMER = re.compile(
    r"\{nazov:'((?:[^'\\]|\\.)*)',lat:([-\d.]+),lon:([-\d.]+),ids:'([^']*)'[^}]*?uid:'([^']*)'\}"
)


def stiahni(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (voda-a-krajina; studentsky projekt)"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8", errors="replace")


def parsuj_zrazkomerne(html: str) -> pd.DataFrame:
    riadky = []
    for nazov, lat, lon, ids, uid in VZOR_ZRAZKOMER.findall(html):
        nazov = nazov.replace("\\'", "'")
        cislo, _, meno = nazov.partition(" - ")
        typ = ids.split("_")[1].upper() if ids.count("_") >= 2 else ""
        riadky.append({"id_stanice": uid, "nazov": (meno or nazov).strip(), "cislo": cislo.strip(),
                       "typ": typ, "lat": float(lat), "lon": float(lon)})
    return pd.DataFrame(riadky)


def parsuj_vodomerne(geojson: dict) -> pd.DataFrame:
    riadky = []
    for f in geojson.get("features", []):
        meno = re.sub(r"\s+", " ", f["properties"].get("name", "")).strip()
        miesto, sep, tok = meno.rpartition(" - ")
        lon, lat = f["geometry"]["coordinates"][:2]
        riadky.append({"id_stanice": str(f.get("id", "")), "nazov": meno,
                       "miesto": miesto if sep else meno, "tok": tok if sep else "",
                       "typ": "vodomerná", "lat": float(lat), "lon": float(lon)})
    return pd.DataFrame(riadky)


def nacitaj_stanice(znova: bool) -> tuple[pd.DataFrame, pd.DataFrame]:
    DIR_STANICE.mkdir(parents=True, exist_ok=True)
    if znova or not F_VODOMERNE.exists():
        print("Sťahujem vodomerné stanice SHMÚ ...")
        F_VODOMERNE.write_text(stiahni(URL_VODOMERNE), encoding="utf-8")
    if znova or not F_ZRAZKOMERNE.exists():
        print("Sťahujem zrážkomerné stanice SHMÚ ...")
        z = parsuj_zrazkomerne(stiahni(URL_ZRAZKOMERNE))
        if z.empty:
            raise SystemExit("Na stránke SHMÚ som nenašiel zoznam zrážkomerných staníc – stránka sa asi zmenila.")
        z.to_csv(F_ZRAZKOMERNE, index=False, encoding="utf-8")

    vod = parsuj_vodomerne(json.loads(F_VODOMERNE.read_text(encoding="utf-8")))
    zra = pd.read_csv(F_ZRAZKOMERNE, dtype={"id_stanice": str, "cislo": str})

    rucne = ROOT / "config" / "stanice_shmu.csv"
    if rucne.exists():
        r = pd.read_csv(rucne, dtype={"id_stanice": str})
        if not r.empty:
            print(f"Ručné doplnky zo {rucne.relative_to(ROOT)}: {len(r)} staníc")
            je_vod = r["typ"].astype(str).str.lower().str.startswith("vodomer")
            vod = pd.concat([vod[~vod.id_stanice.isin(r.id_stanice)], r[je_vod]], ignore_index=True)
            zra = pd.concat([zra[~zra.id_stanice.isin(r.id_stanice)], r[~je_vod]], ignore_index=True)
    print(f"Stanice: {len(vod)} vodomerných, {len(zra)} zrážkomerných")
    return vod, zra


def na_body(df: pd.DataFrame, crs) -> gpd.GeoDataFrame:
    return gpd.GeoDataFrame(df.copy(), geometry=gpd.points_from_xy(df.lon, df.lat), crs="EPSG:4326").to_crs(crs)


def norm(nazov: str) -> str:
    return re.sub(r"\s+", " ", str(nazov)).strip().lower()


def main() -> int:
    utf8_konzola()
    cfg = nacitaj_config()
    argumenty = [a for a in sys.argv[1:] if not a.startswith("--")]
    vod_df, zra_df = nacitaj_stanice("--znova" in sys.argv)
    par = cfg.get("parametre", {})
    max_km = float(par.get("stanica_na_toku_max_km", 15))
    aliasy = {norm(k): norm(v) for k, v in (par.get("aliasy_tokov") or {}).items()}

    for okres in okresy(cfg, argumenty):
        obce = nacitaj_obce_okresu(okres["id"])
        vod = na_body(vod_df, obce.crs)
        zra = na_body(zra_df, obce.crs)
        # názov toku podľa SHMÚ prevedieme na názov v ZBGIS (aliasy v config.yaml)
        vod["tok_norm"] = vod["tok"].map(norm).map(lambda t: aliasy.get(t, t))

        toky_csv = okres_dir(okres["id"]) / "toky.csv"
        toky = {}
        if toky_csv.exists():
            t = pd.read_csv(toky_csv, dtype={"kod_obce": "int64"}).fillna({"toky_vsetky": ""})
            toky = {k: {norm(x) for x in v.split("|") if x} for k, v in zip(t.kod_obce, t.toky_vsetky)}
        else:
            print("  ! chýba toky.csv – stanice podľa toku vynechám (spusti 04_toky.py)")

        riadky = []
        for _, obec in obce.iterrows():
            stred = obec.geometry.centroid
            r = {"kod_obce": int(obec["kod_obce"])}

            dz = zra.distance(stred)
            i = dz.idxmin()
            r.update({"zrazkomerna_nazov": zra.at[i, "nazov"], "zrazkomerna_id": zra.at[i, "id_stanice"],
                      "zrazkomerna_typ": zra.at[i, "typ"], "zrazkomerna_km": round(dz[i] / 1000, 1)})

            dv = vod.distance(stred)
            i = dv.idxmin()
            r.update({"vodomerna_nazov": vod.at[i, "nazov"], "vodomerna_id": vod.at[i, "id_stanice"],
                      "vodomerna_tok": vod.at[i, "tok"], "vodomerna_km": round(dv[i] / 1000, 1),
                      "vodomerna_v_obci": int(obec.geometry.contains(vod.at[i, "geometry"]))})

            na_toku = vod[vod["tok_norm"].isin(toky.get(int(obec["kod_obce"]), set()))]
            if not na_toku.empty:
                dt = na_toku.distance(stred)
                i = dt.idxmin()
            if not na_toku.empty and dt[i] / 1000 <= max_km:
                r.update({"vodomerna_tok_nazov": vod.at[i, "nazov"], "vodomerna_tok_id": vod.at[i, "id_stanice"],
                          "vodomerna_tok_tok": vod.at[i, "tok"], "vodomerna_tok_km": round(dt[i] / 1000, 1)})
            riadky.append(r)

        df = pd.DataFrame(riadky)
        out = okres_dir(okres["id"]) / "stanice.csv"
        df.to_csv(out, index=False, encoding="utf-8")
        prehlad = df.merge(obce[["kod_obce", "nazov"]], on="kod_obce")
        stlpce = ["nazov", "zrazkomerna_nazov", "zrazkomerna_km", "vodomerna_nazov", "vodomerna_km",
                  "vodomerna_tok_nazov", "vodomerna_tok_km"]
        print(prehlad[[c for c in stlpce if c in prehlad]].to_string(index=False))
        print(f"  uložené: {out.relative_to(ROOT)}")
        print(f"  kontrolná vrstva: {spoj_vysledky(okres['id']).relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
