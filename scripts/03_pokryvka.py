"""
03_pokryvka.py – krajinná pokrývka obcí z ESA WorldCover 2021 v200 (10 m).

WorldCover je v EPSG:4326; obce sa preto prevedú do EPSG:4326 a rasterizujú na mriežku
WorldCover (bunka patrí obci, ak jej stred leží v obci). Podiely sa počítajú z počtu buniek –
v rámci jednej obce je rozdiel plochy buniek zanedbateľný.

Triedy WorldCover: 10 stromy, 20 kroviny, 30 trávne porasty, 40 poľnohospodárska pôda,
50 zastavané, 60 holá pôda / riedka vegetácia, 70 sneh a ľad, 80 vodné plochy,
90 mokrade, 95 mangrovy, 100 machy a lišajníky.

Výstup: data_work/<okres>/pokryvka.csv
Stĺpce: kod_obce, pokr_les, pokr_trava, pokr_polnohosp, pokr_zastavane, pokr_ostatne [%],
        wc_<trieda> [%] pre každú triedu, pokr_buniek

Spustenie:
    python scripts/03_pokryvka.py [id_okresu]
"""

from __future__ import annotations

import sys

import numpy as np
import pandas as pd
import rasterio
from rasterio.features import rasterize
from rasterio.merge import merge

from common import ROOT, cesta, nacitaj_config, nacitaj_obce_okresu, okres_dir, okresy, spoj_vysledky, utf8_konzola

TRIEDY = [10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 100]
SKUPINY = {
    "pokr_les": [10],
    "pokr_trava": [30],
    "pokr_polnohosp": [40],
    "pokr_zastavane": [50],
    "pokr_ostatne": [20, 60, 70, 80, 90, 95, 100],
}


def main() -> int:
    utf8_konzola()
    cfg = nacitaj_config()
    subory = [cesta(s) for s in cfg["vstupy"]["worldcover"]["subory"]]

    for okres in okresy(cfg, sys.argv[1:]):
        obce = nacitaj_obce_okresu(okres["id"]).to_crs("EPSG:4326")
        minx, miny, maxx, maxy = obce.total_bounds
        print(f"Okres {okres['nazov_okresu']}: rozsah {minx:.3f}–{maxx:.3f} E, {miny:.3f}–{maxy:.3f} N")

        # vyberie len dlaždice, ktoré okres pretína
        potrebne = []
        for s in subory:
            if not s.exists():
                print(f"  ! chýba {s.relative_to(ROOT)} – preskakujem")
                continue
            with rasterio.open(s) as src:
                b = src.bounds
                if b.left < maxx and b.right > minx and b.bottom < maxy and b.top > miny:
                    potrebne.append(s)
        if not potrebne:
            raise SystemExit("Žiadna dlaždica WorldCover nepokrýva okres – doplň ju do config.yaml.")
        print(f"  dlaždice: {', '.join(p.name for p in potrebne)}")

        okraj = 0.001  # ~100 m
        data, transform = merge([str(p) for p in potrebne],
                                bounds=(minx - okraj, miny - okraj, maxx + okraj, maxy + okraj),
                                nodata=0)
        wc = data[0]
        stitky = rasterize(
            ((geom, idx + 1) for idx, geom in enumerate(obce.geometry)),
            out_shape=wc.shape, transform=transform, fill=0, dtype="int32",
        )

        riadky = []
        for idx, obec in obce.iterrows():
            hodnoty = wc[(stitky == idx + 1) & (wc > 0)]
            r = {"kod_obce": int(obec["kod_obce"]), "pokr_buniek": int(hodnoty.size)}
            if hodnoty.size == 0:
                print(f"  ! {obec['nazov']}: žiadne platné bunky WorldCover")
                riadky.append(r)
                continue
            pocty = np.bincount(hodnoty, minlength=101)
            for t in TRIEDY:
                r[f"wc_{t}"] = round(100 * pocty[t] / hodnoty.size, 1)
            for nazov, triedy in SKUPINY.items():
                r[nazov] = round(100 * sum(pocty[t] for t in triedy) / hodnoty.size, 1)
            riadky.append(r)

        df = pd.DataFrame(riadky)
        out = okres_dir(okres["id"]) / "pokryvka.csv"
        df.to_csv(out, index=False, encoding="utf-8")
        prehlad = df.merge(obce[["kod_obce", "nazov"]], on="kod_obce")
        print(prehlad[["nazov", *SKUPINY]].to_string(index=False))
        print(f"  uložené: {out.relative_to(ROOT)}")
        print(f"  kontrolná vrstva: {spoj_vysledky(okres['id']).relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
