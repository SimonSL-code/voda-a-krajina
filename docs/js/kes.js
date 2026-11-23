/* Koeficient ekologickej stability (KES = S / L) katastrálnych území. Autor: Šimon Lešiga. Licencia kódu: MIT. */
(function () {
  "use strict";

  const DATA = "data/kes/";
  const MOBIL = window.matchMedia("(max-width: 760px)");
  const ULOZ_ZARADENIE = "vk-kes-zaradenie";
  const ULOZ_VLASTNY = "vk-kes-vlastny";

  // Druhy pozemkov katastra a ich predvolené zaradenie (S = stabilné, L = labilné).
  // overene: zaradenie zodpovedá Míchalovmu zoznamu (les, lúky a pasienky = S; orná a zastavaná pôda = L).
  const DRUHY = [
    { k: "orna", nazov: "orná pôda", sl: "L", overene: true },
    { k: "chmel", nazov: "chmeľnica", sl: "L" },
    { k: "vinica", nazov: "vinica", sl: "L" },
    { k: "zahrada", nazov: "záhrada", sl: "S" },
    { k: "sad", nazov: "ovocný sad", sl: "S" },
    { k: "ttp", nazov: "trvalý trávny porast", sl: "S", overene: true },
    { k: "les", nazov: "lesný pozemok", sl: "S", overene: true },
    { k: "voda", nazov: "vodná plocha", sl: "S" },
    { k: "zast", nazov: "zastavaná plocha a nádvorie", sl: "L", overene: true },
    { k: "ost", nazov: "ostatná plocha", sl: "L" },
  ];

  // Stupnica podľa Míchala (1982), citované podľa Reháčková a Pauditšová (2007)
  const TRIEDY = [
    { do: 0.10, farba: "#c0392b", nazov: "< 0,10", popis: "maximálne narušené prírodné štruktúry" },
    { do: 0.30, farba: "#e67e22", nazov: "0,10 – 0,30", popis: "nadpriemerne využívané územie so zreteľným narušením prírodných štruktúr" },
    { do: 1.00, farba: "#e9c46a", nazov: "0,30 – 1,00", popis: "intenzívne využívaná krajina, najmä poľnohospodárskou veľkovýrobou; ekologická labilita" },
    { do: Infinity, farba: "#2f9e44", nazov: "> 1,00", popis: "takmer vyvážená krajina" },
  ];

  const VLASTNE_PREDVOLENE = [
    { nazov: "Lesy", sl: "S" }, { nazov: "Nelesná drevinová vegetácia", sl: "S" },
    { nazov: "Lúky a pasienky", sl: "S" }, { nazov: "Sady a záhrady", sl: "S" },
    { nazov: "Vodné plochy a toky", sl: "S" }, { nazov: "Orná pôda (polia)", sl: "L" },
    { nazov: "Vinice", sl: "L" }, { nazov: "Zastavané plochy", sl: "L" },
    { nazov: "Cesty a železnice", sl: "L" }, { nazov: "Ostatné plochy", sl: "L" },
  ].map((r) => ({ ...r, plocha: "" }));

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
    vlastne: nacitaj(ULOZ_VLASTNY) || { jednotka: "ha", riadky: VLASTNE_PREDVOLENE.map((r) => ({ ...r })) },
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
      ${t ? `<p>${esc(t.popis[0].toUpperCase() + t.popis.slice(1))} (Míchal 1982).</p>` : "<p>Zadajte plochy.</p>"}
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

  function vykresliVlastny() {
    $("jednotka").value = stav.vlastne.jednotka;
    $("vlastne-riadky").innerHTML = stav.vlastne.riadky.map((r, i) => `<tr>
      <td><input type="text" value="${esc(r.nazov)}" data-i="${i}" data-pole="nazov" aria-label="Názov prvku"></td>
      <td><input type="text" inputmode="decimal" class="vstup-cislo" value="${esc(String(r.plocha).replace(".", ","))}" data-i="${i}" data-pole="plocha" aria-label="Plocha" placeholder="0"></td>
      <td>${prepinacHTML(r.sl, `data-i="${i}"`)}</td>
      <td><button type="button" class="zmaz" data-zmaz="${i}" aria-label="Zmazať riadok">×</button></td></tr>`).join("");
    prepocitajVlastny();
  }

  function prepocitajVlastny() {
    let S = 0, L = 0;
    stav.vlastne.riadky.forEach((r) => (r.sl === "S" ? (S += vlastnyHa(r)) : (L += vlastnyHa(r))));
    $("vlastny-vysledok").innerHTML = vysledokHTML(S, L, "ha", 1, 2);
    uloz(ULOZ_VLASTNY, stav.vlastne);
    return { S, L };
  }

  function nastavVlastny() {
    const tb = $("vlastne-riadky");
    tb.addEventListener("input", (e) => {
      const el = e.target;
      if (el.dataset.i === undefined) return;
      stav.vlastne.riadky[+el.dataset.i][el.dataset.pole] = el.value;
      prepocitajVlastny();
    });
    tb.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.zmaz !== undefined) stav.vlastne.riadky.splice(+b.dataset.zmaz, 1);
      else if (b.dataset.sl) stav.vlastne.riadky[+b.dataset.i].sl = b.dataset.sl;
      vykresliVlastny();
    });
    $("pridat").onclick = () => { stav.vlastne.riadky.push({ nazov: "", plocha: "", sl: "S" }); vykresliVlastny(); };
    $("vynulovat").onclick = () => { stav.vlastne.riadky = VLASTNE_PREDVOLENE.map((r) => ({ ...r })); vykresliVlastny(); };
    $("jednotka").onchange = () => { stav.vlastne.jednotka = $("jednotka").value; prepocitajVlastny(); };
    $("predvyplnit").onclick = () => {
      const z = stav.vybrane;
      if (!z) return;
      const ha = (m2) => +(m2 / 1e4).toFixed(4);
      stav.vlastne.jednotka = "ha";
      stav.vlastne.riadky = [
        { nazov: "Lesy (lesné pozemky)", plocha: ha(z.les), sl: stav.zaradenie.les },
        { nazov: "Lúky a pasienky (TTP)", plocha: ha(z.ttp), sl: stav.zaradenie.ttp },
        { nazov: "Záhrady", plocha: ha(z.zahrada), sl: stav.zaradenie.zahrada },
        { nazov: "Ovocné sady", plocha: ha(z.sad), sl: stav.zaradenie.sad },
        { nazov: "Vodné plochy", plocha: ha(z.voda), sl: stav.zaradenie.voda },
        { nazov: "Orná pôda (polia)", plocha: ha(z.orna), sl: stav.zaradenie.orna },
        { nazov: "Chmeľnice", plocha: ha(z.chmel), sl: stav.zaradenie.chmel },
        { nazov: "Vinice", plocha: ha(z.vinica), sl: stav.zaradenie.vinica },
        { nazov: "Zastavané plochy a nádvoria", plocha: ha(z.zast), sl: stav.zaradenie.zast },
        { nazov: "Ostatné plochy", plocha: ha(z.ost), sl: stav.zaradenie.ost },
      ].filter((r) => r.plocha > 0);
      vykresliVlastny();
      $("vlastny-hlasenie").textContent = `Predvyplnené z k. ú. ${z.nazov}. Cesty sú v katastri súčasťou zastavaných a ostatných plôch – ak ich máte zmerané, upravte riadky.`;
    };
    const tabulka = () => {
      const { S, L } = prepocitajVlastny();
      const r = [["Prvok SKŠ", "Plocha (ha)", "Zaradenie"]];
      stav.vlastne.riadky.forEach((x) => r.push([x.nazov, vlastnyHa(x).toFixed(4), x.sl]));
      r.push(["S (ha)", S.toFixed(4)], ["L (ha)", L.toFixed(4)], ["KES = S/L", L > 0 ? (S / L).toFixed(3) : "∞"]);
      return r;
    };
    $("vlastny-kopiruj").onclick = () => kopiruj(tsv(tabulka(), true), "vlastny-hlasenie");
    $("vlastny-csv").onclick = () => stiahniCsv(tabulka(), "KES_vlastny_vypocet.csv");
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
      `<tr><td><span class="stvorcek" style="background:${t.farba}"></span> ${t.nazov}</td><td>${esc(t.popis)}</td></tr>`).join("");
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
