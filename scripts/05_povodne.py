"""
05_povodne.py – zasah záplavového územia Q100 do obcí.

Zdroj: SVP, š. p. – Mapy povodňového ohrozenia, služba INSPIRE_MPO (záplavové čiary Q5–Q1000),
https://mpt.svp.sk/server/rest/services/inspire/INSPIRE_MPO/MapServer
Skript stiahne polygóny Q100 pre rozsah okresu (ak ešte nie sú stiahnuté) do
data_raw/povodne/q100_<okres>.geojson a spočíta ich plochu v každej obci.

Pozor pri interpretácii: mapy pokrývajú len vybrané úseky tokov. Hodnota 0 znamená
„v mapách SVP nie je zakreslené záplavové územie Q100“, nie „obec nie je ohrozená“.

Výstup: data_work/<okres>/povodne.csv
Stĺpce: kod_obce, q100_zasah (1/0), q100_plocha_ha, q100_podiel_pct, q100_verzia_dat

Spustenie:
    python scripts/05_povodne.py [id_okresu]
    python scripts/05_povodne.py --znova [id_okresu]   # stiahne dáta znova
"""

from __future__ import annotations

import json
import sys
import urllib.parse
import urllib.request

import geopandas as gpd
import pandas as pd

from common import ROOT, nacitaj_config, nacitaj_obce_okresu, okres_dir, okresy, spoj_vysledky, utf8_konzola

SLUZBA = "https://mpt.svp.sk/server/rest/services/inspire/INSPIRE_MPO/MapServer"
VRSTVA_Q100 = 1  # 0 Q1000, 1 Q100, 2 Q50, 3 Q10, 4 Q5
STRANKA = 500


def stiahni_q100(bbox_wgs: tuple[float, float, float, float], ciel) -> None:
    features = []
    offset = 0
    while True:
        params = {
            "where": "1=1",
            "geometry": ",".join(f"{v:.6f}" for v in bbox_wgs),
            "geometryType": "esriGeometryEnvelope",
            "inSR": "4326",
            "spatialRel": "esriSpatialRelIntersects",
            "outFields": "OBJECTID,inundationReturnPeriod,id_versionId",
            "returnGeometry": "true",
            "outSR": "4326",
            "orderByFields": "OBJECTID",
            "resultOffset": str(offset),
            "resultRecordCount": str(STRANKA),
            "f": "geojson",
        }
        url = f"{SLUZBA}/{VRSTVA_Q100}/query?" + urllib.parse.urlencode(params)
        with urllib.request.urlopen(url, timeout=120) as r:
            data = json.load(r)
        if "error" in data:
            raise SystemExit(f"Služba SVP vrátila chybu: {data['error']}")
        nove = data.get("features", [])
        features += nove
        print(f"  stiahnuté {len(features)} polygónov ...")
        if not nove or not data.get("exceededTransferLimit"):
            break
        offset += len(nove)
    ciel.parent.mkdir(parents=True, exist_ok=True)
    with open(ciel, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": features}, f)


def main() -> int:
    utf8_konzola()
    cfg = nacitaj_config()
    argumenty = [a for a in sys.argv[1:] if not a.startswith("--")]
    znova = "--znova" in sys.argv

    for okres in okresy(cfg, argumenty):
        obce = nacitaj_obce_okresu(okres["id"])
        subor = ROOT / "data_raw" / "povodne" / f"q100_{okres['id']}.geojson"
        if znova or not subor.exists():
            print(f"Okres {okres['nazov_okresu']}: sťahujem Q100 zo služby SVP ...")
            b = obce.to_crs("EPSG:4326").total_bounds
            stiahni_q100((b[0] - 0.01, b[1] - 0.01, b[2] + 0.01, b[3] + 0.01), subor)
        else:
            print(f"Okres {okres['nazov_okresu']}: používam stiahnutý {subor.relative_to(ROOT)}")

        q = gpd.read_file(subor)
        if q.empty:
            q100 = None
            verzia = ""
        else:
            q = q.set_crs("EPSG:4326", allow_override=True).to_crs(obce.crs)
            q["geometry"] = q.geometry.make_valid()
            q100 = q.union_all()
            verzia = ", ".join(sorted({str(v)[:10] for v in q.get("id_versionId", pd.Series(dtype=str)).dropna()}))

        riadky = []
        for _, obec in obce.iterrows():
            plocha = 0.0 if q100 is None else obec.geometry.intersection(q100).area
            ha = plocha / 1e4
            riadky.append({
                "kod_obce": int(obec["kod_obce"]),
                "q100_zasah": int(ha >= 0.01),
                "q100_plocha_ha": round(ha, 2),
                "q100_podiel_pct": round(100 * plocha / obec.geometry.area, 2),
                "q100_verzia_dat": verzia,
            })

        df = pd.DataFrame(riadky)
        out = okres_dir(okres["id"]) / "povodne.csv"
        df.to_csv(out, index=False, encoding="utf-8")
        prehlad = df.merge(obce[["kod_obce", "nazov"]], on="kod_obce")
        zasiahnute = prehlad[prehlad.q100_zasah == 1]
        print(f"  polygónov Q100: {len(q)}, verzia dát: {verzia or '-'}")
        print(f"  obce so zakresleným Q100: {len(zasiahnute)} z {len(prehlad)}")
        if not zasiahnute.empty:
            print(zasiahnute[["nazov", "q100_plocha_ha", "q100_podiel_pct"]]
                  .sort_values("q100_plocha_ha", ascending=False).to_string(index=False))
        print(f"  uložené: {out.relative_to(ROOT)}")
        print(f"  kontrolná vrstva: {spoj_vysledky(okres['id']).relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
