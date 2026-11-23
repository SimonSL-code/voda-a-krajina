"""
12_kes.py – podklady pre stránku „Koeficient ekologickej stability (KES)“ (docs/kes.html).

Vstupy:
  * Úhrnné hodnoty druhov pozemkov (ÚHDP) po katastrálnych územiach – ÚGKK SR, CSV v m².
    Skript ho stiahne do data_raw/kataster/ (adresa a dátum v config.yaml, sekcia kes).
  * Hranice katastrálnych území – vrstva ku_0 v data_raw/hranice/USJ_hranice_0.gpkg (GKÚ).

Výstupy v docs/data/kes/:
  uhdp.json        – výmery druhov pozemkov všetkých k. ú. SR (m²); KES sa počíta až v prehliadači,
                     aby sa dalo meniť zaradenie druhov pozemkov do stabilných a labilných
  kraje.json       – zoznam krajov s rozsahom a názvom súboru s hranicami
  ku_<kraj>.geojson – zjednodušené hranice k. ú. kraja (WGS 84)

Spustenie:
    python scripts/12_kes.py
    python scripts/12_kes.py --znova     # stiahne CSV z ÚGKK znova
"""

from __future__ import annotations

import csv
import io
import json
import sys
import urllib.request
from datetime import date

import geopandas as gpd
import shapely

from common import ROOT, cesta, nacitaj_config, utf8_konzola

OUT = ROOT / "docs" / "data" / "kes"
DRUHY = ["orna", "chmel", "vinica", "zahrada", "sad", "ttp", "les", "voda", "zast", "ost"]
KRAJE = {1: "Bratislavský", 2: "Trnavský", 3: "Trenčiansky", 4: "Nitriansky",
         5: "Žilinský", 6: "Banskobystrický", 7: "Prešovský", 8: "Košický"}


def cislo(text: str) -> int:
    t = text.replace(" ", "").replace(" ", "").strip()
    return int(t) if t else 0


def stiahni(url: str, ciel) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (voda-a-krajina; studentsky projekt)"})
    with urllib.request.urlopen(req, timeout=120) as r:
        ciel.write_bytes(r.read())


def nacitaj_uhdp(subor) -> list[dict]:
    raw = subor.read_bytes()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("cp1250")
    riadky = []
    chyby = 0
    for r in csv.reader(io.StringIO(text), delimiter=";"):
        if len(r) < 18 or not r[0].strip().isdigit() or len(r[0].strip()) != 3:
            continue  # hlavička a súčtový riadok
        z = {
            "okres_kod": int(r[0]), "okres": r[1].strip(), "obec_kod": cislo(r[2]), "obec": r[3].strip(),
            "ku_kod": cislo(r[4]), "ku": r[5].strip(), "celkom": cislo(r[6]),
            "orna": cislo(r[7]), "chmel": cislo(r[8]), "vinica": cislo(r[9]), "zahrada": cislo(r[10]),
            "sad": cislo(r[11]), "ttp": cislo(r[12]), "polno": cislo(r[13]), "les": cislo(r[14]),
            "voda": cislo(r[15]), "zast": cislo(r[16]), "ost": cislo(r[17]),
        }
        polno = sum(z[k] for k in ["orna", "chmel", "vinica", "zahrada", "sad", "ttp"])
        spolu = polno + z["les"] + z["voda"] + z["zast"] + z["ost"]
        if polno != z["polno"] or spolu != z["celkom"]:
            chyby += 1
            print(f"  ! nesedí súčet: {z['ku']} ({z['ku_kod']}): {spolu} vs. {z['celkom']}")
        z["kraj"] = z["okres_kod"] // 100
        riadky.append(z)
    print(f"ÚHDP: {len(riadky)} katastrálnych území, nesúhlasné súčty: {chyby}")
    return riadky


def main() -> int:
    utf8_konzola()
    cfg = nacitaj_config()
    k = cfg["kes"]
    h = cfg["vstupy"]["hranice"]
    tol = float(k.get("web_zjednodusenie_m", 10))

    csv_subor = ROOT / "data_raw" / "kataster" / k["uhdp_url"].rsplit("/", 1)[-1]
    csv_subor.parent.mkdir(parents=True, exist_ok=True)
    if "--znova" in sys.argv or not csv_subor.exists():
        print(f"Sťahujem {k['uhdp_url']} ...")
        stiahni(k["uhdp_url"], csv_subor)
    uhdp = nacitaj_uhdp(csv_subor)

    print(f"Načítavam hranice k. ú. ({h['subor']} / {k['vrstva_ku']}) ...")
    ku = gpd.read_file(cesta(h["subor"]), layer=k["vrstva_ku"])
    ku = ku.to_crs("EPSG:5514")
    ku["geometry"] = shapely.force_2d(ku.geometry.values)
    ku["kod"] = ku[k["stlpec_ku_kod"]].astype(int)
    nazvy_obci = dict(zip(ku["kod"], ku[k["stlpec_obec"]]))

    kody_uhdp = {z["ku_kod"] for z in uhdp}
    kody_map = set(ku["kod"])
    bez_mapy = sorted(kody_uhdp - kody_map)
    bez_uhdp = sorted(kody_map - kody_uhdp)
    print(f"Spárované k. ú.: {len(kody_uhdp & kody_map)}; len v ÚHDP: {len(bez_mapy)}; len v mape: {len(bez_uhdp)}")
    if bez_mapy[:10]:
        print(f"  k. ú. bez hraníc (prvé): {bez_mapy[:10]}")

    OUT.mkdir(parents=True, exist_ok=True)
    tabulka = [[z["ku_kod"], z["ku"], nazvy_obci.get(z["ku_kod"], z["obec"]), z["okres"], z["kraj"], z["celkom"],
                *[z[d] for d in DRUHY]] for z in uhdp]
    tabulka.sort(key=lambda r: (r[4], r[1]))
    (OUT / "uhdp.json").write_text(json.dumps({
        "stlpce": ["kod", "nazov", "obec", "okres", "kraj", "celkom", *DRUHY],
        "jednotka": "m2", "stav_k": k["uhdp_stav_k"],
        "zdroj": "ÚGKK SR – úhrnné hodnoty druhov pozemkov po katastrálnych územiach",
        "zdroj_url": k["uhdp_url"], "vytvorene": date.today().isoformat(), "ku": tabulka,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    ku["kraj"] = (ku["kod"].map({z["ku_kod"]: z["kraj"] for z in uhdp})).fillna(ku[k["stlpec_kraj_kod"]]).astype(int)
    ku["geometry"] = ku.geometry.simplify(tol, preserve_topology=True)
    ku = ku.to_crs("EPSG:4326")
    ku["geometry"] = shapely.set_precision(ku.geometry.values, 1e-5)

    kraje = []
    for kid, nazov in KRAJE.items():
        cast = ku[ku["kraj"] == kid][["kod", "geometry"]]
        if cast.empty:
            continue
        subor = OUT / f"ku_{kid}.geojson"
        subor.unlink(missing_ok=True)
        cast.to_file(subor, driver="GeoJSON", COORDINATE_PRECISION=5, RFC7946="YES")
        b = cast.total_bounds
        kraje.append({"id": kid, "nazov": nazov, "pocet_ku": int(len(cast)), "subor": subor.name,
                      "bbox": [round(float(x), 4) for x in b]})
        print(f"  {nazov} kraj: {len(cast)} k. ú., {subor.stat().st_size / 1024:,.0f} kB")
    (OUT / "kraje.json").write_text(json.dumps({"kraje": kraje, "vytvorene": date.today().isoformat()},
                                               ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Uložené do {OUT.relative_to(ROOT)} (uhdp.json {(OUT / 'uhdp.json').stat().st_size / 1024:,.0f} kB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
