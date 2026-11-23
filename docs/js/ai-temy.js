/* Kapitoly (témy) pre generátor promptu. Upravuj tu: id, nazov, co (čo má AI spracovať),
   zdroje (odporúčané zdroje; url uvádzaj len overené, inak len názov inštitúcie/diela),
   predvolene (true = zaškrtnuté pri prvom otvorení). */
window.AI_TEMY = [
  {
    id: "sirsie", nazov: "Širšie vzťahy a poloha", predvolene: true,
    co: "poloha obce v rámci kraja, okresu a regiónu, susedné obce, dopravné napojenie, poloha v povodí, väzby na nadradenú územnoplánovaciu dokumentáciu (ÚPN VÚC)",
    zdroje: [
      { nazov: "MAPKA – mapový portál katastra a ZBGIS (ÚGKK SR)", url: "https://zbgis.skgeodesy.sk/mapka/" },
      { nazov: "Územný plán veľkého územného celku (ÚPN VÚC) príslušného kraja" },
    ],
  },
  {
    id: "geomorf", nazov: "Geomorfologické pomery a reliéf", predvolene: true,
    co: "geomorfologické členenie (sústava, provincia, oblasť, celok, podcelok), typ reliéfu, výškové pomery, sklonitosť a jej význam pre využitie územia a odtok",
    zdroje: [
      { nazov: "ŠGÚDŠ – Geomorfologické členenie Slovenska 1 : 50 000 (Kočický, Ivanič 2011) a ďalšie mapy", url: "https://www.geology.sk/maps-and-data/" },
      { nazov: "Digitálny model reliéfu DMR 5.0 / DMR 3.5 (ÚGKK SR, GKÚ)" },
    ],
  },
  {
    id: "geologia", nazov: "Geologické a inžinierskogeologické pomery", predvolene: false,
    co: "geologická stavba, horninové prostredie, kvartérne sedimenty, svahové deformácie (zosuvy), inžinierskogeologické podmienky pre výstavbu",
    zdroje: [
      { nazov: "ŠGÚDŠ – Geologická mapa SR 1 : 50 000, mapy svahových deformácií a ďalšie mapy", url: "https://www.geology.sk/maps-and-data/" },
    ],
  },
  {
    id: "hydrogeo", nazov: "Hydrogeologické pomery", predvolene: false,
    co: "typ priepustnosti hornín, podzemné vody, pramene, vodárenské zdroje a ich ochranné pásma, minerálne a geotermálne vody",
    zdroje: [
      { nazov: "ŠGÚDŠ – Hydrogeologická mapa SR 1 : 50 000 a 1 : 200 000", url: "https://www.geology.sk/maps-and-data/" },
    ],
  },
  {
    id: "pody", nazov: "Pôdne pomery", predvolene: false,
    co: "pôdne typy a druhy, bonitované pôdno-ekologické jednotky (BPEJ), ohrozenie pôdy eróziou a zhutnením, ochrana poľnohospodárskej pôdy",
    zdroje: [
      { nazov: "NPPC – Výskumný ústav pôdoznalectva a ochrany pôdy (BPEJ, pôdne mapy)" },
      { nazov: "ŠGÚDŠ – Geochemický atlas SR, časť V: Pôdy", url: "http://app.geology.sk/atlaspody" },
    ],
  },
  {
    id: "klima", nazov: "Klimatické pomery", predvolene: true,
    co: "klimatická oblasť a okrsok, priemerné teploty, zrážky, snehová pokrývka, výpar, extrémy; údaje najbližšej stanice SHMÚ; očakávané dopady zmeny klímy",
    zdroje: [
      { nazov: "Slovenský hydrometeorologický ústav (SHMÚ)", url: "https://www.shmu.sk" },
      { nazov: "SHMÚ – otvorené údaje (CC BY 4.0)", url: "https://opendata.shmu.sk" },
      { nazov: "ŠGÚDŠ – Klimaticko-geografické typy", url: "https://www.geology.sk/maps-and-data/" },
    ],
  },
  {
    id: "hydro", nazov: "Hydrologické pomery", predvolene: true,
    co: "hydrografická sieť, povodie a čiastkové povodie, hlavné toky a ich správca, hustota riečnej siete, hydrologické charakteristiky (priemerný prietok Qa, M-denné prietoky, N-ročné prietoky) podľa najbližšej vodomernej stanice, vodné plochy a nádrže",
    zdroje: [
      { nazov: "SHMÚ – vodomerné stanice", url: "https://www.shmu.sk/sk/?page=1&id=hydro_vod_all" },
      { nazov: "SHMÚ – Hydrologická ročenka" },
      { nazov: "Vodné toky ZBGIS (ÚGKK SR, GKÚ)", url: "https://zbgis.skgeodesy.sk/mapka/" },
    ],
  },
  {
    id: "povodne", nazov: "Povodňové ohrozenie a prírodné riziká", predvolene: true,
    co: "záplavové územia (Q5–Q1000) podľa máp povodňového ohrozenia, historické povodne, prívalové povodne z malých povodí, povodňový plán obce, svahové deformácie a iné riziká",
    zdroje: [
      { nazov: "SVP, š. p. – Mapy povodňového ohrozenia a mapy povodňového rizika", url: "https://mpompr.svp.sk" },
      { nazov: "Povodňový plán záchranných prác obce" },
    ],
  },
  {
    id: "krajina", nazov: "Súčasná krajinná štruktúra a využitie územia", predvolene: true,
    co: "zastúpenie lesa, ornej pôdy, trvalých trávnych porastov a zastavaných plôch, prvky nelesnej drevinovej vegetácie, zmeny využitia krajiny, ekologická stabilita",
    zdroje: [
      { nazov: "ESA WorldCover 2021 (10 m, CC BY 4.0)", url: "https://worldcover2021.esa.int" },
      { nazov: "LPIS a kataster nehnuteľností – vrstvy v aplikácii MAPKA", url: "https://zbgis.skgeodesy.sk/mapka/" },
    ],
  },
  {
    id: "priroda", nazov: "Biota, ochrana prírody a územný systém ekologickej stability", predvolene: false,
    co: "potenciálna prirodzená vegetácia, chránené územia národnej sústavy, územia Natura 2000, prvky ÚSES (RÚSES, MÚSES), chránené druhy a biotopy",
    zdroje: [
      { nazov: "Štátna ochrana prírody SR (ŠOP SR) – mapy chránených území a Natura 2000" },
      { nazov: "Enviroportál (MŽP SR)", url: "https://www.enviroportal.sk" },
    ],
  },
  {
    id: "historia", nazov: "História osídlenia a historický vývoj krajiny", predvolene: false,
    co: "prvá písomná zmienka, vývoj osídlenia a hospodárstva, historické využitie krajiny podľa vojenských mapovaní (1. až 3.) a katastrálnych máp, zaniknuté prvky (mlyny, náhony, rybníky)",
    zdroje: [
      { nazov: "Mapire – historické mapy Habsburskej monarchie", url: "https://mapire.eu" },
      { nazov: "Arcanum Maps – historické mapy", url: "https://maps.arcanum.com/sk/" },
      { nazov: "Vlastivedný slovník obcí na Slovensku (VEDA, 1977–1978)" },
    ],
  },
  {
    id: "pamiatky", nazov: "Kultúrne dedičstvo", predvolene: false,
    co: "národné kultúrne pamiatky, pamiatkové zóny, archeologické náleziská, pamätihodnosti obce",
    zdroje: [
      { nazov: "Pamiatkový úrad SR – Ústredný zoznam pamiatkového fondu" },
    ],
  },
  {
    id: "obyvatelstvo", nazov: "Obyvateľstvo a sídelná štruktúra", predvolene: false,
    co: "počet a vývoj obyvateľov, veková štruktúra, štruktúra sídla a jeho časti, občianska vybavenosť",
    zdroje: [
      { nazov: "Štatistický úrad SR – DATAcube", url: "https://datacube.statistics.sk" },
      { nazov: "Sčítanie obyvateľov, domov a bytov 2021 (ŠÚ SR)" },
    ],
  },
  {
    id: "upd", nazov: "Územnoplánovacia dokumentácia a limity využitia územia", predvolene: false,
    co: "územný plán obce, nadradená dokumentácia, ochranné pásma (vodné zdroje, toky, infraštruktúra), chránené územia, ďalšie limity pre zámer",
    zdroje: [
      { nazov: "Územný plán obce (web obce alebo obecný úrad)" },
      { nazov: "Územný plán VÚC príslušného kraja" },
    ],
  },
  {
    id: "opatrenia", nazov: "Návrh vodozádržných a adaptačných opatrení", predvolene: false,
    co: "návrh opatrení na zadržiavanie vody v krajine a v sídle (prírode blízke opatrenia na tokoch, protierózne opatrenia, modro-zelená infraštruktúra, dažďové záhrady, revitalizácia tokov), zdôvodnené zisteniami z predchádzajúcich kapitol",
    zdroje: [
      { nazov: "Údaje z kapitol vyššie (reliéf, pôdy, klíma, hydrológia, povodne, využitie územia)" },
    ],
  },
];

window.AI_UCELY = [
  { id: "pr", nazov: "kapitola Prieskumy a rozbory (štúdia, územný plán)" },
  { id: "ts", nazov: "sprievodná / technická správa projektu" },
  { id: "skola", nazov: "seminárna alebo záverečná práca" },
  { id: "dotacia", nazov: "projektový zámer / žiadosť o dotáciu" },
  { id: "prehlad", nazov: "stručný prehľad obce pre verejnosť" },
];

window.AI_ROZSAHY = [
  { id: "strucne", nazov: "stručne (1 odsek na kapitolu)" },
  { id: "stredne", nazov: "štandardne (cca pol strany na kapitolu)" },
  { id: "podrobne", nazov: "podrobne (1 a viac strán na kapitolu)" },
];
