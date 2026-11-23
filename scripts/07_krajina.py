"""
07_krajina.py – krajinné metriky obcí z ESA WorldCover 2021 v200 (knižnica pylandstats).

Metriky hovoria o usporiadaní krajinnej mozaiky, nie len o podieloch tried (tie počíta 03_pokryvka.py).
Postup:
  1. Dlaždice WorldCover (EPSG:4326) sa orežú na okres a prevedú do S-JTSK (EPSG:5514) s bunkou 10 m
     metódou najbližšieho suseda (triedy sa nemiešajú).
  2. Pre každú obec sa bunky mimo obce nastavia na nodata (0) a z výrezu sa vytvorí pylandstats.Landscape
     (susedstvo 8 buniek). Hranica obce sa do dĺžky okrajov nezapočítava (count_boundary=False).

Metriky (úroveň krajiny, ak nie je uvedené inak):
  kraj_shdi        Shannonov index diverzity SHDI (–), 0 = jediná trieda
  kraj_plosky      počet plôšok (–)
  kraj_hust_plosok hustota plôšok PD (počet / 100 ha)
  kraj_hust_okrajov hustota okrajov ED (m/ha)
  kraj_lpi         index najväčšej plôšky LPI (%)
  kraj_les_meff    efektívna veľkosť oka lesa (trieda 10), MESH (ha); 0 ak obec nemá les
  kraj_buniek      počet platných buniek 10 m

Výstup: data_work/<okres>/krajina.csv

Spustenie:
    python scripts/07_krajina.py [id_okresu]
"""

from __future__ import annotations

import sys
import warnings

import numpy as np
import pandas as pd
import pylandstats as pls
import rasterio
from rasterio.features import rasterize
from rasterio.merge import merge
from rasterio.transform import from_origin
from rasterio.warp import Resampling, reproject

from common import ROOT, cesta, nacitaj_config, nacitaj_obce_okresu, okres_dir, okresy, spoj_vysledky, utf8_konzola

BUNKA = 10.0  # m
LES = 10      # trieda WorldCover „stromy“


def worldcover_5514(subory, obce) -> tuple[np.ndarray, rasterio.Affine]:
    """Výrez WorldCover pre okres prevedený do EPSG:5514 s bunkou 10 m."""
    o4326 = obce.to_crs("EPSG:4326")
    minx, miny, maxx, maxy = o4326.total_bounds
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
    okraj = 0.002
    data, tr_src = merge([str(p) for p in potrebne],
                         bounds=(minx - okraj, miny - okraj, maxx + okraj, maxy + okraj), nodata=0)

    x0, y0, x1, y1 = obce.total_bounds
    x0, y0 = np.floor(x0 / BUNKA) * BUNKA - BUNKA, np.floor(y0 / BUNKA) * BUNKA - BUNKA
    x1, y1 = np.ceil(x1 / BUNKA) * BUNKA + BUNKA, np.ceil(y1 / BUNKA) * BUNKA + BUNKA
    sirka, vyska = int(round((x1 - x0) / BUNKA)), int(round((y1 - y0) / BUNKA))
    tr = from_origin(x0, y1, BUNKA, BUNKA)
    ciel = np.zeros((vyska, sirka), dtype="uint8")
    reproject(data[0], ciel, src_transform=tr_src, src_crs="EPSG:4326", src_nodata=0,
              dst_transform=tr, dst_crs="EPSG:5514", dst_nodata=0, resampling=Resampling.nearest)
    return ciel, tr


def metriky_obce(vyrez: np.ndarray) -> dict:
    ls = pls.Landscape(vyrez, res=(BUNKA, BUNKA), nodata=0, neighborhood_rule="8")
    r = {
        "kraj_shdi": ls.shannon_diversity_index(),
        "kraj_plosky": ls.number_of_patches(),
        "kraj_hust_plosok": ls.patch_density(),
        "kraj_hust_okrajov": ls.edge_density(),
        "kraj_lpi": ls.largest_patch_index(),
        "kraj_les_meff": ls.effective_mesh_size(class_val=LES) if LES in ls.classes else 0.0,
    }
    return r


def main() -> int:
    utf8_konzola()
    warnings.filterwarnings("ignore", category=RuntimeWarning)
    cfg = nacitaj_config()
    subory = [cesta(s) for s in cfg["vstupy"]["worldcover"]["subory"]]

    for okres in okresy(cfg, sys.argv[1:]):
        obce = nacitaj_obce_okresu(okres["id"])  # EPSG:5514
        print(f"Okres {okres['nazov_okresu']}: {len(obce)} obcí")
        wc, tr = worldcover_5514(subory, obce)
        stitky = rasterize(((g, i + 1) for i, g in enumerate(obce.geometry)),
                           out_shape=wc.shape, transform=tr, fill=0, dtype="int32")

        riadky = []
        for i, (_, obec) in enumerate(obce.iterrows()):
            maska = (stitky == i + 1) & (wc > 0)
            r = {"kod_obce": int(obec["kod_obce"]), "kraj_buniek": int(maska.sum())}
            if r["kraj_buniek"] == 0:
                print(f"  ! {obec['nazov']}: žiadne platné bunky WorldCover")
                riadky.append(r)
                continue
            rr, cc = np.where(maska)
            vyrez = np.where(maska, wc, 0)[rr.min():rr.max() + 1, cc.min():cc.max() + 1]
            r.update(metriky_obce(vyrez))
            riadky.append(r)

        df = pd.DataFrame(riadky)
        for c, d in {"kraj_shdi": 3, "kraj_hust_plosok": 2, "kraj_hust_okrajov": 1, "kraj_lpi": 1, "kraj_les_meff": 1}.items():
            if c in df:
                df[c] = df[c].astype(float).round(d)
        if "kraj_plosky" in df:
            df["kraj_plosky"] = df["kraj_plosky"].astype("Int64")
        out = okres_dir(okres["id"]) / "krajina.csv"
        df.to_csv(out, index=False, encoding="utf-8")
        prehlad = df.merge(obce[["kod_obce", "nazov"]], on="kod_obce")
        print(prehlad[["nazov", "kraj_shdi", "kraj_plosky", "kraj_hust_okrajov", "kraj_lpi", "kraj_les_meff"]]
              .to_string(index=False))
        print(f"  uložené: {out.relative_to(ROOT)}")
        print(f"  kontrolná vrstva: {spoj_vysledky(okres['id']).relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
