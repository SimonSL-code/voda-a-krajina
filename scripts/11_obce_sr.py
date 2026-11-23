"""
11_obce_sr.py – zoznam všetkých obcí Slovenska pre stránku „Prompt pre AI“ (docs/prompt.html).

Z hraníc GKÚ (vrstva obec_0) vytvorí docs/data/obce_sr.json:
  kód obce, názov, okres, kraj, kód LAU2, výmera (km²), poloha ťažiska (WGS 84),
  kódy susedných obcí a id okresu, ak má okres v portáli vypočítané ukazovatele.
Súbor je kompaktný (zoznam riadkov bez geometrie), aby sa stránka rýchlo načítala.

Spustenie:
    python scripts/11_obce_sr.py
"""

from __future__ import annotations

import json
import unicodedata
from datetime import date

import geopandas as gpd

from common import ROOT, cesta, nacitaj_config, utf8_konzola

STLPCE = ["kod", "nazov", "okres", "kraj", "lau2", "vymera_km2", "lat", "lon", "susedia", "okres_id"]


def kluc_radenia(text: str) -> str:
    bez = unicodedata.normalize("NFD", text)
    return "".join(c for c in bez if not unicodedata.combining(c)).casefold()


def main() -> int:
    utf8_konzola()
    cfg = nacitaj_config()
    h = cfg["vstupy"]["hranice"]
    print(f"Načítavam {h['subor']} / {h['vrstva_obce']} ...")
    obce = gpd.read_file(cesta(h["subor"]), layer=h["vrstva_obce"]).to_crs("EPSG:5514")
    obce = obce.reset_index(drop=True)

    okres_id = {o["nazov_okresu"]: o["id"] for o in cfg["okresy"]}
    stredy = obce.geometry.centroid.to_crs("EPSG:4326")

    print("Hľadám susedné obce ...")
    sindex = obce.sindex
    kody = obce[h["stlpec_kod"]].astype(int).tolist()
    susedia = []
    geometrie = obce.geometry.values
    for i, geom in enumerate(geometrie):
        pas = geom.buffer(1)
        kandidati = sindex.query(pas, predicate="intersects")
        # sused = spoločná hranica aspoň ~10 m (dotyk v jednom bode sa neráta)
        susedia.append(sorted(kody[j] for j in kandidati
                              if j != i and pas.intersection(geometrie[j]).area > 10))

    kraj_stlpec = h.get("stlpec_kraj", "NM2")
    riadky = []
    for i, r in obce.iterrows():
        riadky.append([
            kody[i],
            r[h["stlpec_nazov"]],
            r[h["stlpec_okres"]],
            r[kraj_stlpec],
            r[h["stlpec_lau2"]],
            round(float(r[h["stlpec_vymera"]]) / 1e6, 2),
            round(float(stredy.iloc[i].y), 5),
            round(float(stredy.iloc[i].x), 5),
            susedia[i],
            okres_id.get(r[h["stlpec_okres"]]),
        ])
    riadky.sort(key=lambda x: (kluc_radenia(x[1]), kluc_radenia(x[2])))

    out = ROOT / "docs" / "data" / "obce_sr.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    datum = str(obce[h["stlpec_datum"]].max())[:10]
    out.write_text(json.dumps({"stlpce": STLPCE, "obce": riadky, "datum_hranic": datum,
                               "zdroj": "GKÚ Bratislava, CC BY 4.0", "vytvorene": date.today().isoformat()},
                              ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    s_detailom = sum(1 for r in riadky if r[-1])
    print(f"Obce: {len(riadky)}, z toho s ukazovateľmi portálu: {s_detailom}")
    print(f"Uložené: {out.relative_to(ROOT)} ({out.stat().st_size / 1024:,.0f} kB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
