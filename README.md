# Voda a krajina v obciach

Interaktívna mapa ukazovateľov reliéfu, krajinnej pokrývky, vodných tokov,
povodňového ohrozenia a staníc SHMÚ pre obce Slovenska. Prvá verzia: okres Stará Ľubovňa.

Autor: Šimon Lešiga (osobný projekt).

## Štruktúra

```
voda-a-krajina/
├─ README.md, LICENSE, environment.yml, .gitignore
├─ config/
│  ├─ config.yaml          # cesty k dátam, názvy vrstiev a stĺpcov, zoznam okresov
│  └─ stanice_shmu.csv     # ručne zostavený zoznam staníc SHMÚ
├─ scripts/                # spracovanie v Pythone (00_inspect.py, 01_… atď.)
├─ data_raw/               # stiahnuté dáta – NIE sú v gite
├─ data_work/              # medzivýsledky – NIE sú v gite
└─ docs/                   # web (GitHub Pages): index.html, css/, js/, data/*.geojson
   └─ generator/           # generátor promptu pre texty o obciach (index.html, obce.json)
```

## Inštalácia (Windows, Anaconda Prompt)

```bat
cd C:\Projekty\voda-a-krajina
conda env create -f environment.yml
conda activate vodakrajina
python scripts/00_inspect.py
```

## Zdroje dát a licencie

Zoznam zdrojov a povinné citácie sú uvedené na stránke portálu (sekcia „Zdroje dát“)
a v súbore `docs/zdroje.html`.

Kód: licencia MIT. Odvodené dáta v `docs/data/`: CC BY 4.0 s uvedením pôvodných zdrojov.

## Generátor promptu

`docs/generator/` je samostatná stránka: používateľ vyberie obec, účel textu, kapitoly a rozsah
a stránka poskladá prompt pre AI (napr. sprievodná správa projektu). Zoznam obcí `obce.json`
(kód, okres, približné ťažisko, orientačná výmera) je odvodený z číselníka ŠÚ SR a Eurostat LAU.
