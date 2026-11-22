"""
02_relief.py – výšky a sklony obcí z DMR 3.5 (10 m).

Sklon sa počíta Hornovou metódou (3×3 okolie) zo súvislého výrezu DMR pre celý okres
s okrajom, takže je správny aj na hraniciach obcí. Bunka patrí obci, ak jej stred leží v obci.

Výstup: data_work/<okres>/relief.csv
Stĺpce: kod_obce, vyska_min, vyska_max, vyska_priemer, vyskove_rozpatie [m n. m.],
        sklon_priemer, sklon_p95, sklon_max [°], sklon_<od>_<do> [% plochy obce], relief_buniek

Spustenie:
    python scripts/02_relief.py [id_okresu]
"""

from __future__ import annotations

import math
import sys

import numpy as np
import pandas as pd
import rasterio
from rasterio.features import rasterize
from rasterio.windows import Window

from common import ROOT, cesta, nacitaj_config, nacitaj_obce_okresu, okres_dir, okresy, spoj_vysledky, utf8_konzola


def vyrez_dmr(src: rasterio.DatasetReader, bounds: tuple[float, float, float, float], okraj: float):
    """Načíta výrez DMR zarovnaný na mriežku rastra. Vráti (pole s NaN, transform)."""
    t = src.transform
    res_x, res_y = t.a, -t.e
    minx, miny, maxx, maxy = bounds
    col0 = max(0, math.floor((minx - okraj - t.c) / res_x))
    row0 = max(0, math.floor((t.f - (maxy + okraj)) / res_y))
    col1 = min(src.width, math.ceil((maxx + okraj - t.c) / res_x))
    row1 = min(src.height, math.ceil((t.f - (miny - okraj)) / res_y))
    okno = Window(col0, row0, col1 - col0, row1 - row0)
    z = src.read(1, window=okno).astype("float64")
    nodata = src.nodata
    neplatne = ~np.isfinite(z) | (z < -1000) | (z > 9000)
    if nodata is not None:
        neplatne |= np.isclose(z, nodata)
    z[neplatne] = np.nan
    return z, src.window_transform(okno), (res_x, res_y)


def sklon_horn(z: np.ndarray, res_x: float, res_y: float) -> np.ndarray:
    """Sklon v stupňoch Hornovou metódou; okrajové bunky a bunky pri NaN sú NaN."""
    s = np.full(z.shape, np.nan)
    a, b, c = z[:-2, :-2], z[:-2, 1:-1], z[:-2, 2:]
    d, f = z[1:-1, :-2], z[1:-1, 2:]
    g, h, i = z[2:, :-2], z[2:, 1:-1], z[2:, 2:]
    dzdx = ((c + 2 * f + i) - (a + 2 * d + g)) / (8 * res_x)
    dzdy = ((g + 2 * h + i) - (a + 2 * b + c)) / (8 * res_y)
    s[1:-1, 1:-1] = np.degrees(np.arctan(np.hypot(dzdx, dzdy)))
    return s


def main() -> int:
    utf8_konzola()
    cfg = nacitaj_config()
    hranice_tried = cfg["parametre"]["sklonove_triedy"]
    okraj = float(cfg["parametre"]["okraj_dmr_m"])

    with rasterio.open(cesta(cfg["vstupy"]["dmr"]["subor"])) as src:
        if src.crs is None or src.crs.to_epsg() != 5514:
            raise SystemExit(f"DMR má CRS {src.crs}, očakávam EPSG:5514.")

        for okres in okresy(cfg, sys.argv[1:]):
            obce = nacitaj_obce_okresu(okres["id"])
            print(f"Okres {okres['nazov_okresu']}: {len(obce)} obcí – čítam DMR ...")
            z, transform, (rx, ry) = vyrez_dmr(src, tuple(obce.total_bounds), okraj)
            print(f"  výrez {z.shape[1]} × {z.shape[0]} buniek, počítam sklon ...")
            sklon = sklon_horn(z, rx, ry)

            # mriežka s poradovým číslom obce (0 = mimo obcí)
            stitky = rasterize(
                ((geom, idx + 1) for idx, geom in enumerate(obce.geometry)),
                out_shape=z.shape, transform=transform, fill=0, dtype="int32",
            )

            riadky = []
            for idx, obec in obce.iterrows():
                maska = stitky == idx + 1
                vys = z[maska]
                skl = sklon[maska]
                vys = vys[np.isfinite(vys)]
                skl = skl[np.isfinite(skl)]
                r = {"kod_obce": int(obec["kod_obce"]), "relief_buniek": int(maska.sum())}
                if vys.size == 0:
                    print(f"  ! {obec['nazov']}: žiadne platné bunky DMR")
                    riadky.append(r)
                    continue
                r.update({
                    "vyska_min": round(float(vys.min()), 1),
                    "vyska_max": round(float(vys.max()), 1),
                    "vyska_priemer": round(float(vys.mean()), 1),
                    "vyskove_rozpatie": round(float(vys.max() - vys.min()), 1),
                    "sklon_priemer": round(float(skl.mean()), 2),
                    "sklon_p95": round(float(np.percentile(skl, 95)), 2),
                    "sklon_max": round(float(skl.max()), 2),
                })
                pocty, _ = np.histogram(skl, bins=hranice_tried)
                for (od, do), n in zip(zip(hranice_tried[:-1], hranice_tried[1:]), pocty):
                    r[f"sklon_{od}_{do}"] = round(100 * n / skl.size, 1)
                riadky.append(r)

            df = pd.DataFrame(riadky)
            out = okres_dir(okres["id"]) / "relief.csv"
            df.to_csv(out, index=False, encoding="utf-8")
            prehlad = df.merge(obce[["kod_obce", "nazov"]], on="kod_obce")
            print(prehlad[["nazov", "vyska_min", "vyska_max", "sklon_priemer", "sklon_p95", "sklon_max"]]
                  .to_string(index=False))
            print(f"  uložené: {out.relative_to(ROOT)}")
            print(f"  kontrolná vrstva: {spoj_vysledky(okres['id']).relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
