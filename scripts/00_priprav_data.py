"""
00_priprav_data.py – rozbalí stiahnuté archívy zo Stiahnutých súborov do data_raw/.

  hranice obcí (ah_gpkg_0*.zip)  -> data_raw/hranice/
  DMR 3.5 10 m (dmr3_5-10*.zip)  -> data_raw/dmr/
  vodné toky (inspire_hy_gpkg*.zip) -> data_raw/toky/

Ak je v Stiahnutých súboroch viac verzií (napr. "ah_gpkg_0 (1).zip"), použije najnovšiu.
Už rozbalené súbory s rovnakou veľkosťou preskočí.

Spustenie (v Anaconda Prompt, v koreňovom priečinku projektu):
    conda activate vodakrajina
    python scripts/00_priprav_data.py
Voliteľne iný priečinok so stiahnutými súbormi:
    python scripts/00_priprav_data.py D:\\Stiahnute
"""

from __future__ import annotations

import shutil
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data_raw"

ARCHIVY = [
    # (vzor názvu, cieľový priečinok, popis)
    ("ah_gpkg_0*.zip", RAW / "hranice", "hranice obcí (ÚGKK/GKÚ)"),
    ("dmr3_5-10*.zip", RAW / "dmr", "DMR 3.5, 10 m (GKÚ)"),
    ("inspire_hy_gpkg*.zip", RAW / "toky", "INSPIRE Hydrografia, GPKG (GKÚ)"),
]


def najnovsi(priecinok: Path, vzor: str) -> Path | None:
    kandidati = sorted(priecinok.glob(vzor), key=lambda p: p.stat().st_mtime, reverse=True)
    return kandidati[0] if kandidati else None


def rozbal(archiv: Path, ciel: Path) -> None:
    ciel.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archiv) as zf:
        clenovia = [m for m in zf.infolist() if not m.is_dir()]
        potrebne = sum(m.file_size for m in clenovia)
        volne = shutil.disk_usage(ciel).free
        print(f"   obsah: {len(clenovia)} súborov, po rozbalení {potrebne / 1024**3:.2f} GB, "
              f"voľné miesto {volne / 1024**3:.1f} GB")
        if potrebne > volne:
            raise SystemExit("   ! Na disku nie je dosť miesta.")
        for i, m in enumerate(clenovia, 1):
            cielovy = ciel / m.filename
            if cielovy.exists() and cielovy.stat().st_size == m.file_size:
                print(f"   [{i}/{len(clenovia)}] už existuje, preskakujem: {m.filename}")
                continue
            print(f"   [{i}/{len(clenovia)}] {m.filename} ({m.file_size / 1024**2:,.1f} MB)")
            zf.extract(m, ciel)


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except AttributeError:
        pass

    stiahnute = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / "Downloads"
    print(f"Hľadám archívy v: {stiahnute}\n")
    chyby = 0
    for vzor, ciel, popis in ARCHIVY:
        archiv = najnovsi(stiahnute, vzor)
        if archiv is None:
            hotove = ciel.exists() and any(ciel.iterdir())
            if hotove:
                print(f"-> {popis}: archív nenájdený, ale {ciel.relative_to(ROOT)} už obsahuje dáta – OK\n")
            else:
                print(f"!! Nenašiel som {vzor} ({popis}).\n")
                chyby += 1
            continue
        print(f"-> {popis}: {archiv.name}  ->  {ciel.relative_to(ROOT)}")
        try:
            rozbal(archiv, ciel)
            print("   hotovo\n")
        except zipfile.BadZipFile:
            print("   ! Archív je poškodený alebo nedostiahnutý. Stiahni ho znova.\n")
            chyby += 1

    wc = sorted((RAW / "worldcover").glob("*.tif"))
    print(f"WorldCover v data_raw/worldcover: {len(wc)} súbor(y)")
    for f in wc:
        print(f"   {f.name} ({f.stat().st_size / 1024**2:,.0f} MB)")

    if chyby:
        print("\nNiečo chýba – pozri hlásenia vyššie.")
        return 1
    print("\nVšetko je pripravené. Ďalší krok: python scripts/00_inspect.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
