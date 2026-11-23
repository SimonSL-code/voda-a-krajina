# Voda a krajina v obciach

Interaktívna mapa ukazovateľov reliéfu, krajinnej pokrývky, vodných tokov,
povodňového ohrozenia a staníc SHMÚ pre obce Slovenska. Prvá verzia: okres Stará Ľubovňa.

Autor: Šimon Lešiga (osobný projekt).

## Štruktúra

```
voda-a-krajina/
├─ config/
│  ├─ config.yaml          # okresy, cesty k dátam, názvy vrstiev a stĺpcov, parametre
│  └─ stanice_shmu.csv     # ručné doplnky/opravy staníc SHMÚ (voliteľné)
├─ scripts/                # spracovanie v Pythone (poradie nižšie)
├─ data_raw/               # stiahnuté dáta – NIE sú v gite
├─ data_work/              # medzivýsledky – NIE sú v gite
└─ docs/                   # web (GitHub Pages)
   ├─ index.html, zdroje.html, prompt.html, kes.html, diela.html, css/, js/, vendor/ (leaflet, pptxgenjs)
   ├─ data/                # výstup 10_export_web.py (okresy.json + priečinok na okres)
   └─ generator/           # generátor promptu pre texty o obciach (index.html, obce.json)
```

## Inštalácia (Windows, Anaconda Prompt)

```bat
cd /d C:\projekty\voda-a-krajina
conda env create -f environment.yml
conda activate vodakrajina
```

## Vstupné dáta (stiahnuť do Stiahnutých súborov, potom `00_priprav_data.py`)

| Dáta | Odkaz |
|---|---|
| Hranice obcí (GKÚ, CC BY 4.0) | https://opendata.skgeodesy.sk/static/ZBGIS/usj/ah_gpkg_0.zip |
| DMR 3.5, 10 m (GKÚ, CC BY 4.0) | https://opendata.skgeodesy.sk/static/DMR3_5/dmr3_5-10.zip |
| Vodné toky INSPIRE Hydrografia (GKÚ, CC BY 4.0) | https://opendata.skgeodesy.sk/static/INSPIRE/Hydrography/inspire_hy_gpkg.zip |
| ESA WorldCover 2021 (CC BY 4.0) – priamo do `data_raw\worldcover\` | https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_N48E018_Map.tif (a N48E021) |

Záplavové územie Q100 (SVP) a polohy staníc SHMÚ si stiahnu skripty 05 a 06 samy.

## Spracovanie

```bat
python scripts\00_priprav_data.py   # rozbalí archívy zo Stiahnutých súborov do data_raw
python scripts\00_inspect.py        # prehľad vrstiev a stĺpcov -> data_work\inspect_report.txt
python scripts\01_obce.py           # obce okresu, výmera
python scripts\02_relief.py         # výšky, sklony, sklonové triedy (DMR 3.5)
python scripts\03_pokryvka.py       # krajinná pokrývka (WorldCover)
python scripts\04_toky.py           # dĺžka a hustota tokov, hlavné toky
python scripts\05_povodne.py        # záplavové územie Q100 (SVP)
python scripts\06_stanice.py        # najbližšie stanice SHMÚ
python scripts\07_krajina.py        # krajinné metriky (PyLandStats, WorldCover)
python scripts\10_export_web.py     # dáta pre web do docs\data
python scripts\11_obce_sr.py        # zoznam všetkých obcí SR pre stránku Prompt pre AI
python scripts\12_kes.py            # KES katastrálnych území (ÚHDP z ÚGKK + hranice k. ú.)
```

Každý skript 01–07 dopĺňa kontrolnú vrstvu `data_work\<okres>\obce_ukazovatele.gpkg` (otvoriť v QGIS).
Ďalší okres: doplniť ho do `config.yaml` (sekcia `okresy`) a spustiť skripty znova.

## Stránka „Prompt pre AI“ (docs/prompt.html)

Pre ktorúkoľvek obec Slovenska vytvorí prompt pre AI asistenta na spracovanie rozboru (širšie vzťahy,
geomorfológia, klíma, hydrológia, história …). Obsahuje údaje o obci, ukazovatele portálu (ak ich okres má),
odporúčané zdroje a pravidlá (nevymýšľať údaje, citovať zdroje, neoverené označiť [OVERIŤ]).
Kapitoly, účely a zdroje sa upravujú v `docs/js/ai-temy.js`.

## Stránka „Koeficient ekologickej stability“ (docs/kes.html)

KES = S / L pre všetkých 3 559 katastrálnych území SR z úhrnných hodnôt druhov pozemkov (ÚGKK SR,
stav k 1. 1. 2026). Zaradenie druhov pozemkov do stabilných (S) a labilných (L) sa dá na stránke meniť,
interpretácia podľa Míchala (1982). Záložka „Vlastný výpočet“ počíta KES z vlastných plôch prvkov SKŠ
(lesy, polia, lúky, cesty…) s exportom do Excelu/CSV.

## Stránka „Vodné diela s energetickým využitím“ (docs/diela.html)

Podklady k Programu č. 4 (vodná stavba s energetickým využitím): výber z 31 vodných elektrární SR (alebo náhodné,
alebo vlastné dielo) a tri výstupy – **prezentácia .pptx** vytvorená v prehliadači (PptxGenJS), **prompt pre AI**
a **odkazy** na zdroje, mapy, fotky a médiá. Štýl prezentácie = farebná téma (8) × rozloženie (4) × tón (3) × kód variantu,
takže prezentácie sa medzi študentmi líšia. Údaje o dielach sú ručne zostavené v `docs/data/vodne_diela.json`
(zdroj pri každom diele, neoverené hodnoty označené [OVERIŤ]); témy, formulácie a texty o turbínach a vplyvoch sú
v `docs/js/diela-styly.js`. Deep link: `diela.html#dielo=orava&tema=retro&rozl=pruh&ton=vecny&rozsah=kompaktna&v=K7Q2`.

## Generátor promptu (docs/generator/)

Samostatná stránka: používateľ vyberie obec, účel textu, kapitoly a rozsah a stránka poskladá prompt
pre AI (napr. sprievodná správa projektu). Zoznam obcí `obce.json` (kód, okres, približné ťažisko,
orientačná výmera) je odvodený z číselníka ŠÚ SR a Eurostat LAU.

## Web na vlastnom počítači

```bat
python -m http.server 8000 -d docs
```
Potom otvoriť v prehliadači http://localhost:8000 (súbor `index.html` priamo z disku nefunguje).

## Zverejnenie (GitHub Pages)

GitHub → repozitár → Settings → Pages → Source: *Deploy from a branch*, Branch: `main`, priečinok `/docs` → Save.
Web bude na adrese https://simonsl-code.github.io/voda-a-krajina/

## Zdroje dát a licencie

Podrobne na stránke `docs/zdroje.html`. Kód: licencia MIT. Odvodené dáta v `docs/data/`:
CC BY 4.0 s uvedením pôvodných zdrojov. Leaflet: BSD-2-Clause (`docs/vendor/leaflet/LICENSE`).
PptxGenJS 4.0.1: MIT (`docs/vendor/pptxgenjs/LICENSE`, obsahuje JSZip – MIT/GPL-3.0).
Údaje o vodných elektrárňach: Slovenské elektrárne, a.s., Energetická politika SR 2013 (príloha 15), gabcikovo.gov.sk, SVP, š. p., TASR, ÚRSO – podrobne v `docs/zdroje.html#vodne-diela`.
