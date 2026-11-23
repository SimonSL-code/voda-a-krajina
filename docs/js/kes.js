/* Koeficient ekologickej stability (KES = S / L) katastrálnych území. Autor: Šimon Lešiga. Licencia kódu: MIT. */
(function () {
  "use strict";

  const DATA = "data/kes/";
  const MOBIL = window.matchMedia("(max-width: 760px)");
  const ULOZ_ZARADENIE = "vk-kes-zaradenie-v2";
  const ULOZ_VLASTNY = "vk-kes-vlastny-v2";

  // Druhy pozemkov katastra a ich predvolené zaradenie (S = stabilné, L = labilné).
  // overene: zaradenie zodpovedá zadaniu cvičenia (S: lesy, krovinné formácie, záhrady, vinice, potoky;
  // L: objekty bývania, priemyselné areály, dopravné línie) alebo Míchalovmu zoznamu (lúky, pasienky = S; orná pôda = L).
  const DRUHY = [
    { k: "orna", nazov: "orná pôda", sl: "L", overene: true },
    { k: "chmel", nazov: "chmeľnica", sl: "L" },
    { k: "vinica", nazov: "vinica", sl: "S", overene: true },
    { k: "zahrada", nazov: "záhrada", sl: "S", overene: true },
    { k: "sad", nazov: "ovocný sad", sl: "S", overene: true },
    { k: "ttp", nazov: "trvalý trávny porast", sl: "S", overene: true },
    { k: "les", nazov: "lesný pozemok", sl: "S", overene: true },
    { k: "voda", nazov: "vodná plocha", sl: "S", overene: true },
    { k: "zast", nazov: "zastavaná plocha a nádvorie", sl: "L", overene: true },
    { k: "ost", nazov: "ostatná plocha", sl: "L" },
  ];

  // Stupnica KES podľa Míchala (1992), znenie podľa zadania cvičenia. Trieda > 3,00 v zadaní nie je.
  const TRIEDY = [
    { do: 0.10, farba: "#c0392b", nazov: "< 0,10", popis: "územie s maximálnym narušením prírodných štruktúr, základné ekologické funkcie musia byť intenzívne a trvalo nahrádzané technickými zásahmi" },
    { do: 0.30, farba: "#e67e22", nazov: "0,10 – 0,30", popis: "územie nadpriemerne využívané, so zreteľným narušením prírodných štruktúr, základné ekologické funkcie musia byť sústavne nahrádzané technickými zásahmi" },
    { do: 1.00, farba: "#e9c46a", nazov: "0,30 – 1,00", popis: "územie intenzívne využívané, najmä poľnohospodárskou veľkovýrobou, oslabenie autoregulačných pochodov v agroekosystémoch spôsobuje ich značnú ekologickú labilitu a vyžaduje vysoké vklady dodatkovej energie" },
    { do: 3.00, farba: "#8cc265", nazov: "1,00 – 3,00", popis: "vcelku vyvážená krajina, v ktorej sú technické objekty relatívne v súlade s dochovanými prírodnými štruktúrami, dôsledkom je i nižšia potreba energomateriálových vkladov" },
    { do: Infinity, farba: "#2f7d32", nazov: "> 3,00", popis: "nad rozsahom stupnice uvedenej v zadaní – stabilné plochy výrazne prevažujú nad labilnými", mimo: true },
  ];

  // Koeficienty krajinnoekologickej významnosti kpi (Izakovičová, Kartusek 1991) – hodnoty zo zadania cvičenia.
  const KPI = [
    { id: "les", nazov: "lesy", k: 1 },
    { id: "krovie", nazov: "krovinatý porast", k: 0.5 },
    { id: "luky", nazov: "lúky", k: 0.65 },
    { id: "pasienky", nazov: "pasienky", k: 0.7 },
    { id: "luky_pasienky", nazov: "lúky a pasienky spolu (priemer 0,65 a 0,7)", k: 0.675, odvodene: true },
    { id: "polia", nazov: "polia", k: 0.15 },
    { id: "zahrady", nazov: "záhrady a ovocné sady", k: 0.5 },
    { id: "vinice", nazov: "vinice", k: 0.5 },
    { id: "luka_obm", nazov: "lúka s obmedzeným využitím (trávno-bylinné porasty sídelnej vegetácie)", k: 0.05 },
    { id: "tok_prir", nazov: "prírodný tok", k: 0.8 },
    { id: "tok_umel", nazov: "umelý tok", k: 0.5 },
    { id: "byvanie", nazov: "zástavba rodinných a bytových domov (objekty bývania)", k: 0 },
    { id: "zelen", nazov: "verejná zeleň (sadové úpravy v zástavbe)", k: 0.4 },
    { id: "obc_vyb", nazov: "zariadenia občianskej vybavenosti", k: -0.2 },
    { id: "skolske", nazov: "zariadenia školské, výchovné a kultúrne", k: -0.1 },
    { id: "priemysel", nazov: "priemyselné areály", k: -0.6 },
    { id: "dialnica", nazov: "diaľnica", k: -0.6 },
    { id: "komunikacie", nazov: "ostatné komunikácie", k: -0.5 },
  ];
  const KPI_PODLA_ID = new Map(KPI.map((x) => [x.id, x]));

  // Kategórie ekologickej kvality priestorovej štruktúry (zadanie cvičenia)
  const KS_KATEGORIE = [
    { do: 0.30, farba: "#c0392b", nazov: "do 0,30", popis: "najmenej kvalitná štruktúra" },
    { do: 0.60, farba: "#e9a23b", nazov: "0,31 – 0,60", popis: "2. kategória kvality" },
    { do: 0.80, farba: "#8cc265", nazov: "0,61 – 0,80", popis: "3. kategória kvality" },
    { do: Infinity, farba: "#2f7d32", nazov: "nad 0,80", popis: "najviac kvalitná štruktúra" },
  ];

  const riadok = (nazov, sl, kpi, plocha = "") => ({ nazov, sl, kpi, plocha });
  const VLASTNE_PREDVOLENE = () => [
    riadok("Lesy", "S", "les"), riadok("Krovinatý porast (NDV)", "S", "krovie"), riadok("Lúky", "S", "luky"), riadok("Pasienky", "S", "pasienky"),
    riadok("Záhrady a ovocné sady", "S", "zahrady"), riadok("Vinice", "S", "vinice"), riadok("Prírodné toky", "S", "tok_prir"),
    riadok("Polia (orná pôda)", "L", "polia"), riadok("Objekty bývania", "L", "byvanie"), riadok("Priemyselné areály", "L", "priemysel"),
    riadok("Ostatné komunikácie", "L", "komunikacie"),
  ];

  // Príklad zo zadania: Tab. 1, k. ú. Dúbravka (Bratislava), rok 2004, ha
  const PRIKLAD_DUBRAVKA = () => [
    riadok("Listnaté lesy", "S", "les", "170,3"), riadok("Ihličnaté lesy", "S", "les", "25,4"),
    riadok("Nelesná drevinová vegetácia – plošná", "S", "krovie", "27,7"), riadok("Lúky a pasienky", "S", "luky_pasienky", "63,3"),
    riadok("Sady a záhrady", "S", "zahrady", "156,6"), riadok("Vinohrady", "S", "vinice", "8,9"),
    riadok("Orná pôda", "L", "polia", "57,7"), riadok("Zástavba rodinných domov", "L", "byvanie", "25,2"),
    riadok("Zástavba bytových domov", "L", "byvanie", "290,7"), riadok("Výrobné a priemyselné areály", "L", "priemysel", "21,7"),
    riadok("Cesty I. a II. triedy", "L", "komunikacie", "7,8"),
  ];

  const $ = (id) => document.getElementById(id);
  const nf = (d) => new Intl.NumberFormat("sk-SK", { minimumFractionDigits: d, maximumFractionDigits: d });
  const cislo = (v, d = 2) => (v === null || v === undefined || Number.isNaN(v) ? "–" : nf(d).format(v));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const bezDiakritiky = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const datum = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ""); return m ? `${+m[3]}. ${+m[2]}. ${m[1]}` : "–"; };
  const uloz = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* bez úložiska */ } };
  const nacitaj = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };

  const stav = {
    meta: null, ku: [], podlaKodu: new Map(), kraje: [], kraj: null, vrstva: null, vybrane: null,
    zaradenie: Object.assign(Object.fromEntries(DRUHY.map((d) => [d.k, d.sl])), nacitaj(ULOZ_ZARADENIE) || {}),
    vlastne: nacitaj(ULOZ_VLASTNY) || { jednotka: "ha", riadky: VLASTNE_PREDVOLENE() },
  };

  // ---------- výpočet ----------
  function kes(S, L) { return L > 0 ? S / L : (S > 0 ? Infinity : NaN); }
  function trieda(k) { return Number.isNaN(k) ? null : TRIEDY.find((t) => k < t.do) || TRIEDY[TRIEDY.length - 1]; }
  function kesFmt(k) { return k === Infinity ? "∞" : cislo(k, k < 0.1 ? 3 : 2); }
  function spocitajKu(z) {
    let S = 0, L = 0;
    for (const d of DRUHY) (stav.zaradenie[d.k] === "S" ? (S += z[d.k]) : (L += z[d.k]));
    return { S, L, K: kes(S, L) };
  }

  // ---------- mapa ----------
  const mapa = L.map("mapa", { zoomSnap: 0.25 });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">prispievatelia OpenStreetMap</a>',
  }).addTo(mapa);
  mapa.attributionControl.setPrefix('Hranice k. ú. a druhy pozemkov © ÚGKK SR / GKÚ · <a href="https://leafletjs.com">Leaflet</a>');

  function styl(f) {
    const z = stav.podlaKodu.get(f.properties.kod);
    const t = z ? trieda(spocitajKu(z).K) : null;
    const vybrane = stav.vybrane && stav.vybrane.kod === f.properties.kod;
    return { color: vybrane ? "#111" : "#4a5a64", weight: vybrane ? 3 : 0.7, fillColor: t ? t.farba : "#bbb", fillOpacity: 0.6 };
  }

  function legenda() {
    const c = L.control({ position: MOBIL.matches ? "topleft" : "bottomleft" });
    c.onAdd = () => {
      const d = L.DomUtil.create("div", "legenda");
      d.innerHTML = "<b>KES = S / L</b>" + TRIEDY.map((t) =>
        `<div class="riadok"><span class="stvorcek" style="background:${t.farba}"></span>${t.nazov}</div>`).join("");
      return d;
    };
    c.addTo(mapa);
  }

  async function nacitajKraj(id) {
    const k = stav.kraje.find((x) => x.id === id);
    if (!k) return;
    stav.kraj = id;
    $("kraj").value = String(id);
    if (stav.vrstva) mapa.removeLayer(stav.vrstva);
    const g = await fetch(DATA + k.subor).then((r) => r.json());
    stav.vrstva = L.geoJSON(g, {
      style: styl,
      onEachFeature: (f, l) => {
        const z = stav.podlaKodu.get(f.properties.kod);
        l.bindTooltip(() => {
          const z2 = stav.podlaKodu.get(f.properties.kod);
          return z2 ? `<b>${esc(z2.nazov)}</b><br>KES ${kesFmt(spocitajKu(z2).K)}` : String(f.properties.kod);
        }, { sticky: true });
        l.on("click", () => z && vyber(z.kod, false));
      },
    }).addTo(mapa);
    if (!stav.vybrane || stav.vybrane.kraj !== id) {
      const b = k.bbox;
      mapa.fitBounds([[b[1], b[0]], [b[3], b[2]]], { padding: [10, 10] });
    }
  }

  function prefarbi() { if (stav.vrstva) stav.vrstva.setStyle(styl); }

  // ---------- výber k. ú. ----------
  async function vyber(kod, priblizit) {
    const z = stav.podlaKodu.get(kod);
    if (!z) return;
    stav.vybrane = z;
    if (stav.kraj !== z.kraj) await nacitajKraj(z.kraj);
    prefarbi();
    if (priblizit && stav.vrstva) {
      stav.vrstva.eachLayer((l) => {
        if (l.feature.properties.kod === kod) {
          l.bringToFront();
          mapa.fitBounds(l.getBounds(), { paddingTopLeft: [20, 20], paddingBottomRight: MOBIL.matches ? [20, 260] : [20, 20], maxZoom: 14 });
        }
      });
    }
    history.replaceState(null, "", "#ku=" + kod);
    document.title = `KES ${z.nazov} · Voda a krajina`;
    $("predvyplnit").disabled = false;
    $("predvyplnit").title = `Predvyplniť z k. ú. ${z.nazov}`;
    prepniKartu("ku");
    vykresliKu();
  }

  function vysledokHTML(S, L, jednotka, delitel, d) {
    const K = kes(S, L);
    const t = trieda(K);
    const spolu = S + L;
    return `<div class="kes-vysledok">
      <div><span class="kes-cislo">KES = ${kesFmt(K)}</span>${t ? `<span class="kes-trieda" style="background:${t.farba}">${t.nazov}</span>` : ""}</div>
      <div class="kes-vzorec">KES = S / L = ${cislo(S / delitel, d)} ${jednotka} / ${cislo(L / delitel, d)} ${jednotka}</div>
      ${t ? `<p>${esc(t.popis[0].toUpperCase() + t.popis.slice(1))} (Míchal 1992).</p>` : "<p>Zadajte plochy.</p>"}
      ${spolu > 0 ? `<div class="pruh-sl"><span style="width:${(100 * S) / spolu}%;background:#2f7d32"></span><span style="width:${(100 * L) / spolu}%;background:#c8463d"></span></div>
      <div class="pruh-sl-popis"><span>stabilné ${cislo((100 * S) / spolu, 1)} %</span><span>labilné ${cislo((100 * L) / spolu, 1)} %</span></div>` : ""}
    </div>`;
  }

  function prepinacHTML(hodnota, data) {
    return `<span class="prepinac" role="group" aria-label="Zaradenie">
      <button type="button" class="s" aria-pressed="${hodnota === "S"}" data-sl="S" ${data}>S</button>
      <button type="button" class="l" aria-pressed="${hodnota === "L"}" data-sl="L" ${data}>L</button></span>`;
  }

  function vykresliKu() {
    const z = stav.vybrane;
    if (!z) return;
    const { S, L } = spocitajKu(z);
    const riadky = DRUHY.map((d) => `<tr>
        <td>${esc(d.nazov)}${d.overene ? "" : '<span class="sporne">zaradenie sporné</span>'}</td>
        <td class="cislo">${cislo(z[d.k] / 1e4, 2)}</td>
        <td class="cislo">${cislo((100 * z[d.k]) / z.celkom, 1)}</td>
        <td>${prepinacHTML(stav.zaradenie[d.k], `data-druh="${d.k}"`)}</td></tr>`).join("");
    $("ku-obsah").innerHTML = `
      <h2>${esc(z.nazov)}</h2>
      <p class="poznamka">katastrálne územie (kód ${z.kod}) · obec ${esc(z.obec)} · okres ${esc(z.okres)} ·
        ${esc((stav.kraje.find((k) => k.id === z.kraj) || {}).nazov || "")} kraj</p>
      ${vysledokHTML(S, L, "ha", 1e4, 2)}
      <table class="tab-kes">
        <thead><tr><th>Druh pozemku</th><th class="cislo">ha</th><th class="cislo">%</th><th>S / L</th></tr></thead>
        <tbody>${riadky}</tbody>
        <tfoot><tr><td>Spolu</td><td class="cislo">${cislo(z.celkom / 1e4, 2)}</td><td class="cislo">100,0</td><td></td></tr></tfoot>
      </table>
      <div class="akcie-riadok">
        <button type="button" id="ku-kopiruj">Kopírovať tabuľku (Excel)</button>
        <button type="button" id="ku-csv">Stiahnuť CSV</button>
        <button type="button" id="ku-predvolene">Predvolené zaradenie</button>
      </div>
      <p id="ku-hlasenie" class="hlasenie" role="status"></p>
      <p class="poznamka">Zdroj: ÚGKK SR – úhrnné hodnoty druhov pozemkov, stav k ${datum(stav.meta.stav_k)}.
        Zmena zaradenia S/L platí pre všetky k. ú. a prefarbí mapu.</p>`;
    $("ku-obsah").querySelectorAll("button[data-druh]").forEach((b) => b.addEventListener("click", () => {
      stav.zaradenie[b.dataset.druh] = b.dataset.sl;
      uloz(ULOZ_ZARADENIE, stav.zaradenie);
      prefarbi(); vykresliKu(); vykresliMetodiku();
    }));
    $("ku-predvolene").onclick = () => {
      DRUHY.forEach((d) => (stav.zaradenie[d.k] = d.sl));
      uloz(ULOZ_ZARADENIE, stav.zaradenie);
      prefarbi(); vykresliKu(); vykresliMetodiku();
    };
    const tabulka = () => {
      const r = [["Druh pozemku", "Výmera (ha)", "Podiel (%)", "Zaradenie"]];
      DRUHY.forEach((d) => r.push([d.nazov, (z[d.k] / 1e4).toFixed(4), ((100 * z[d.k]) / z.celkom).toFixed(2), stav.zaradenie[d.k]]));
      r.push(["Spolu", (z.celkom / 1e4).toFixed(4), "100.00", ""], ["S (ha)", (S / 1e4).toFixed(4)], ["L (ha)", (L / 1e4).toFixed(4)],
        ["KES = S/L", Number.isFinite(S / L) ? (S / L).toFixed(3) : "∞"], ["Zdroj", `ÚGKK SR, ÚHDP k ${datum(stav.meta.stav_k)}`]);
      return r;
    };
    $("ku-kopiruj").onclick = () => kopiruj(tsv(tabulka(), true), "ku-hlasenie");
    $("ku-csv").onclick = () => stiahniCsv(tabulka(), `KES_${z.nazov}.csv`);
  }

  // ---------- vlastný výpočet ----------
  const DELITEL = { ha: 1, m2: 1e4, km2: 0.01 }; // prevod na ha: ha = hodnota / DELITEL
  function vlastnyHa(r) {
    const v = parseFloat(String(r.plocha).replace(",", ".").replace(/\s/g, ""));
    return Number.isFinite(v) && v > 0 ? v / DELITEL[stav.vlastne.jednotka] : 0;
  }

  function kpiHodnota(id) { const x = KPI_PODLA_ID.get(id); return x ? x.k : null; }
  function kpiSelectHTML(id, i) {
    const opt = KPI.map((x) => `<option value="${x.id}"${x.id === id ? " selected" : ""}>${cislo(x.k, x.k === 0.675 ? 3 : 2)} – ${esc(x.nazov)}</option>`).join("");
    return `<select class="vyber-kpi" data-i="${i}" data-pole="kpi" aria-label="Koeficient kpi"><option value="">kpᵢ – nevybraté</option>${opt}</select>`;
  }

  function vykresliVlastny() {
    $("jednotka").value = stav.vlastne.jednotka;
    $("vlastne-riadky").innerHTML = stav.vlastne.riadky.map((x, i) => `<tr>
      <td><input type="text" value="${esc(x.nazov)}" data-i="${i}" data-pole="nazov" aria-label="Názov prvku">${kpiSelectHTML(x.kpi, i)}</td>
      <td><input type="text" inputmode="decimal" class="vstup-cislo" value="${esc(String(x.plocha).replace(".", ","))}" data-i="${i}" data-pole="plocha" aria-label="Plocha" placeholder="0"></td>
      <td>${prepinacHTML(x.sl, `data-i="${i}"`)}</td>
      <td><button type="button" class="zmaz" data-zmaz="${i}" aria-label="Zmazať riadok">×</button></td></tr>`).join("");
    prepocitajVlastny();
  }

  function ksKategoria(ks) { return Number.isFinite(ks) ? KS_KATEGORIE.find((k) => ks <= k.do) : null; }

  function spocitajVlastny() {
    let S = 0, L = 0, P = 0, suma = 0, bezKpi = 0;
    for (const x of stav.vlastne.riadky) {
      const ha = vlastnyHa(x);
      if (x.sl === "S") S += ha; else L += ha;
      P += ha;
      const k = kpiHodnota(x.kpi);
      if (k === null) { if (ha > 0) bezKpi++; } else suma += ha * k;
    }
    return { S, L, P, suma, bezKpi, Ks: P > 0 ? suma / P : NaN };
  }

  function ksHTML(v) {
    const kat = ksKategoria(v.Ks);
    return `<div class="kes-vysledok ks-vysledok">
      <div><span class="kes-cislo">Ks = ${Number.isFinite(v.Ks) ? cislo(v.Ks, 2) : "–"}</span>${kat ? `<span class="kes-trieda" style="background:${kat.farba}">${kat.nazov}</span>` : ""}</div>
      <div class="kes-vzorec">Ks = Σ(pᵢ · kpᵢ) / P = ${cislo(v.suma, 2)} / ${cislo(v.P, 2)} ha</div>
      ${kat ? `<p>Ekologická kvalita priestorovej štruktúry: ${esc(kat.popis)} (Izakovičová, Kartusek 1991).</p>` : "<p>Zadajte plochy a koeficienty kpᵢ.</p>"}
      ${v.bezKpi ? `<p class="varovanie">${v.bezKpi} ${v.bezKpi === 1 ? "riadok s plochou nemá" : v.bezKpi < 5 ? "riadky s plochou nemajú" : "riadkov s plochou nemá"} vybraný kpᵢ – v čitateli sa počíta s 0, v P je plocha zahrnutá. Doplňte kpᵢ.</p>` : ""}
    </div>`;
  }

  function prepocitajVlastny() {
    const v = spocitajVlastny();
    $("vlastny-vysledok").innerHTML = vysledokHTML(v.S, v.L, "ha", 1, 2) + ksHTML(v);
    uloz(ULOZ_VLASTNY, stav.vlastne);
    return v;
  }

  function nastavVlastny() {
    const tb = $("vlastne-riadky");
    const zmena = (e) => {
      const el = e.target;
      if (el.dataset.i === undefined || !el.dataset.pole) return;
      stav.vlastne.riadky[+el.dataset.i][el.dataset.pole] = el.value;
      prepocitajVlastny();
    };
    tb.addEventListener("input", zmena);
    tb.addEventListener("change", zmena);
    tb.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.zmaz !== undefined) stav.vlastne.riadky.splice(+b.dataset.zmaz, 1);
      else if (b.dataset.sl) stav.vlastne.riadky[+b.dataset.i].sl = b.dataset.sl;
      vykresliVlastny();
    });
    $("pridat").onclick = () => { stav.vlastne.riadky.push(riadok("", "S", "")); vykresliVlastny(); };
    $("vynulovat").onclick = () => {
      stav.vlastne.riadky = VLASTNE_PREDVOLENE(); vykresliVlastny();
      $("vlastny-hlasenie").textContent = "";
    };
    $("priklad").onclick = () => {
      stav.vlastne.jednotka = "ha";
      stav.vlastne.riadky = PRIKLAD_DUBRAVKA();
      vykresliVlastny();
      $("vlastny-hlasenie").textContent = "Načítaná Tab. 1 zo zadania (k. ú. Dúbravka, 2004). Zaradenie a kpᵢ pri NDV, lúkach a pasienkoch, ornej pôde a cestách sú predpoklady – pozri Metodiku. [OVERIŤ u vyučujúcej]";
    };
    $("jednotka").onchange = () => { stav.vlastne.jednotka = $("jednotka").value; prepocitajVlastny(); };
    $("predvyplnit").onclick = () => {
      const z = stav.vybrane;
      if (!z) return;
      const ha = (m2) => +(m2 / 1e4).toFixed(4);
      const zr = stav.zaradenie;
      stav.vlastne.jednotka = "ha";
      stav.vlastne.riadky = [
        riadok("Lesy (lesné pozemky)", zr.les, "les", ha(z.les)),
        riadok("Lúky a pasienky (TTP)", zr.ttp, "luky_pasienky", ha(z.ttp)),
        riadok("Záhrady", zr.zahrada, "zahrady", ha(z.zahrada)),
        riadok("Ovocné sady", zr.sad, "zahrady", ha(z.sad)),
        riadok("Vinice", zr.vinica, "vinice", ha(z.vinica)),
        riadok("Vodné plochy", zr.voda, "", ha(z.voda)),
        riadok("Orná pôda (polia)", zr.orna, "polia", ha(z.orna)),
        riadok("Chmeľnice", zr.chmel, "", ha(z.chmel)),
        riadok("Zastavané plochy a nádvoria", zr.zast, "", ha(z.zast)),
        riadok("Ostatné plochy", zr.ost, "", ha(z.ost)),
      ].filter((x) => x.plocha > 0);
      vykresliVlastny();
      $("vlastny-hlasenie").textContent = `Predvyplnené z k. ú. ${z.nazov}. Vodné, zastavané a ostatné plochy a chmeľnice nemajú jednoznačný kpᵢ (zahŕňajú toky, bývanie, priemysel aj cesty) – rozdeľte ich podľa mapovania a kpᵢ doplňte.`;
    };
    const tabulka = () => {
      const v = prepocitajVlastny();
      const K = kes(v.S, v.L), t = trieda(K), kat = ksKategoria(v.Ks);
      const t4 = (x) => (Number.isFinite(x) ? x.toFixed(4) : "");
      const out = [["Prvok SKŠ", "Plocha (ha)", "Zaradenie", "kpi", "pi*kpi"]];
      stav.vlastne.riadky.forEach((x) => {
        const ha = vlastnyHa(x), k = kpiHodnota(x.kpi);
        out.push([x.nazov, t4(ha), x.sl, k === null ? "" : String(k), k === null ? "" : t4(ha * k)]);
      });
      out.push(["Spolu P (ha)", t4(v.P)], [], ["S (ha)", t4(v.S)], ["L (ha)", t4(v.L)],
        ["KES = S/L", Number.isFinite(K) ? K.toFixed(3) : "∞", t ? t.nazov : ""],
        ["Σ(pi*kpi)", t4(v.suma)], ["Ks = Σ(pi*kpi)/P", Number.isFinite(v.Ks) ? v.Ks.toFixed(3) : "", kat ? kat.nazov : ""],
        ["Metodika", "KES: Míchal (1992); Ks: Izakovičová, Kartusek (1991)"]);
      if (v.bezKpi) out.push(["Upozornenie", `${v.bezKpi} riadkov bez kpi`]);
      return out;
    };
    $("vlastny-kopiruj").onclick = () => kopiruj(tsv(tabulka(), true), "vlastny-hlasenie");
    $("vlastny-csv").onclick = () => stiahniCsv(tabulka(), "KES_Ks_vlastny_vypocet.csv");
  }

  // ---------- export ----------
  const desatinnaCiarka = (v) => (/^-?\d+\.\d+$/.test(v) ? v.replace(".", ",") : v);
  function tsv(riadky, ciarka) { return riadky.map((r) => r.map((v) => (ciarka ? desatinnaCiarka(String(v)) : String(v))).join("\t")).join("\n"); }
  function stiahniCsv(riadky, nazov) {
    const text = "﻿" + riadky.map((r) => r.map((v) => {
      const s = desatinnaCiarka(String(v));
      return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    a.download = nazov.replace(/[\\/:*?"<>|]/g, "_");
    document.body.appendChild(a); a.click(); a.remove();
  }
  async function kopiruj(text, hlasenieId) {
    try { await navigator.clipboard.writeText(text); $(hlasenieId).textContent = "Tabuľka je skopírovaná – vložte ju do Excelu (Ctrl+V)."; }
    catch { $(hlasenieId).textContent = "Kopírovanie sa nepodarilo – použite Stiahnuť CSV."; }
  }

  // ---------- karty panela ----------
  function prepniKartu(id) {
    document.querySelectorAll(".karty button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.karta === id)));
    ["ku", "vlastny", "metodika"].forEach((k) => ($("karta-" + k).hidden = k !== id));
  }
  document.querySelectorAll(".karty button").forEach((b) => b.addEventListener("click", () => prepniKartu(b.dataset.karta)));

  function vykresliMetodiku() {
    $("metodika-zaradenie").innerHTML = DRUHY.map((d) =>
      `<li>${esc(d.nazov)} – <b>${d.sl === "S" ? "stabilná" : "labilná"}</b>${d.overene ? "" : " (sporné)"}${stav.zaradenie[d.k] !== d.sl ? ` – <i>teraz zmenené na ${stav.zaradenie[d.k]}</i>` : ""}</li>`).join("");
    $("metodika-stupnica").innerHTML = TRIEDY.map((t) =>
      `<tr><td class="bez-zalomenia"><span class="stvorcek" style="background:${t.farba}"></span> ${t.nazov}</td><td>${esc(t.popis)}${t.mimo ? " <i>(doplnené na tejto stránke)</i>" : ""}</td></tr>`).join("");
    $("metodika-kpi").innerHTML = KPI.map((x) =>
      `<tr><td>${esc(x.nazov)}${x.odvodene ? " <i>(odvodené, nie je v zadaní)</i>" : ""}</td><td class="cislo">${cislo(x.k, x.k === 0.675 ? 3 : 2)}</td></tr>`).join("");
    $("metodika-ks").innerHTML = KS_KATEGORIE.map((k) =>
      `<tr><td class="bez-zalomenia"><span class="stvorcek" style="background:${k.farba}"></span> ${k.nazov}</td><td>${esc(k.popis)}</td></tr>`).join("");
    $("metodika-udaje").innerHTML = `Výmery druhov pozemkov: ÚGKK SR – úhrnné hodnoty druhov pozemkov po katastrálnych územiach,
      stav k ${datum(stav.meta.stav_k)} (<a href="${esc(stav.meta.zdroj_url)}">CSV</a>). Hranice katastrálnych území: GKÚ Bratislava, CC BY 4.0.`;
  }

  // ---------- vyhľadávanie ----------
  function nastavHladanie() {
    const input = $("hladaj"), ul = $("navrhy");
    let aktivny = -1, vysledky = [];
    const zobraz = () => {
      const q = bezDiakritiky(input.value.trim());
      if (!q) { ul.hidden = true; return; }
      const zac = stav.ku.filter((z) => z.kluc.startsWith(q));
      const obs = q.length >= 3 ? stav.ku.filter((z) => !z.kluc.startsWith(q) && z.kluc.includes(q)) : [];
      vysledky = [...zac, ...obs].slice(0, 15);
      aktivny = vysledky.length ? 0 : -1;
      ul.innerHTML = vysledky.length
        ? vysledky.map((z, i) => `<li role="option" data-i="${i}" aria-selected="${i === aktivny}">${esc(z.nazov)}<small>${esc(z.obec !== z.nazov ? z.obec + " · " : "")}okres ${esc(z.okres)}</small></li>`).join("")
        : '<li aria-disabled="true">Katastrálne územie sa nenašlo</li>';
      ul.hidden = false;
    };
    const vyberI = (i) => { const z = vysledky[i]; if (!z) return; input.value = z.nazov; ul.hidden = true; input.blur(); vyber(z.kod, true); };
    input.addEventListener("input", zobraz);
    input.addEventListener("focus", () => input.value && zobraz());
    input.addEventListener("keydown", (e) => {
      if (ul.hidden) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        aktivny = (aktivny + (e.key === "ArrowDown" ? 1 : -1) + vysledky.length) % vysledky.length;
        [...ul.children].forEach((li, i) => li.setAttribute("aria-selected", String(i === aktivny)));
      } else if (e.key === "Enter") { e.preventDefault(); vyberI(aktivny); } else if (e.key === "Escape") { ul.hidden = true; }
    });
    ul.addEventListener("mousedown", (e) => { const li = e.target.closest("li[data-i]"); if (li) { e.preventDefault(); vyberI(+li.dataset.i); } });
    document.addEventListener("click", (e) => { if (!e.target.closest(".hladanie")) ul.hidden = true; });
  }

  // ---------- štart ----------
  async function start() {
    const [u, k] = await Promise.all([fetch(DATA + "uhdp.json").then((r) => r.json()), fetch(DATA + "kraje.json").then((r) => r.json())]);
    stav.meta = u;
    stav.ku = u.ku.map((row) => Object.fromEntries(u.stlpce.map((c, i) => [c, row[i]])));
    stav.ku.forEach((z) => { z.kluc = bezDiakritiky(z.nazov); stav.podlaKodu.set(z.kod, z); });
    stav.ku.sort((a, b) => a.nazov.localeCompare(b.nazov, "sk"));
    stav.kraje = k.kraje;
    for (const kr of stav.kraje) $("kraj").add(new Option(`${kr.nazov} kraj`, String(kr.id)));
    $("kraj").onchange = () => nacitajKraj(+$("kraj").value);
    $("podnadpis").textContent = `${stav.ku.length.toLocaleString("sk-SK")} katastrálnych území SR · kataster k ${datum(u.stav_k)}`;
    $("hladaj").disabled = false;
    legenda();
    nastavHladanie();
    nastavVlastny();
    vykresliVlastny();
    vykresliMetodiku();
    const kod = Number(new URLSearchParams(location.hash.slice(1)).get("ku"));
    const z = kod && stav.podlaKodu.get(kod);
    await nacitajKraj(z ? z.kraj : (stav.kraje[0] || {}).id);
    if (z) vyber(z.kod, true);
  }

  start().catch((e) => {
    console.error(e);
    $("ku-obsah").innerHTML = `<p><b>Dáta sa nepodarilo načítať.</b></p><p class="poznamka">${esc(e.message)}<br>
      Spustite <code>python scripts/12_kes.py</code> a stránku otvorte cez lokálny server (pozri README).</p>`;
  });
})();
