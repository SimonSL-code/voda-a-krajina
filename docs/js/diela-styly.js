/* Vodné diela – štýly prezentácie a textové varianty. Autor: Šimon Lešiga. Licencia kódu: MIT.
   Každá prezentácia = téma (farby, písma) × rozloženie × tón × kód variantu (seed).
   Kód variantu vyberá formulácie, kompozíciu titulky a podobu jednotlivých snímok,
   takže dvaja ľudia s rovnakým dielom nedostanú rovnakú prezentáciu. */
/* exported DIELA_TEMY, DIELA_ROZLOZENIA, DIELA_TONY, DIELA_TEXTY, DIELA_TYPY, DIELA_TURBINY, DIELA_VPLYVY */

// Písma sú bežne dostupné vo Windows / Microsoft Office, aby sa prezentácia zobrazila rovnako.
const DIELA_TEMY = [
  { id: "dunaj", nazov: "Dunaj", popis: "čistá modrá, svetlé pozadie",
    bg: "FFFFFF", text: "1D2A33", tlmeny: "5B6B76", primarna: "0B4F6C", akcenty: ["2A9DCB", "1F7A8C", "4FB3BF"], karta: "EAF3F7", naPrimarnej: "FFFFFF",
    pismoN: "Segoe UI Semibold", pismoT: "Segoe UI", css: "'Segoe UI', system-ui, sans-serif" },
  { id: "beton", nazov: "Betón a oceľ", popis: "sivá stavba, oranžový akcent",
    bg: "F2F0EC", text: "2B2B2B", tlmeny: "6B6862", primarna: "3A3A3A", akcenty: ["E07A1F", "D35400", "C9A227"], karta: "E4E1DA", naPrimarnej: "FFFFFF",
    pismoN: "Bahnschrift SemiBold", pismoT: "Bahnschrift", css: "Bahnschrift, 'DIN Alternate', 'Arial Narrow', sans-serif" },
  { id: "vykres", nazov: "Technický výkres", popis: "tmavomodrý „blueprint“",
    bg: "0E2A47", text: "EAF2FA", tlmeny: "A9C1D9", primarna: "16395F", akcenty: ["7FD1FF", "FFD166", "9BE7C4"], karta: "15365A", naPrimarnej: "EAF2FA",
    pismoN: "Bahnschrift", pismoT: "Segoe UI", tmava: true, mriezka: true, css: "Bahnschrift, 'Segoe UI', sans-serif" },
  { id: "les", nazov: "Les a voda", popis: "zelená krajina, tyrkysová voda",
    bg: "F4F8F1", text: "22301F", tlmeny: "5E6E59", primarna: "2F5D3A", akcenty: ["3E9BB0", "7FA650", "D9A441"], karta: "E3EDDD", naPrimarnej: "FFFFFF",
    pismoN: "Georgia", pismoT: "Calibri", css: "Georgia, serif" },
  { id: "minimal", nazov: "Minimal", popis: "biela, čierna a jedna farba",
    bg: "FFFFFF", text: "111111", tlmeny: "6E6E6E", primarna: "111111", akcenty: ["D62828", "0066FF", "00A676"], karta: "F3F3F3", naPrimarnej: "FFFFFF",
    pismoN: "Arial Black", pismoT: "Arial", css: "'Arial Black', Arial, sans-serif" },
  { id: "noc", nazov: "Nočná priehrada", popis: "tmavé pozadie, svietiaca tyrkysová",
    bg: "111A22", text: "E6EDF2", tlmeny: "93A4B1", primarna: "1B2A36", akcenty: ["2EC4B6", "F4A259", "8AB4F8"], karta: "1C2B37", naPrimarnej: "E6EDF2",
    pismoN: "Segoe UI Light", pismoT: "Segoe UI", tmava: true, css: "'Segoe UI', system-ui, sans-serif" },
  { id: "retro", nazov: "Retro 50. roky", popis: "krémová, tehlová – éra Vážskej kaskády",
    bg: "F3E9D2", text: "3B2A20", tlmeny: "7A6655", primarna: "8C2F1B", akcenty: ["2E5E6E", "C08A2D", "5B7F3A"], karta: "EADBB8", naPrimarnej: "F3E9D2",
    pismoN: "Rockwell", pismoT: "Cambria", css: "Rockwell, 'Roboto Slab', Cambria, serif" },
  { id: "akademia", nazov: "Akademická", popis: "bordová, sivá, pätkové písmo",
    bg: "FFFFFF", text: "222222", tlmeny: "666666", primarna: "7A1F2B", akcenty: ["4A6FA5", "B08D57", "7A1F2B"], karta: "F4F1EE", naPrimarnej: "FFFFFF",
    pismoN: "Cambria", pismoT: "Calibri", css: "Cambria, Georgia, serif" },
];

const DIELA_ROZLOZENIA = [
  { id: "pruh", nazov: "Pruh vľavo", popis: "zvislý farebný pruh, nadpisy vľavo" },
  { id: "pas", nazov: "Horný pás", popis: "nadpis v plnom farebnom páse" },
  { id: "karty", nazov: "Karty", popis: "obsah v zaoblených kartách" },
  { id: "otvorene", nazov: "Vzdušné", popis: "veľké číslo kapitoly, veľa voľného miesta" },
];

const DIELA_TONY = [
  { id: "vecny", nazov: "Vecný technický", popis: "stručne, parametre a fakty" },
  { id: "popular", nazov: "Popularizačný", popis: "pre spolužiakov, s pointou" },
  { id: "kriticky", nazov: "Kritický / diskusný", popis: "pre a proti, otázky na diskusiu" },
];

// Nadpisy snímok – viac formulácií, vyberá ich kód variantu.
const DIELA_TEXTY = {
  nadpisy: {
    co: ["Čo je to za stavbu", "Predstavenie diela", "Dielo v skratke", "Základné údaje"],
    zaujimavosti: ["Zaujímavosti", "Vedeli ste, že…", "Čo stojí za zmienku"],
    funkcie: ["Význam a funkcie", "Na čo dielo slúži", "Úlohy vodného diela"],
    dispozicia: ["Dispozičné riešenie a objektová skladba", "Usporiadanie diela", "Ako je dielo usporiadané"],
    energia: ["Energetické využitie", "Výroba elektriny", "Elektráreň v číslach"],
    turbiny: ["Prečo práve tieto turbíny", "Voľba turbín", "Turbíny a ich typ"],
    parametre: ["Technické parametre", "Parametre elektrárne", "Prehľad parametrov"],
    kaskada: ["Súvislosti a kaskáda", "Dielo v sústave", "Kde dielo leží v sústave"],
    objekty: ["Vzdúvadlo a ďalšie objekty", "Ďalšie objekty diela", "Hať, rybovod a spol."],
    vplyv: ["Vplyv na okolité prostredie", "Pozitíva a negatíva", "Dielo a krajina"],
    nazor: ["Názor obyvateľov", "Čo si myslia ľudia z okolia", "Pohľad miestnych"],
    zdroje: ["Zdroje", "Použité zdroje", "Literatúra a zdroje"],
    zaver: ["Zhrnutie", "Na záver", "Čo si zapamätať"],
    dakujem: ["Ďakujem za pozornosť", "Ďakujem", "Otázky?"],
  },
  // Úvodné vety podľa tónu; {n} = názov, {t} = tok, {o} = oblasť, {r} = rok
  uvod: {
    vecny: ["{n} je vodná elektráreň na toku {t} ({o}).", "{n} – vodná elektráreň na toku {t}, oblasť {o}.", "Predmetom prezentácie je {n} na toku {t}."],
    popular: ["Keď sa povie {t}, mnohí si nespomenú, že tu vyrába elektrinu {n}.", "{n} ukazuje, ako sa z rieky {t} stáva zdroj elektriny.", "Poďme sa pozrieť, čo skrýva {n} v regióne {o}."],
    kriticky: ["{n} je príkladom toho, ako energetika mení tok {t}.", "Prínosy aj daň za ne – {n} na toku {t}.", "{n}: elektrina z rieky {t}, ale za akú cenu pre krajinu?"],
  },
  vplyvUvod: {
    vecny: ["Hodnotenie vplyvov (všeobecne pre daný typ, konkrétne overiť).", "Prehľad hlavných vplyvov podľa typu elektrárne."],
    popular: ["Každá priehrada či kanál niečo dáva a niečo berie.", "Rieka po výstavbe už nie je tá istá – čo sa zlepšilo a čo nie?"],
    kriticky: ["Bilancia prínosov a strát – na diskusiu.", "Je to stále „zelená“ energia? Zvážte pozitíva aj negatíva."],
  },
  zaver: {
    vecny: ["{n}: {v} MW, {g} GWh ročne, uvedená do prevádzky {r}.", "Kľúčové údaje: výkon {v} MW, priemerná výroba {g} GWh/rok."],
    popular: ["{n} vyrobí ročne približne {g} GWh – a robí to už od roku {r}.", "Malá lekcia z hydroenergetiky: {v} MW z rieky {t}."],
    kriticky: ["Otázka na diskusiu: vyvažuje {g} GWh ročne zásahy do toku {t}?", "Na zamyslenie: postavili by sme {n} aj dnes?"],
  },
  nazorTipy: [
    "krátka anketa (5–10 ľudí z okolia, rodina, známi)",
    "diskusie a články v regionálnych médiách",
    "stanovisko obce, rybárov, ochranárov, prevádzkovateľa",
    "pamätníci výstavby (vysídlenie, zmena krajiny – ak sa týka)",
    "rekreácia, ryby, povodne, vzhľad krajiny – čo ľudí zaujíma",
  ],
};

const DIELA_TYPY = {
  kanalova: { nazov: "derivačná (kanálová) vodná elektráreň",
    popis: "Vzdúvací objekt odvádza vodu z toku do derivačného kanála, ktorý sústreďuje spád. Elektráreň stojí na kanáli a voda sa odpadovým kanálom vracia do toku.",
    rezim: "podľa riadenia kaskády – prevažne podľa prietoku s možnosťou špičkovania [OVERIŤ]" },
  priehradova: { nazov: "priehradová vodná elektráreň",
    popis: "Spád vytvára priehrada (hrádza) s nádržou. Elektráreň stojí pri hrádzi alebo pod ňou a nádrž umožňuje akumuláciu vody.",
    rezim: "akumulačný – nádrž umožňuje sústrediť výrobu do špičky [OVERIŤ konkrétny režim]" },
  prietocna: { nazov: "prietočná vodná elektráreň",
    popis: "Využíva bežný prietok toku bez väčšej akumulácie; spád vytvára hať alebo nízky stupeň, prípadne vyrovnávacia nádrž.",
    rezim: "prietočný – výroba podľa aktuálneho prietoku [OVERIŤ]" },
  precerpavacia: { nazov: "prečerpávacia vodná elektráreň",
    popis: "Pri prebytku elektriny čerpá vodu z dolnej do hornej nádrže, v čase špičky ju turbínami vracia späť. Funguje ako veľká „batéria“ elektrizačnej sústavy.",
    rezim: "špičkový – výroba v čase vysokého dopytu, čerpanie pri prebytku" },
  ine: { nazov: "vodná elektráreň ako súčasť vodného diela",
    popis: "Presné usporiadanie diela (priehradové, derivačné…) treba overiť v zdrojoch.",
    rezim: "[OVERIŤ]" },
};

// Všeobecné vysvetlenie typov turbín (učebnicové poznatky, nie údaje o konkrétnom diele).
const DIELA_TURBINY = [
  { kluc: /pelton/i, nazov: "Peltonova turbína",
    preco: ["rovnotlaková turbína – voda dopadá z dýz na lopatky (korčeky) obežného kolesa",
            "pre veľmi vysoké spády a malé prietoky (horské toky, privádzače)",
            "dobrá účinnosť aj pri čiastočnom zaťažení (regulácia počtom dýz)"] },
  { kluc: /b[áa]nki|crossflow|priečnoprietočn/i, nazov: "Bánkiho (priečnoprietočná) turbína",
    preco: ["rovnotlaková turbína s priečnym prietokom obežným kolesom",
            "jednoduchá a lacná konštrukcia – typická pre malé vodné elektrárne",
            "znesie široký rozsah prietokov, menej citlivá na nečistoty"] },
  { kluc: /d[ée]riaz|diagon/i, nazov: "Dériazova (diagonálna) turbína",
    preco: ["natáčavé lopatky ako pri Kaplanovej turbíne, ale šikmý (diagonálny) prietok obežným kolesom",
            "vhodná ako reverzibilná čerpadlová turbína pri stredných a premenlivých spádoch",
            "v prečerpávacej elektrárni jeden stroj vyrába aj čerpá"] },
  { kluc: /troj|čerpadl/i, nazov: "Trojstrojové usporiadanie",
    preco: ["turbína, motorgenerátor a čerpadlo na jednej osi",
            "turbína aj čerpadlo sú optimalizované každé na svoju úlohu",
            "starší, ale spoľahlivý koncept prečerpávacích elektrární"] },
  { kluc: /francis/i, nazov: "Francisova turbína",
    preco: ["pretlaková radiálno-axiálna turbína pre stredné až vysoké spády",
            "vysoká účinnosť pri návrhovom prietoku",
            "ako reverzibilná funguje pri opačnom chode ako čerpadlo – preto je typická pre prečerpávacie elektrárne"] },
  { kluc: /horizont|priamopr|kolen/i, nazov: "Horizontálna Kaplanova turbína",
    preco: ["horizontálne (priamoprúdové alebo kolenové) usporiadanie pri malých spádoch",
            "jednoduchšia a lacnejšia stavebná časť – typické pre malé vodné elektrárne",
            "natáčavé lopatky udržia účinnosť pri meniacom sa prietoku"] },
  { kluc: /kaplan/i, nazov: "Kaplanova turbína",
    preco: ["pretlaková axiálna turbína pre nízke spády a veľké prietoky – typické pre nížinné a podhorské rieky",
            "natáčavé lopatky obežného kolesa aj rozvádzača (dvojitá regulácia)",
            "vysoká účinnosť aj pri premenlivom prietoku a spáde"] },
];

const DIELA_VPLYVY = {
  spolocne: {
    plus: ["výroba elektriny bez priamych emisií CO₂", "domáci obnoviteľný zdroj s rýchlym nábehom – pomáha stabilizovať sústavu"],
    minus: ["prerušenie pozdĺžnej kontinuity toku (migrácia rýb, posun splavenín)", "zmena charakteru rieky – úsek jazerného alebo kanálového typu"],
  },
  priehradova: {
    plus: ["zachytávanie povodňových vĺn", "nadlepšovanie prietokov v suchom období", "rekreácia a rybárstvo"],
    minus: ["zatopené územie (pôda, biotopy, prípadne obce)", "zanášanie nádrže sedimentmi", "zmena teplotného a kyslíkového režimu pod nádržou"],
  },
  kanalova: {
    plus: ["sústredenie spádu bez veľkej nádrže", "kanál môže slúžiť aj pre plavbu či odvedenie veľkých vôd (ak je tak navrhnutý)"],
    minus: ["malý prietok v starom koryte", "zmena hladiny podzemnej vody v okolí", "kanál ako bariéra v krajine (fragmentácia)"],
  },
  prietocna: {
    plus: ["menší zásah do krajiny, bez veľkej akumulácie", "vyrovnávanie odtoku pod špičkovou elektrárňou (pri vyrovnávacej nádrži)"],
    minus: ["hať bez rybovodu bráni migrácii rýb", "skracovanie voľne tečúcich úsekov rieky"],
  },
  precerpavacia: {
    plus: ["akumulácia elektriny – pomáha využiť slnečné a veterné zdroje", "podporné služby a záloha pre elektrizačnú sústavu"],
    minus: ["cyklus čerpanie–výroba má straty (čistý spotrebiteľ energie)", "rozsiahle stavby a horná nádrž v horskom prostredí", "rýchle kolísanie hladín v nádržiach"],
  },
  ine: { plus: [], minus: [] },
  spickova: "špičková prevádzka spôsobuje kolísanie prietokov pod elektrárňou (tzv. hydropeaking)",
};
