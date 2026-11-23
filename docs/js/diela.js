/* Vodné diela s energetickým využitím – prezentácia (PPTX), prompt pre AI a odkazy.
   Autor: Šimon Lešiga. Licencia kódu: MIT. PPTX: PptxGenJS (MIT), docs/vendor/pptxgenjs. */
/* global PptxGenJS, DIELA_TEMY, DIELA_ROZLOZENIA, DIELA_TONY, DIELA_TEXTY, DIELA_TYPY, DIELA_TURBINY, DIELA_VPLYVY */
(function () {
  "use strict";

  const DATA = "data/vodne_diela.json";
  const ULOZISKO = "vk-diela-v1";
  const PORTAL = new URL("diela.html", location.href).href.split("#")[0];
  const ABECEDA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const OVERIT = "[OVERIŤ]";
  const DOPLNIT = "[DOPLNIŤ]";

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const bezDiakritiky = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const cislo = (v, max = 2) => (v === null || v === undefined || Number.isNaN(+v) ? null
    : new Intl.NumberFormat("sk-SK", { maximumFractionDigits: max }).format(v));
  const zvyrazniOverit = (s) => esc(s).replace(/\[(OVERIŤ|DOPLNIŤ)[^\]]*\]/g, (m) => `<span class="overit">${m}</span>`);

  const stav = {
    diela: [], dielo: null, vlastne: false, filter: "vsetky",
    tema: "nahodna", rozl: "nahodne", ton: "vecny", rozsah: "kompaktna", kod: novyKod(),
  };

  // ---------- náhoda so semienkom (kód variantu) ----------
  function novyKod() {
    let k = "";
    const r = (crypto && crypto.getRandomValues) ? crypto.getRandomValues(new Uint32Array(4)) : [1, 2, 3, 4].map(() => Math.random() * 1e9);
    for (let i = 0; i < 4; i++) k += ABECEDA[r[i] % ABECEDA.length];
    return k;
  }
  function hash(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0; };
  }
  function rng(seedStr) {
    let a = hash(seedStr)();
    const f = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    f.pick = (arr) => arr[Math.floor(f() * arr.length)];
    f.shuffle = (arr) => { const b = arr.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
    return f;
  }
  const efTema = () => DIELA_TEMY.find((t) => t.id === stav.tema) || rng(stav.kod + "|tema").pick(DIELA_TEMY);
  const efRozl = () => DIELA_ROZLOZENIA.find((t) => t.id === stav.rozl) || rng(stav.kod + "|rozl").pick(DIELA_ROZLOZENIA);

  // ---------- nastavenia ----------
  function nacitaj() { try { return JSON.parse(localStorage.getItem(ULOZISKO)) || {}; } catch { return {}; } }
  function uloz() {
    try {
      localStorage.setItem(ULOZISKO, JSON.stringify({
        autor: $("autor").value, predmet: $("predmet").value, poznamky: $("poznamky").checked,
        vystupAI: $("vystup-ai").value, tema: stav.tema, rozl: stav.rozl, ton: stav.ton, rozsah: stav.rozsah,
      }));
    } catch { /* úložisko nemusí byť dostupné */ }
  }

  // ---------- dielo (vybrané alebo vlastné) ----------
  function aktualneDielo() {
    if (!stav.vlastne) return stav.dielo;
    const nazov = $("v-nazov").value.trim();
    if (!nazov) return null;
    const turb = $("v-turbiny").value;
    return {
      id: "vlastne", vlastne: true, nazov, kratky: nazov, skratka: "VE", tok: $("v-tok").value.trim() || DOPLNIT, oblast: $("v-oblast").value.trim() || DOPLNIT,
      dielo: nazov, typ: $("v-typ").value, kategoria: null, rok: null, vykon_mw: null,
      turbiny: { pocet: null, typ: turb || OVERIT, popis: turb ? `${turb} – počet a parametre ${DOPLNIT}` : `${DOPLNIT} počet a typ turbín` },
      hltnost: null, vyroba_gwh: null, spad: null, prevadzkovatel: null, kaskada: null, rezim: null,
      fakty: [], funkcie: [], objekty: [], zdroje: [], overit: ["všetky technické údaje – dohľadať u prevádzkovateľa a v zdrojoch"],
    };
  }

  // ---------- vyhľadávanie a výber ----------
  function filtrovane() {
    return stav.diela.filter((d) => stav.filter === "vsetky" || d.skratka === stav.filter);
  }
  function naplnSelect() {
    const sel = $("vyber");
    sel.innerHTML = '<option value="">– vyberte vodné dielo –</option>';
    const skupiny = new Map();
    for (const d of filtrovane()) { if (!skupiny.has(d.oblast)) skupiny.set(d.oblast, []); skupiny.get(d.oblast).push(d); }
    for (const [oblast, zoz] of skupiny) {
      const og = document.createElement("optgroup"); og.label = oblast;
      for (const d of zoz) og.appendChild(new Option(`${d.kratky} (${d.tok}, ${cislo(d.vykon_mw)} MW)`, d.id));
      sel.appendChild(og);
    }
    if (stav.dielo && !stav.vlastne) sel.value = stav.dielo.id;
  }

  function nastavHladanie() {
    const vstup = $("hladaj"), zoznam = $("navrhy");
    let aktivny = -1, vysledky = [];
    const zavri = () => { zoznam.hidden = true; vstup.setAttribute("aria-expanded", "false"); aktivny = -1; };
    const vykresli = () => {
      zoznam.innerHTML = vysledky.map((d, i) => `<li role="option" id="navrh-${i}" aria-selected="${i === aktivny}" data-id="${d.id}">${esc(d.kratky)}<small>${esc(d.tok)} · ${esc(d.oblast)}</small></li>`).join("");
      zoznam.hidden = vysledky.length === 0; vstup.setAttribute("aria-expanded", String(!zoznam.hidden));
    };
    vstup.addEventListener("input", () => {
      const q = bezDiakritiky(vstup.value.trim());
      if (!q) { vysledky = []; vykresli(); return; }
      vysledky = stav.diela.filter((d) => bezDiakritiky(`${d.nazov} ${d.kratky} ${d.tok} ${d.oblast} ${d.dielo}`).includes(q)).slice(0, 12);
      aktivny = vysledky.length ? 0 : -1; vykresli();
    });
    vstup.addEventListener("keydown", (e) => {
      if (zoznam.hidden) return;
      if (e.key === "ArrowDown") { aktivny = Math.min(aktivny + 1, vysledky.length - 1); vykresli(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { aktivny = Math.max(aktivny - 1, 0); vykresli(); e.preventDefault(); }
      else if (e.key === "Enter" && aktivny >= 0) { vyber(vysledky[aktivny].id); zavri(); vstup.value = ""; e.preventDefault(); }
      else if (e.key === "Escape") zavri();
    });
    zoznam.addEventListener("pointerdown", (e) => { const li = e.target.closest("li"); if (li) { e.preventDefault(); vyber(li.dataset.id); zavri(); vstup.value = ""; } });
    vstup.addEventListener("blur", () => setTimeout(zavri, 150));
  }

  function vyber(id, { noveVariant = false } = {}) {
    const d = stav.diela.find((x) => x.id === id);
    if (!d) return;
    stav.dielo = d; stav.vlastne = false;
    $("rezim-vlastne").checked = false; $("vlastne-form").hidden = true;
    if (noveVariant) stav.kod = novyKod();
    $("vyber").value = d.id;
    zmena();
  }

  // ---------- karta diela ----------
  function vykresliInfo() {
    const d = aktualneDielo(), box = $("dielo-info");
    if (!d) { box.hidden = true; return; }
    box.hidden = false;
    if (d.vlastne) {
      box.innerHTML = `<b>${esc(d.nazov)}</b> <span class="stitok stitok--nie">vlastné dielo</span>
        <p class="poznamka">Pre vlastné dielo nemá stránka overené údaje. Prezentácia bude mať miesta ${zvyrazniOverit(DOPLNIT)} a prompt požiada AI o dohľadanie údajov so zdrojmi.</p>`;
      return;
    }
    const riadky = parametre(d).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${zvyrazniOverit(v)}</td></tr>`).join("");
    box.innerHTML = `
      <div class="dielo-info__hlava"><b>${esc(d.nazov)}</b><span class="stitok stitok--${d.skratka.toLowerCase()}">${esc(d.skratka)}</span></div>
      <table class="tab-param">${riadky}</table>
      ${d.fakty.length ? `<details><summary>Zaujímavosti (${d.fakty.length})</summary><ul>${d.fakty.map((f) => `<li>${zvyrazniOverit(f)}</li>`).join("")}</ul></details>` : ""}
      ${d.overit.length ? `<p class="poznamka">Na overenie: ${d.overit.map((o) => `<span class="overit">${esc(o)}</span>`).join(", ")}</p>` : ""}
      <p class="poznamka">Zdroje: ${d.zdroje.map((z) => `<a href="${esc(z.u)}" target="_blank" rel="noopener">${esc(z.t)}</a>`).join(" · ")}</p>`;
  }

  function parametre(d) {
    const typ = DIELA_TYPY[d.typ] || DIELA_TYPY.ine;
    const t = d.turbiny || {};
    return [
      ["Tok", d.tok],
      ["Oblasť", d.oblast],
      ["Vodné dielo", d.dielo || "–"],
      ["Typ", `${typ.nazov}${d.kategoria && !typ.nazov.startsWith(d.kategoria) ? ` (${d.kategoria})` : ""}`],
      ["Do prevádzky", d.rok || OVERIT],
      ["Inštalovaný výkon", d.vykon_mw != null ? `${cislo(d.vykon_mw)} MW` : OVERIT],
      ["Turbíny", t.pocet ? (/[×+]/.test(t.typ) ? `${t.typ}, spolu ${t.pocet}` : `${t.pocet} × ${t.typ}`) : (t.typ || OVERIT)],
      ["Hltnosť", d.hltnost || OVERIT],
      ["Spád", d.spad || OVERIT],
      ["Priemerná výroba", d.vyroba_gwh != null ? `${cislo(d.vyroba_gwh, 3)} GWh/rok` : OVERIT],
      ["Prevádzkovateľ", d.prevadzkovatel || OVERIT],
    ];
  }

  // ---------- štýl ----------
  function vykresliStyly() {
    $("temy").innerHTML = `<label class="tema-karta tema-karta--nahodna"><input type="radio" name="tema" value="nahodna"><span class="tema-karta__nahlad">🎲</span><b>Náhodná</b><small>podľa kódu variantu</small></label>` +
      DIELA_TEMY.map((t) => `<label class="tema-karta"><input type="radio" name="tema" value="${t.id}">
        <span class="tema-karta__nahlad" style="background:#${t.bg};border-color:#${t.primarna}">
          <i style="background:#${t.primarna}"></i><i style="background:#${t.akcenty[0]}"></i><i style="background:#${t.akcenty[1]}"></i>
          <em style="color:#${t.text};font-family:${t.css}">Aa</em></span>
        <b>${esc(t.nazov)}</b><small>${esc(t.popis)}</small></label>`).join("");
    $("rozlozenia").innerHTML = `<label class="segment"><input type="radio" name="rozl" value="nahodne"><span>🎲 Náhodné</span></label>` +
      DIELA_ROZLOZENIA.map((r) => `<label class="segment" title="${esc(r.popis)}"><input type="radio" name="rozl" value="${r.id}"><span>${esc(r.nazov)}</span></label>`).join("");
    $("tony").innerHTML = DIELA_TONY.map((r) => `<label class="segment" title="${esc(r.popis)}"><input type="radio" name="ton" value="${r.id}"><span>${esc(r.nazov)}</span></label>`).join("");
    for (const [meno, kluc] of [["tema", "tema"], ["rozl", "rozl"], ["ton", "ton"]]) {
      document.querySelectorAll(`input[name="${meno}"]`).forEach((i) => {
        i.checked = i.value === stav[kluc];
        i.addEventListener("change", () => { stav[kluc] = i.value; zmena(); });
      });
    }
    $("rozsah").value = stav.rozsah;
    $("rozsah").addEventListener("change", () => { stav.rozsah = $("rozsah").value; zmena(); });
    $("kod").addEventListener("change", () => {
      const k = $("kod").value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
      stav.kod = k || novyKod(); zmena();
    });
    $("novy-variant").onclick = () => { stav.kod = novyKod(); zmena(); };
    $("vsetko-nahodne").onclick = () => {
      stav.tema = "nahodna"; stav.rozl = "nahodne"; stav.kod = novyKod();
      stav.ton = rng(stav.kod + "|ton").pick(DIELA_TONY).id;
      document.querySelectorAll('input[name="tema"],input[name="rozl"],input[name="ton"]').forEach((i) => {
        i.checked = i.value === (i.name === "tema" ? stav.tema : i.name === "rozl" ? stav.rozl : stav.ton);
      });
      zmena();
    };
  }

  function vykresliNahlad() {
    const t = efTema(), r = efRozl(), d = aktualneDielo();
    const R = rng(stav.kod);
    const nazov = d ? d.kratky : "Vodná elektráreň";
    const akc = "#" + t.akcenty[Math.floor(rng(stav.kod + "|akc")() * t.akcenty.length)];
    const titulka = R.pick(["plna", "delena", "velka"]);
    const css = `--bg:#${t.bg};--tx:#${t.text};--tl:#${t.tlmeny};--pr:#${t.primarna};--ak:${akc};--ka:#${t.karta};--np:#${t.naPrimarnej};--pismo:${t.css}`;
    const nadpis = rng(stav.kod + "|n|co").pick(DIELA_TEXTY.nadpisy.co);
    $("nahlad").innerHTML = `
      <div class="mini mini--titulka mini--${titulka} ${t.mriezka ? "mini--mriezka" : ""}" style="${css}"><div class="mini__panel"></div>
        <div class="mini__titul">${esc(nazov)}</div><div class="mini__pod">Program č. 4</div></div>
      <div class="mini mini--obsah mini--${r.id} ${t.mriezka ? "mini--mriezka" : ""}" style="${css}"><div class="mini__deko"></div>
        <div class="mini__nadpis">${esc(nadpis)}</div><div class="mini__riadky"><i></i><i></i><i></i></div><div class="mini__foto"></div></div>
      <div class="mini mini--cisla mini--${r.id} ${t.mriezka ? "mini--mriezka" : ""}" style="${css}"><div class="mini__deko"></div>
        <div class="mini__nadpis">${esc(rng(stav.kod + "|n|energia").pick(DIELA_TEXTY.nadpisy.energia))}</div>
        <div class="mini__dlazdice"><span>${d && d.vykon_mw != null ? cislo(d.vykon_mw, 1) : "?"}<small>MW</small></span><span>${d && d.vyroba_gwh != null ? cislo(d.vyroba_gwh, 0) : "?"}<small>GWh</small></span><span>${d && d.turbiny && d.turbiny.pocet ? d.turbiny.pocet : "?"}<small>turbíny</small></span></div></div>`;
    const ton = DIELA_TONY.find((x) => x.id === stav.ton);
    $("nahlad-popis").innerHTML = `Téma <b>${esc(t.nazov)}</b>${stav.tema === "nahodna" ? " (náhodná)" : ""} · rozloženie <b>${esc(r.nazov)}</b>${stav.rozl === "nahodne" ? " (náhodné)" : ""} · tón <b>${esc(ton.nazov)}</b> · variant <b>${esc(stav.kod)}</b>.
      Rovnaký kód = rovnaká prezentácia; iný kód = iné formulácie, titulka a usporiadanie snímok.`;
  }

  // ---------- PPTX ----------
  const W = 13.333, H = 7.5;

  function vytvorPptx() {
    const d = aktualneDielo();
    if (!d) return;
    if (typeof PptxGenJS === "undefined") { hlasenie("pptx-hlasenie", "Knižnica PptxGenJS sa nenačítala.", true); return; }
    const t = efTema(), roz = efRozl().id, ton = stav.ton;
    const R = rng(stav.kod + "|" + d.id);
    const nadpis = (k) => rng(stav.kod + "|n|" + k).pick(DIELA_TEXTY.nadpisy[k]);
    const AK = rng(stav.kod + "|akc").pick(t.akcenty);
    const CERV = t.tmava ? "FF8A80" : "C0392B";
    const autor = $("autor").value.trim() || "Meno Priezvisko";
    const predmet = $("predmet").value.trim();
    const poznamky = $("poznamky").checked;
    const odrazka = R.pick([true, { code: "2013" }, { code: "25AA" }, { code: "2022" }]);
    const typ = DIELA_TYPY[d.typ] || DIELA_TYPY.ine;
    const podrobna = stav.rozsah === "podrobna";
    const dnes = new Date();
    const datum = `${["január", "február", "marec", "apríl", "máj", "jún", "júl", "august", "september", "október", "november", "december"][dnes.getMonth()]} ${dnes.getFullYear()}`;
    const fill = (s, o = {}) => s.replace(/\{(\w)\}/g, (_, k) => ({ n: d.kratky, t: d.tok, o: d.oblast, r: d.rok ? String(d.rok).slice(0, 4) : "?", v: d.vykon_mw != null ? cislo(d.vykon_mw, 1) : "?", g: d.vyroba_gwh != null ? cislo(d.vyroba_gwh, 1) : "?" }[k] ?? o[k] ?? ""));

    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    pptx.author = autor; pptx.company = "Program č. 4"; pptx.title = `${d.kratky} – Program č. 4`;
    pptx.theme = { headFontFace: t.pismoN, bodyFontFace: t.pismoT };

    // text s červeným zvýraznením [OVERIŤ]/[DOPLNIŤ]
    const behy = (s, o = {}) => {
      const casti = String(s).split(/(\[(?:OVERIŤ|DOPLNIŤ)[^\]]*\])/);
      return casti.filter((c) => c !== "").map((c) => ({ text: c, options: /^\[(OVERIŤ|DOPLNIŤ)/.test(c) ? { ...o, color: CERV, bold: true } : { ...o } }));
    };
    const odstavce = (polozky, o = {}) => {
      const out = [];
      // pozn.: PptxGenJS začína nový odsek pri každom behu s `bullet` – odrážka len na prvom behu odseku
      // a vlastnosti odseku (pPr) musia byť len na prvom behu, inak vznikne viac <a:pPr> v jednom odseku
      const { bullet, paraSpaceAfter, ...beh } = o;
      polozky.forEach((p) => {
        const b = behy(p, beh);
        b[0].options.paraSpaceAfter = paraSpaceAfter ?? 8;
        if (bullet !== false) b[0].options.bullet = bullet || odrazka;
        b[b.length - 1].options.breakLine = true;
        out.push(...b);
      });
      return out;
    };
    // riadky bez odrážok (namiesto "\n" v texte, ktoré PptxGenJS pri viacerých behoch rozbije)
    const riadky = (zoz, o = {}) => zoz.flatMap((r) => { const b = behy(r === "" ? " " : r, o); b[b.length - 1].options.breakLine = true; return b; });

    // záverečná veta – bez variantov s číslami, ktoré pre dielo chýbajú
    const zaverVeta = (tonK) => {
      const zoz = DIELA_TEXTY.zaver[tonK].filter((v) => !((/\{g\}/.test(v) && d.vyroba_gwh == null) || (/\{v\}/.test(v) && d.vykon_mw == null) || (/\{r\}/.test(v) && !d.rok)));
      return zoz.length ? fill(rng(stav.kod + "|zav").pick(zoz)) : `${d.kratky} – ${DOPLNIT} hlavné zistenia.`;
    };
    let poradie = 0;
    function mriezka(s) {
      if (!t.mriezka) return;
      for (let x = 1; x < W; x += 1) s.addShape(pptx.ShapeType.line, { x, y: 0, w: 0, h: H, line: { color: "1E4A75", width: 0.5 } });
      for (let y = 1; y < H; y += 1) s.addShape(pptx.ShapeType.line, { x: 0, y, w: W, h: 0, line: { color: "1E4A75", width: 0.5 } });
    }
    function pata(s, n) {
      const txt = [autor, "Program č. 4", d.kratky].join("  ·  ");
      s.addText(txt, { x: 0.6, y: H - 0.5, w: 9, h: 0.3, fontSize: 10, color: t.tlmeny, fontFace: t.pismoT });
      s.addText(String(n), { x: W - 1.4, y: H - 0.5, w: 0.8, h: 0.3, fontSize: 10, color: t.tlmeny, align: "right", fontFace: t.pismoT });
    }
    // nová obsahová snímka; vráti obsahovú plochu
    function snimka(kluc, pozn) {
      const s = pptx.addSlide();
      poradie++;
      s.background = { color: t.bg };
      mriezka(s);
      const nad = nadpis(kluc);
      let box;
      if (roz === "pruh") {
        s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.22, h: H, fill: { color: t.primarna }, line: { color: t.primarna } });
        s.addShape(pptx.ShapeType.rect, { x: 0.22, y: 0, w: 0.08, h: H, fill: { color: AK }, line: { color: AK } });
        s.addText(nad, { x: 0.7, y: 0.35, w: 11.9, h: 0.9, fontSize: 30, bold: true, color: t.text, fontFace: t.pismoN });
        s.addShape(pptx.ShapeType.rect, { x: 0.72, y: 1.22, w: 1.1, h: 0.07, fill: { color: AK }, line: { color: AK } });
        box = { x: 0.7, y: 1.6, w: 11.9, h: 5.2 };
      } else if (roz === "pas") {
        s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 1.2, fill: { color: t.primarna }, line: { color: t.primarna } });
        s.addShape(pptx.ShapeType.rect, { x: 0, y: 1.2, w: W, h: 0.06, fill: { color: AK }, line: { color: AK } });
        s.addText(nad, { x: 0.6, y: 0.15, w: 12.1, h: 0.9, fontSize: 28, bold: true, color: t.naPrimarnej, fontFace: t.pismoN });
        box = { x: 0.6, y: 1.6, w: 12.1, h: 5.25 };
      } else if (roz === "karty") {
        s.addShape(pptx.ShapeType.ellipse, { x: 0.6, y: 0.62, w: 0.26, h: 0.26, fill: { color: AK }, line: { color: AK } });
        s.addText(nad, { x: 1.0, y: 0.32, w: 11.6, h: 0.85, fontSize: 28, bold: true, color: t.text, fontFace: t.pismoN });
        s.addShape(pptx.ShapeType.roundRect, { x: 0.45, y: 1.35, w: W - 0.9, h: 5.6, fill: { color: t.karta }, line: { color: t.karta }, rectRadius: 0.18 });
        box = { x: 0.8, y: 1.6, w: W - 1.6, h: 5.1 };
      } else {
        s.addText(String(poradie - 1).padStart(2, "0"), { x: 0.55, y: 0.25, w: 1.4, h: 1.1, fontSize: 54, bold: true, color: AK, fontFace: t.pismoN, transparency: 15 });
        s.addText(nad, { x: 1.95, y: 0.42, w: 10.8, h: 0.9, fontSize: 30, color: t.text, fontFace: t.pismoN });
        box = { x: 1.0, y: 1.8, w: 11.4, h: 5.0 };
      }
      pata(s, poradie);
      if (poznamky && pozn) s.addNotes(pozn);
      return { s, box };
    }
    const tlmText = (s, txt, x, y, w, h, o = {}) => s.addText(behy(txt, { fontSize: 13, color: t.tlmeny, italic: true, fontFace: t.pismoT, ...o }), { x, y, w, h, valign: "top" });
    function fotoMiesto(s, x, y, w, h) {
      s.addShape(pptx.ShapeType.rect, { x, y, w, h, fill: { color: t.karta }, line: { color: t.tlmeny, width: 1, dashType: "dash" } });
      s.addText([{ text: "Sem vlož fotografiu alebo mapu", options: { bold: true, breakLine: true } }, { text: "(uveď autora a licenciu – napr. Wikimedia Commons)" }],
        { x, y, w, h, align: "center", valign: "middle", fontSize: 13, color: t.tlmeny, fontFace: t.pismoT });
    }
    function dlazdice(s, polozky, x, y, w, h, smer = "riadok") {
      const n = polozky.length, medz = 0.25;
      polozky.forEach((p, i) => {
        const bw = smer === "riadok" ? (w - medz * (n - 1)) / n : w, bh = smer === "riadok" ? h : (h - medz * (n - 1)) / n;
        const bx = smer === "riadok" ? x + i * (bw + medz) : x, by = smer === "riadok" ? y : y + i * (bh + medz);
        const farba = roz === "karty" ? t.bg : t.karta;
        s.addShape(pptx.ShapeType.roundRect, { x: bx, y: by, w: bw, h: bh, fill: { color: farba }, line: { color: farba }, rectRadius: 0.12 });
        s.addShape(pptx.ShapeType.rect, { x: bx, y: by + 0.15, w: 0.08, h: bh - 0.3, fill: { color: AK }, line: { color: AK } });
        s.addText(behy(p[0], { fontSize: p[0].length > 9 ? 22 : 34, bold: true, color: t.text, fontFace: t.pismoN }), { x: bx + 0.25, y: by + 0.1, w: bw - 0.35, h: bh * 0.6, valign: "bottom" });
        s.addText(p[1], { x: bx + 0.25, y: by + bh * 0.62, w: bw - 0.35, h: bh * 0.33, fontSize: 13, color: t.tlmeny, valign: "top", fontFace: t.pismoT });
      });
    }
    const zoznam = (s, polozky, box, o = {}) => s.addText(odstavce(polozky, { fontSize: o.fontSize || 19, color: t.text, fontFace: t.pismoT, ...o }), { ...box, valign: "top" });
    function cislovaneKarty(s, polozky, box) {
      const n = Math.min(polozky.length, 4), stl = n <= 2 ? n : 2, rad = Math.ceil(n / stl), medz = 0.3;
      const bw = (box.w - medz * (stl - 1)) / stl, bh = Math.min(1.9, (box.h - medz * (rad - 1)) / rad);
      polozky.slice(0, 4).forEach((p, i) => {
        const bx = box.x + (i % stl) * (bw + medz), by = box.y + Math.floor(i / stl) * (bh + medz);
        const farba = roz === "karty" ? t.bg : t.karta;
        s.addShape(pptx.ShapeType.roundRect, { x: bx, y: by, w: bw, h: bh, fill: { color: farba }, line: { color: farba }, rectRadius: 0.12 });
        s.addShape(pptx.ShapeType.ellipse, { x: bx + 0.25, y: by + 0.3, w: 0.6, h: 0.6, fill: { color: AK }, line: { color: AK } });
        s.addText(String(i + 1), { x: bx + 0.25, y: by + 0.3, w: 0.6, h: 0.6, align: "center", valign: "middle", fontSize: 18, bold: true, color: t.tmava ? t.bg : "FFFFFF", fontFace: t.pismoN });
        s.addText(behy(p, { fontSize: 17, color: t.text, fontFace: t.pismoT }), { x: bx + 1.05, y: by + 0.15, w: bw - 1.25, h: bh - 0.3, valign: "middle" });
      });
      return polozky.slice(4);
    }

    // schéma podľa typu (zjednodušená, nie v mierke)
    function schema(s, typKl, b) {
      const voda = t.tmava ? "3E8FC1" : "5DADE2", vodaTm = t.tmava ? "2C6E96" : "2E86C1";
      const sivo = t.tmava ? "8899AA" : "9AA5B1", ve = t.primarna === t.bg ? AK : (t.tmava ? AK : t.primarna);
      const popis = (txt, x, y, w = 2.2, o = {}) => s.addText(txt, { x, y, w, h: 0.4, fontSize: 12, color: t.text, align: "center", fontFace: t.pismoT, ...o });
      const sipka = (x, y, w, h) => s.addShape(pptx.ShapeType.line, { x, y, w, h, line: { color: t.text, width: 1.5, endArrowType: "triangle" } });
      const blok = (x, y, w, h, farba, txt, tc) => { s.addShape(pptx.ShapeType.rect, { x, y, w, h, fill: { color: farba }, line: { color: farba } }); if (txt) s.addText(txt, { x, y, w, h, align: "center", valign: "middle", fontSize: 12, bold: true, color: tc || "FFFFFF", fontFace: t.pismoT }); };
      const { x, y, w, h } = b;
      if (typKl === "kanalova") {
        blok(x, y + 0.6, w, 0.5, voda, "pôvodné koryto toku", "FFFFFF");
        blok(x + w * 0.18, y + 0.45, 0.18, 0.8, sivo);
        popis("vzdúvací objekt (hať)", x + w * 0.18 - 1, y, 2.2);
        blok(x + w * 0.2, y + 1.6, w * 0.6, 0.45, vodaTm, "derivačný (prívodný) kanál");
        s.addShape(pptx.ShapeType.line, { x: x + w * 0.2, y: y + 1.1, w: 0, h: 0.5, line: { color: vodaTm, width: 6 } });
        blok(x + w * 0.8, y + 1.4, 1.2, 0.85, ve, "VE");
        blok(x + w * 0.8 + 1.2, y + 1.6, w * 0.2 - 1.2, 0.45, vodaTm, "");
        s.addShape(pptx.ShapeType.line, { x: x + w - 0.1, y: y + 1.1, w: 0, h: 0.5, line: { color: vodaTm, width: 6 } });
        popis("odpadový kanál späť do toku", x + w - 2.6, y + 2.15, 2.6);
        sipka(x + 0.2, y + 2.7, 1.5, 0); popis("smer prúdenia", x + 1.8, y + 2.5, 1.6, { align: "left" });
      } else if (typKl === "priehradova") {
        s.addShape(pptx.ShapeType.rtTriangle, { x, y: y + 0.4, w: w * 0.45, h: 1.9, fill: { color: voda }, line: { color: voda }, flipH: true });
        popis("nádrž (akumulácia)", x + 0.2, y + 2.0, 2.4, { align: "left", color: t.text });
        s.addShape(pptx.ShapeType.trapezoid, { x: x + w * 0.45, y: y + 0.2, w: 1.2, h: 2.1, fill: { color: sivo }, line: { color: sivo } });
        popis("hrádza / priehrada", x + w * 0.45 - 0.5, y - 0.25, 2.2);
        blok(x + w * 0.45 + 1.3, y + 1.45, 1.3, 0.85, ve, "VE");
        blok(x + w * 0.45 + 2.6, y + 1.9, w * 0.55 - 2.6, 0.4, voda, "tok pod dielom");
        s.addShape(pptx.ShapeType.line, { x: x + w * 0.42, y: y + 2.1, w: 1.7, h: 0, line: { color: vodaTm, width: 4, endArrowType: "triangle" } });
        popis("tlakový privádzač", x + w * 0.45, y + 2.35, 1.8);
      } else if (typKl === "precerpavacia") {
        blok(x, y + 0.1, 2.6, 0.7, voda, "horná nádrž");
        blok(x + w - 2.8, y + 2.2, 2.8, 0.7, voda, "dolná nádrž");
        blok(x + w / 2 - 0.7, y + 2.05, 1.4, 1.0, ve, "PVE");
        s.addShape(pptx.ShapeType.line, { x: x + 1.3, y: y + 0.8, w: w / 2 - 1.9, h: 1.35, line: { color: vodaTm, width: 5 } });
        popis("privádzač", x + w * 0.22, y + 1.0, 1.8);
        s.addShape(pptx.ShapeType.line, { x: x + w / 2 + 0.7, y: y + 2.55, w: w / 2 - 3.5, h: 0, line: { color: vodaTm, width: 5 } });
        s.addText([{ text: "výroba: horná → dolná (špička)", options: { breakLine: true } }, { text: "čerpanie: dolná → horná (prebytok)" }],
          { x: x + w - 4.8, y: y + 0.1, w: 4.8, h: 0.8, fontSize: 13, color: t.text, fontFace: t.pismoT, align: "right" });
      } else {
        blok(x, y + 1.0, w * 0.38, 0.5, voda, "tok / nádrž");
        blok(x + w * 0.38, y + 0.6, 0.25, 1.3, sivo);
        popis(typKl === "prietocna" ? "hať / nízky stupeň" : "vzdúvací objekt", x + w * 0.38 - 1, y + 0.1, 2.2);
        blok(x + w * 0.38 + 0.4, y + 0.85, 1.3, 0.8, ve, typKl === "prietocna" ? "MVE / VE" : "VE");
        blok(x + w * 0.38 + 1.7, y + 1.0, w * 0.62 - 1.7, 0.5, voda, "tok pod dielom");
        sipka(x + 0.2, y + 2.1, 1.5, 0); popis("smer prúdenia", x + 1.8, y + 1.9, 1.6, { align: "left" });
      }
      tlmText(s, "Zjednodušená schéma, nie v mierke. Skutočné usporiadanie doplň podľa situácie diela.", x, y + h - 0.45, w, 0.4, { fontSize: 11 });
    }

    // ===== 1. titulka =====
    {
      const s = pptx.addSlide(); poradie++;
      const v = rng(stav.kod).pick(["plna", "delena", "velka"]);
      const pod = [d.dielo && d.dielo !== d.kratky ? d.dielo : null, `tok ${d.tok}`].filter(Boolean).join(" · ");
      const riadok3 = ["Program č. 4 – vodná stavba s energetickým využitím", predmet].filter(Boolean).join("  ·  ");
      if (v === "plna") {
        s.background = { color: t.primarna };
        s.addShape(pptx.ShapeType.rect, { x: 0.8, y: 2.05, w: 1.4, h: 0.1, fill: { color: AK }, line: { color: AK } });
        s.addText(d.kratky, { x: 0.8, y: 2.3, w: 11.8, h: 1.5, fontSize: 48, bold: true, color: t.naPrimarnej, fontFace: t.pismoN, fit: "shrink" });
        s.addText(pod, { x: 0.8, y: 3.8, w: 11.8, h: 0.6, fontSize: 22, color: t.naPrimarnej, fontFace: t.pismoT, transparency: 10 });
        s.addText(riadok3, { x: 0.8, y: 5.6, w: 11.8, h: 0.4, fontSize: 15, color: t.naPrimarnej, fontFace: t.pismoT });
        s.addText(`${autor}  ·  ${datum}`, { x: 0.8, y: 6.05, w: 11.8, h: 0.4, fontSize: 15, bold: true, color: t.naPrimarnej, fontFace: t.pismoT });
      } else if (v === "delena") {
        s.background = { color: t.bg }; mriezka(s);
        s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 7.2, h: H, fill: { color: t.primarna }, line: { color: t.primarna } });
        s.addShape(pptx.ShapeType.rect, { x: 7.2, y: 0, w: 0.12, h: H, fill: { color: AK }, line: { color: AK } });
        s.addText(d.kratky, { x: 0.6, y: 1.6, w: 6.3, h: 2.2, fontSize: 40, bold: true, color: t.naPrimarnej, fontFace: t.pismoN, valign: "bottom", fit: "shrink" });
        s.addText(pod, { x: 0.6, y: 3.9, w: 6.3, h: 0.9, fontSize: 18, color: t.naPrimarnej, fontFace: t.pismoT, valign: "top" });
        s.addText([{ text: riadok3, options: { breakLine: true } }, { text: `${autor}  ·  ${datum}`, options: { bold: true } }],
          { x: 0.6, y: 5.7, w: 6.3, h: 0.9, fontSize: 13, color: t.naPrimarnej, fontFace: t.pismoT });
        fotoMiesto(s, 7.8, 0.9, 4.9, 5.7);
      } else {
        s.background = { color: t.bg }; mriezka(s);
        s.addText(d.tok.toUpperCase(), { x: 0.8, y: 1.2, w: 11.5, h: 0.5, fontSize: 16, bold: true, color: AK, charSpacing: 6, fontFace: t.pismoT });
        s.addText(d.kratky, { x: 0.8, y: 1.8, w: 11.8, h: 1.9, fontSize: 54, bold: true, color: t.text, fontFace: t.pismoN, fit: "shrink" });
        s.addShape(pptx.ShapeType.rect, { x: 0.8, y: 3.85, w: 11.7, h: 0.05, fill: { color: AK }, line: { color: AK } });
        s.addText(pod, { x: 0.8, y: 4.05, w: 11.8, h: 0.5, fontSize: 18, color: t.tlmeny, fontFace: t.pismoT });
        s.addText(riadok3, { x: 0.8, y: 5.9, w: 8.5, h: 0.4, fontSize: 14, color: t.tlmeny, fontFace: t.pismoT });
        s.addText(`${autor}\n${datum}`, { x: 8.8, y: 5.75, w: 3.8, h: 0.8, fontSize: 14, bold: true, color: t.text, align: "right", fontFace: t.pismoT });
      }
      if (poznamky) s.addNotes(`Predstav sa a povedz, prečo si si vybral(a) práve ${d.kratky}. Ak dielo poznáš z okolia, spomeň to hneď na začiatku.`);
    }

    // ===== 2. čo je to za stavbu =====
    {
      const uvod = fill(rng(stav.kod + "|uvod").pick(DIELA_TEXTY.uvod[ton]));
      const polozky = [
        `Typ: ${typ.nazov}${d.kategoria && !typ.nazov.startsWith(d.kategoria) ? ` (${d.kategoria})` : ""}`,
        `Tok: ${d.tok}; oblasť: ${d.oblast}`,
        d.dielo && d.dielo !== d.kratky ? `Súčasť: ${d.dielo}` : null,
        d.kaskada ? `Kaskáda / sústava: ${d.kaskada}` : null,
        `Do prevádzky: ${d.rok || OVERIT}`,
        `Prevádzkovateľ: ${d.prevadzkovatel || OVERIT}`,
      ].filter(Boolean);
      const { s, box } = snimka("co", `Zdroj údajov: ${(d.zdroje[0] || {}).t || "doplň zdroj"}. ${typ.popis}`);
      const v = R.pick(["foto-vpravo", "foto-vlavo", "cisla"]);
      s.addText(behy(uvod, { fontSize: 20, italic: ton !== "vecny", color: t.text, fontFace: t.pismoT }), { x: box.x, y: box.y, w: box.w, h: 0.8, valign: "top" });
      const b2 = { x: box.x, y: box.y + 0.9, w: box.w, h: box.h - 0.9 };
      if (v === "cisla") {
        zoznam(s, polozky, { x: b2.x, y: b2.y, w: b2.w * 0.62, h: b2.h }, { fontSize: 17 });
        dlazdice(s, [[d.vykon_mw != null ? cislo(d.vykon_mw, 1) : "?", "MW inštalovaný výkon"], [d.rok ? String(d.rok).slice(0, 4) : "?", "uvedenie do prevádzky"]], b2.x + b2.w * 0.66, b2.y, b2.w * 0.34, b2.h - 0.3, "stlpec");
      } else {
        const fw = b2.w * 0.38, lx = v === "foto-vlavo" ? b2.x + fw + 0.4 : b2.x;
        zoznam(s, polozky, { x: lx, y: b2.y, w: b2.w - fw - 0.4, h: b2.h }, { fontSize: 17 });
        fotoMiesto(s, v === "foto-vlavo" ? b2.x : b2.x + b2.w - fw, b2.y, fw, b2.h - 0.3);
      }
    }

    // ===== zaujímavosti (podrobná) =====
    if (podrobna && d.fakty.length) {
      const { s, box } = snimka("zaujimavosti", "Vyber 2–3 zaujímavosti, ktoré povieš vlastnými slovami. Pri každom čísle vedz povedať zdroj.");
      if (R() < 0.5) cislovaneKarty(s, R.shuffle(d.fakty), box);
      else zoznam(s, d.fakty, box, { fontSize: 19 });
    }

    // ===== 3. význam a funkcie =====
    {
      const funkcie = d.funkcie.length ? d.funkcie : [`${DOPLNIT} hlavné funkcie diela (energetika, ochrana pred povodňami, zásobovanie vodou, rekreácia…)`];
      const { s, box } = snimka("funkcie", "Začni najdôležitejšou funkciou. Pri vodných dielach býva energetika často až jednou z viacerých funkcií – vysvetli, ktorá je hlavná.");
      const ost = R() < 0.55 && funkcie.length <= 4 ? cislovaneKarty(s, funkcie, { x: box.x, y: box.y, w: box.w, h: box.h - 0.6 }) : (zoznam(s, funkcie, { x: box.x, y: box.y, w: box.w, h: box.h - 0.6 }, { fontSize: 20 }), []);
      if (ost.length) zoznam(s, ost, { x: box.x, y: box.y + 4.2, w: box.w, h: 0.8 }, { fontSize: 15 });
      tlmText(s, `Typ elektrárne: ${typ.nazov}. ${typ.popis}`, box.x, box.y + box.h - 0.55, box.w, 0.55, { fontSize: 12 });
    }

    // ===== 4. dispozícia =====
    {
      const objekty = d.objekty.length ? d.objekty : [`${DOPLNIT} vzdúvací objekt`, `${DOPLNIT} elektráreň (strojovňa)`, `${DOPLNIT} privádzač / kanál`, `${DOPLNIT} ďalšie objekty`];
      const { s, box } = snimka("dispozicia", "Na schéme ukáž, kadiaľ tečie voda: od vzdúvacieho objektu cez privádzač k turbínam a späť do toku. Ak máš situáciu z mapy (ZBGIS, mapy.com), vlož ju namiesto schémy.");
      const vlavo = R() < 0.5;
      const sw = box.w * 0.6;
      schema(s, d.typ, { x: vlavo ? box.x : box.x + box.w - sw, y: box.y + 0.2, w: sw, h: box.h - 0.2 });
      s.addText(behy("Objektová skladba", { fontSize: 16, bold: true, color: AK, fontFace: t.pismoN }), { x: vlavo ? box.x + sw + 0.4 : box.x, y: box.y, w: box.w - sw - 0.4, h: 0.45 });
      zoznam(s, objekty, { x: vlavo ? box.x + sw + 0.4 : box.x, y: box.y + 0.5, w: box.w - sw - 0.4, h: box.h - 0.5 }, { fontSize: 15 });
    }

    // ===== 5. energetické využitie =====
    const tur = d.turbiny || {};
    {
      const rezim = d.rezim || typ.rezim;
      const polozky = [
        `Typ: ${d.skratka === "MVE" ? "malá vodná elektráreň (MVE)" : d.skratka === "PVE" ? "prečerpávacia vodná elektráreň (PVE)" : "vodná elektráreň (VE)"} – ${typ.nazov}`,
        `Režim prevádzky: ${rezim}`,
        `Turbíny: ${tur.popis || OVERIT}`,
        `Hltnosť: ${d.hltnost || OVERIT}`,
        `Spád: ${d.spad || OVERIT}`,
      ];
      const { s, box } = snimka("energia", "Vysvetli rozdiel medzi inštalovaným výkonom (MW) a ročnou výrobou (GWh). Výkon P ≈ ρ·g·Q·H·η – ak poznáš spád a hltnosť, ukáž hrubý prepočet.");
      const tiles = [
        [d.vykon_mw != null ? cislo(d.vykon_mw, 2) : "?", "MW inštalovaný výkon"],
        [d.vyroba_gwh != null ? cislo(d.vyroba_gwh, 1) : "?", "GWh priemerná ročná výroba"],
        [tur.pocet ? String(tur.pocet) : "?", "počet turbín"],
      ];
      if (R() < 0.5) {
        dlazdice(s, tiles, box.x, box.y, box.w, 1.55);
        zoznam(s, polozky, { x: box.x, y: box.y + 1.85, w: box.w, h: box.h - 1.85 }, { fontSize: 17 });
      } else {
        zoznam(s, polozky, { x: box.x, y: box.y, w: box.w * 0.64, h: box.h }, { fontSize: 17 });
        dlazdice(s, tiles, box.x + box.w * 0.68, box.y, box.w * 0.32, box.h - 0.3, "stlpec");
      }
    }

    // ===== 6. prečo tieto turbíny =====
    {
      let zhody = DIELA_TURBINY.filter((x) => x.kluc.test(`${tur.typ || ""} ${tur.popis || ""}`));
      if (zhody.some((z) => /Horizontálna/.test(z.nazov))) zhody = zhody.filter((z) => z.nazov !== "Kaplanova turbína");
      if (zhody.some((z) => /Trojstrojové/.test(z.nazov)) && zhody.some((z) => /Francis/.test(z.nazov))) zhody = zhody.filter((z) => !/Dériaz/.test(z.nazov));
      zhody = zhody.slice(0, 2);
      const { s, box } = snimka("turbiny", "Typ turbíny vyplýva najmä zo spádu a prietoku (pozri diagram použitia turbín v skriptách). Ak poznáš spád, porovnaj ho s rozsahom pre daný typ.");
      s.addText(behy(`${d.kratky}: ${tur.popis || `${DOPLNIT} typ a počet turbín`}`, { fontSize: 18, bold: true, color: t.text, fontFace: t.pismoT }), { x: box.x, y: box.y, w: box.w, h: 0.8, valign: "top" });
      if (!zhody.length) {
        zoznam(s, [`${DOPLNIT} typ turbín a zdôvodnenie (spád, prietok, režim prevádzky)`], { x: box.x, y: box.y + 1, w: box.w, h: 2 });
      } else {
        const cw = (box.w - 0.4 * (zhody.length - 1)) / zhody.length;
        zhody.forEach((z, i) => {
          const cx = box.x + i * (cw + 0.4);
          s.addText(z.nazov, { x: cx, y: box.y + 1.0, w: cw, h: 0.5, fontSize: 19, bold: true, color: AK, fontFace: t.pismoN });
          zoznam(s, z.preco, { x: cx, y: box.y + 1.55, w: cw, h: box.h - 2.1 }, { fontSize: 16 });
        });
      }
      tlmText(s, "Všeobecná charakteristika typu turbíny; konkrétny spád a hltnosť diela over u prevádzkovateľa.", box.x, box.y + box.h - 0.45, box.w, 0.4, { fontSize: 11 });
    }

    // ===== parametre (podrobná) =====
    if (podrobna) {
      const { s, box } = snimka("parametre", "Tabuľku nečítaj celú – vyber 3 hodnoty, ktoré okomentuješ.");
      const riadky = parametre(d).map(([k, v], i) => [
        { text: k, options: { bold: true, color: t.text, fill: { color: i % 2 ? t.bg : t.karta } } },
        { text: behy(v, { color: t.text }), options: { fill: { color: i % 2 ? t.bg : t.karta } } },
      ]);
      s.addTable(riadky, { x: box.x, y: box.y, w: box.w, colW: [box.w * 0.3, box.w * 0.7], fontSize: 14, fontFace: t.pismoT, border: { type: "solid", pt: 0.5, color: t.tlmeny }, rowH: 0.42 });
    }

    // ===== kaskáda (podrobná, ak je na toku viac diel) =====
    const naToku = stav.diela.filter((x) => x.tok === d.tok);
    if (podrobna && !d.vlastne && naToku.length >= 3) {
      const { s, box } = snimka("kaskada", "Ukáž, kde dielo leží v sústave a ako ovplyvňuje elektrárne nad ním a pod ním (vyrovnávanie prietokov, akumulácia).");
      if (d.kaskada) s.addText(behy(d.kaskada, { fontSize: 18, color: t.text, fontFace: t.pismoT }), { x: box.x, y: box.y, w: box.w, h: 0.6 });
      const naRiadok = 6, bw = (box.w - 0.2 * (naRiadok - 1)) / naRiadok;
      naToku.slice(0, 24).forEach((x, i) => {
        const bx = box.x + (i % naRiadok) * (bw + 0.2), by = box.y + 0.9 + Math.floor(i / naRiadok) * 0.95;
        const ja = x.id === d.id;
        s.addShape(pptx.ShapeType.roundRect, { x: bx, y: by, w: bw, h: 0.7, fill: { color: ja ? AK : (roz === "karty" ? t.bg : t.karta) }, line: { color: ja ? AK : t.tlmeny, width: 0.5 }, rectRadius: 0.1 });
        s.addText(`${x.kratky.replace(/^(M?VE|PVE) /, "")}\n${cislo(x.vykon_mw, 1)} MW`, { x: bx, y: by, w: bw, h: 0.7, align: "center", valign: "middle", fontSize: 11, bold: ja, color: ja ? (t.tmava ? t.bg : "FFFFFF") : t.text, fontFace: t.pismoT });
      });
      tlmText(s, `Diela na toku ${d.tok} v databáze stránky (nie úplný zoznam), zhruba v poradí po toku ${OVERIT}.`, box.x, box.y + box.h - 0.45, box.w, 0.4, { fontSize: 11 });
    }

    // ===== 7. vzdúvadlo a ďalšie objekty =====
    {
      const ob = d.objekty || [];
      const vzd = ob.filter((o) => /hať|priehrad|hrádz|vzdúv|nádrž/i.test(o));
      const plav = ob.filter((o) => /plaveb/i.test(o));
      const ost = ob.filter((o) => !vzd.includes(o) && !plav.includes(o));
      const karty = [
        ["Vzdúvadlo", vzd.length ? vzd.join(", ") : `${DOPLNIT} typ vzdúvacieho objektu (hať, priehrada), počet polí, uzávery`],
        ["Rybovod / biokoridor", `${OVERIT} má dielo rybovod alebo obtokové rameno? (zisti u prevádzkovateľa, SVP, v EIA)`],
        ["Plavba a iné", plav.length ? plav.join(", ") : `plavebná komora: ${OVERIT}; ďalšie: ${ost.length ? ost.join(", ") : DOPLNIT}`],
      ];
      const { s, box } = snimka("objekty", "Ak dielo rybovod nemá, je to dôležitá informácia pre vplyv na prostredie – spomeň to aj na ďalšej snímke.");
      const cw = (box.w - 0.3 * 2) / 3;
      karty.forEach(([nad, txt], i) => {
        const cx = box.x + i * (cw + 0.3);
        const farba = roz === "karty" ? t.bg : t.karta;
        s.addShape(pptx.ShapeType.roundRect, { x: cx, y: box.y, w: cw, h: box.h - 0.5, fill: { color: farba }, line: { color: farba }, rectRadius: 0.12 });
        s.addShape(pptx.ShapeType.rect, { x: cx, y: box.y, w: cw, h: 0.1, fill: { color: AK }, line: { color: AK } });
        s.addText(nad, { x: cx + 0.25, y: box.y + 0.3, w: cw - 0.5, h: 0.6, fontSize: 20, bold: true, color: t.text, fontFace: t.pismoN });
        s.addText(behy(txt, { fontSize: 16, color: t.text, fontFace: t.pismoT }), { x: cx + 0.25, y: box.y + 1.0, w: cw - 0.5, h: box.h - 1.7, valign: "top" });
      });
    }

    // ===== 8. vplyv na prostredie =====
    {
      const V = DIELA_VPLYVY, k = V[d.typ] || V.ine;
      const plus = [...k.plus, ...V.spolocne.plus];
      const minus = [...k.minus, ...V.spolocne.minus];
      if (/špič/i.test(d.rezim || "") || d.typ === "precerpavacia") minus.push(V.spickova);
      for (const f of d.fakty) {
        if (/zanes|sediment/i.test(f)) minus.unshift(`${d.kratky}: ${f}`);
        if (/pramene|biologick|tepeln|vykurov/i.test(f)) plus.unshift(`${d.kratky}: ${f}`);
      }
      const { s, box } = snimka("vplyv", "Odlíš, čo platí všeobecne pre tento typ diela a čo je doložené pre toto konkrétne dielo (so zdrojom).");
      s.addText(behy(rng(stav.kod + "|vu").pick(DIELA_TEXTY.vplyvUvod[ton]), { fontSize: 15, italic: true, color: t.tlmeny, fontFace: t.pismoT }), { x: box.x, y: box.y, w: box.w, h: 0.5 });
      const cw = (box.w - 0.4) / 2, top = box.y + 0.6;
      const stlpce = R() < 0.5 ? [["+ Pozitíva", plus, "2E8B57"], ["– Negatíva", minus, "C0392B"]] : [["Prínosy", plus, "2E8B57"], ["Riziká a straty", minus, "C0392B"]];
      stlpce.forEach(([nad, zoz, f], i) => {
        const cx = box.x + i * (cw + 0.4);
        const fc = t.tmava ? (i ? "FF8A80" : "7BD88F") : f;
        s.addShape(pptx.ShapeType.rect, { x: cx, y: top, w: cw, h: 0.08, fill: { color: fc }, line: { color: fc } });
        s.addText(nad, { x: cx, y: top + 0.12, w: cw, h: 0.5, fontSize: 19, bold: true, color: fc, fontFace: t.pismoN });
        zoznam(s, zoz.slice(0, 6), { x: cx, y: top + 0.7, w: cw, h: box.h - 1.4 }, { fontSize: 14, paraSpaceAfter: 5 });
      });
    }

    // ===== 9. názor obyvateľov =====
    {
      const { s, box } = snimka("nazor", "Názory nevymýšľaj – stačí krátka anketa medzi známymi z okolia. Uveď, koľko ľudí si sa pýtal(a) a kedy.");
      const lw = box.w * 0.55;
      const farba = roz === "karty" ? t.bg : t.karta;
      s.addShape(pptx.ShapeType.roundRect, { x: box.x, y: box.y, w: lw, h: box.h - 0.3, fill: { color: farba }, line: { color: t.tlmeny, width: 0.75, dashType: "dash" }, rectRadius: 0.12 });
      s.addText(riadky([`„${DOPLNIT} citát / názor“`, `– obyvateľ(ka) obce ${DOPLNIT}`, "", `„${DOPLNIT}“`, `– ${DOPLNIT}`, "", `Zhrnutie ankety (n = ${DOPLNIT}): ${DOPLNIT}`], { fontSize: 16, color: t.text, fontFace: t.pismoT }),
        { x: box.x + 0.3, y: box.y + 0.25, w: lw - 0.6, h: box.h - 0.8, valign: "top" });
      const tipy = rng(stav.kod + "|tipy").shuffle(DIELA_TEXTY.nazorTipy).slice(0, 4);
      if (ton === "kriticky") tipy.push(`Otázka do diskusie: postavili by ste ${d.kratky} aj dnes?`);
      if (d.id === "gabcikovo") tipy.unshift("dielo bolo predmetom sporu s Maďarskom – názory sa líšia aj podľa strany rieky");
      s.addText("Ako zistiť názor", { x: box.x + lw + 0.4, y: box.y, w: box.w - lw - 0.4, h: 0.5, fontSize: 18, bold: true, color: AK, fontFace: t.pismoN });
      zoznam(s, tipy, { x: box.x + lw + 0.4, y: box.y + 0.6, w: box.w - lw - 0.4, h: box.h - 0.9 }, { fontSize: 15 });
    }

    // ===== zhrnutie (podrobná) =====
    if (podrobna) {
      const { s, box } = snimka("zaver", "Zopakuj tri čísla, ktoré si majú poslucháči zapamätať.");
      dlazdice(s, [[d.vykon_mw != null ? cislo(d.vykon_mw, 1) : "?", "MW"], [d.vyroba_gwh != null ? cislo(d.vyroba_gwh, 0) : "?", "GWh za rok"], [d.rok ? String(d.rok).slice(0, 4) : "?", "rok spustenia"]], box.x, box.y, box.w, 1.8);
      s.addText(behy(zaverVeta(ton), { fontSize: 22, color: t.text, fontFace: t.pismoN }), { x: box.x, y: box.y + 2.3, w: box.w, h: 1.4, valign: "top" });
    }

    // ===== zdroje =====
    {
      const zdroje = [...(d.zdroje || []).map((z) => `${z.t}. Dostupné na: ${z.u}`),
        `Voda a krajina v obciach – Vodné diela s energetickým využitím. Dostupné na: ${PORTAL}`,
        `Fotografie a mapy: ${DOPLNIT} autor, zdroj, licencia`];
      if (d.vlastne) zdroje.unshift(`${DOPLNIT} webová stránka prevádzkovateľa, SVP, odborná literatúra`);
      const { s, box } = snimka("zdroje", "Pri každom čísle v prezentácii by mal byť jasný zdroj.");
      s.addText(odstavce(zdroje, { fontSize: zdroje.length > 6 ? 11 : 13, color: t.text, fontFace: t.pismoT, bullet: { type: "number" }, paraSpaceAfter: 6 }), { ...box, valign: "top" });
    }

    // ===== ďakujem =====
    {
      const s = pptx.addSlide(); poradie++;
      const tmavaZaver = R() < 0.5;
      s.background = { color: tmavaZaver ? t.primarna : t.bg }; if (!tmavaZaver) mriezka(s);
      const tc = tmavaZaver ? t.naPrimarnej : t.text;
      s.addText(nadpis("dakujem"), { x: 0.8, y: 2.4, w: 11.7, h: 1.4, fontSize: 48, bold: true, color: tc, align: R() < 0.5 ? "center" : "left", fontFace: t.pismoN });
      s.addText(ton === "kriticky" ? zaverVeta("kriticky") : `${autor}  ·  ${d.kratky}`,
        { x: 0.8, y: 4.0, w: 11.7, h: 0.8, fontSize: 18, color: tmavaZaver ? t.naPrimarnej : t.tlmeny, align: "center", fontFace: t.pismoT });
    }

    const subor = `Program4_${bezDiakritiky(d.kratky).replace(/[^a-z0-9]+/g, "_")}_${stav.kod}.pptx`;
    return ulozPptx(pptx, subor).then(() => {
      hlasenie("pptx-hlasenie", `Stiahnuté: ${subor} (${poradie} snímok). Doplň miesta [DOPLNIŤ] a over [OVERIŤ].`);
    }).catch((e) => hlasenie("pptx-hlasenie", "Chyba pri vytváraní prezentácie: " + e.message, true));
  }

  // PptxGenJS pri odseku s viacerými behmi (zvýraznené [OVERIŤ]) zapíše <a:pPr> ku každému behu,
  // čo PowerPoint hlási ako poškodený súbor. Ponecháme len prvé <a:pPr> v každom odseku.
  function opravOdseky(xml) {
    return xml.replace(/<a:p>([\s\S]*?)<\/a:p>/g, (m, vnutro) => {
      let prvy = true;
      return "<a:p>" + vnutro.replace(/<a:pPr\b[^>]*?(?:\/>|>[\s\S]*?<\/a:pPr>)/g, (pp) => (prvy ? ((prvy = false), pp) : "")) + "</a:p>";
    });
  }
  async function ulozPptx(pptx, subor) {
    const ab = await pptx.write({ outputType: "arraybuffer", compression: true });
    const zip = await window.JSZip.loadAsync(ab);
    for (const n of Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))) {
      zip.file(n, opravOdseky(await zip.file(n).async("string")));
    }
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE",
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = subor;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }

  // ---------- prompt pre AI ----------
  function vytvorPrompt() {
    const d = aktualneDielo();
    if (!d) return "";
    const t = efTema(), r = efRozl(), ton = DIELA_TONY.find((x) => x.id === stav.ton);
    const R = rng(stav.kod + "|prompt");
    const pocet = stav.rozsah === "podrobna" ? "13–15" : "10–11";
    const osobitosti = R.shuffle([
      "začni otázkou na publikum",
      "na začiatok daj jedno zaujímavé číslo a vysvetli ho",
      "ročnú výrobu prepočítaj na niečo zrozumiteľné (napr. spotrebu domácností) – výpočet a predpoklady ukáž",
      "zakonči otázkou do diskusie",
      "pridaj krátke porovnanie s inou elektrárňou na tom istom toku alebo v SR",
      "pridaj stručnú históriu výstavby (rok, okolnosti) – len overené údaje",
      "vysvetli princíp výpočtu výkonu P = ρ·g·Q·H·η na údajoch tohto diela (ak sú známe spád a hltnosť)",
    ]).slice(0, 2);
    const udaje = d.vlastne ? ["(stránka o tomto diele nemá údaje – dohľadaj ich, prosím, so zdrojmi)", `Názov: ${d.nazov}`, `Tok: ${d.tok}`, `Typ podľa študenta: ${(DIELA_TYPY[d.typ] || DIELA_TYPY.ine).nazov}`, `Turbíny podľa študenta: ${d.turbiny.typ}`]
      : parametre(d).map(([k, v]) => `${k}: ${v}`).concat(d.rezim ? [`Režim prevádzky: ${d.rezim}`] : [], d.fakty.map((f) => `Fakt: ${f}`));
    const zdroje = (d.zdroje || []).map((z) => `- ${z.t}: ${z.u}`);
    const vystup = {
      texty: `Výstup: pre každú snímku (spolu ${pocet}) uveď nadpis, 3–5 stručných odrážok, návrh obrázka alebo schémy a poznámky pre hovoriaceho (2–4 vety).`,
      python: `Výstup: kompletný skript v Pythone (knižnica python-pptx), ktorý vytvorí súbor .pptx so ${pocet} snímkami 16:9. Vizuálny štýl: pozadie #${t.bg}, text #${t.text}, hlavná farba #${t.primarna}, akcent #${t.akcenty[0]}, nadpisy písmom „${t.pismoN}“, text „${t.pismoT}“, rozloženie „${r.nazov}“ (${r.popis}). Na miesta pre fotky daj rámček s textom „sem vlož fotografiu“. Skript musí bežať bez úprav (python skript.py).`,
      copilot: `Výstup: zadanie (max. 2 000 znakov) pre Copilot v PowerPointe alebo pre Gamma, ktoré vytvorí prezentáciu so ${pocet} snímkami. Zadanie má obsahovať osnovu, kľúčové údaje so zdrojmi a vizuálny štýl: ${t.nazov.toLowerCase()} (${t.popis}), rozloženie „${r.nazov}“.`,
    }[$("vystup-ai").value];
    return [
      `Pomôž mi pripraviť prezentáciu do predmetu o vodných stavbách (Program č. 4: vodná stavba s energetickým využitím). Som študent krajinárstva, prezentáciu budem obhajovať pred vyučujúcim a spolužiakmi.`,
      ``,
      `DIELO: ${d.nazov} (${d.tok}${d.oblast && d.oblast !== DOPLNIT ? `, ${d.oblast}` : ""})`,
      ``,
      `ÚDAJE, KTORÉ MÁM (so zdrojmi nižšie; [OVERIŤ] = treba dohľadať):`,
      ...udaje.map((u) => `- ${u}`),
      ...(zdroje.length ? [``, `ZDROJE:`, ...zdroje] : []),
      ``,
      `PREZENTÁCIA MUSÍ POKRYŤ (v tomto poradí):`,
      `1. čo je to za stavbu,`,
      `2. jej význam a funkcie,`,
      `3. dispozičné riešenie a objektovú skladbu,`,
      `4. podrobnejšie energetické využitie (VE alebo MVE): aký je to typ, v akom režime pracuje, aké má turbíny (typ turbín a prečo práve taký),`,
      `5. stručne vzdúvadlo a iné objekty (napr. biokoridor, rybovod, plavebnú komoru…),`,
      `6. aký je vplyv stavby na okolité prostredie (pozitíva, negatíva),`,
      `7. aký je názor obyvateľov z okolia na stavbu.`,
      ``,
      `ŠTÝL: ${ton.nazov.toLowerCase()} (${ton.popis}). Píš vlastnými slovami, nie šablónovito. Navyše: ${osobitosti.join("; ")}.`,
      vystup,
      ``,
      `PRAVIDLÁ:`,
      `- Nevymýšľaj čísla, mená ani zdroje. Čo nevieš overiť, označ [OVERIŤ].`,
      `- Pri číslach uvádzaj zdroj; na konci daj zoznam zdrojov s odkazmi.`,
      `- Názory obyvateľov nevymýšľaj. Navrhni krátku anketu (5 otázok) a kde hľadať názory (regionálne médiá, obec, rybári, ochranári).`,
      `- Odlíš všeobecné vplyvy daného typu diela od vplyvov doložených pre toto konkrétne dielo.`,
      `- Pri fotografiách navrhni zdroje s licenciou (napr. Wikimedia Commons) a pripomeň uvedenie autora.`,
      `- Ak máš prístup na web, over údaje na stránke prevádzkovateľa, SVP, š. p. a v správach EIA (enviroportal.sk).`,
      `Odpovedaj po slovensky.`,
    ].join("\n");
  }

  // ---------- odkazy ----------
  function vykresliOdkazy() {
    const d = aktualneDielo(), box = $("odkazy");
    if (!d) { box.innerHTML = '<p class="poznamka">Najprv vyberte dielo.</p>'; return; }
    const q = (s) => encodeURIComponent(s);
    const meno = d.vlastne ? d.nazov : (d.dielo && !/^(PVE|VE|MVE) /.test(d.dielo) ? d.dielo : d.kratky);
    const hl = `${d.kratky} ${d.tok !== DOPLNIT ? d.tok : ""}`.trim();
    const skupiny = [
      ["Údaje o diele", (d.zdroje || []).map((z) => [z.t, z.u, "overený zdroj použitý na tejto stránke"])],
      ["Mapy a poloha", [
        ["Google Maps – vyhľadať", `https://www.google.com/maps/search/?api=1&query=${q(hl)}`, "letecký pohľad, fotky"],
        ["Mapy.com – vyhľadať", `https://mapy.com/sk/?q=${q(hl)}`, "turistická a letecká mapa"],
        ["ZBGIS – mapový klient", "https://zbgis.skgeodesy.sk/", "ortofoto, výškopis, toky (GKÚ); dielo nájdite podľa obce"],
      ]],
      ["Fotografie (pozor na licenciu)", [
        ["Wikimedia Commons – fotografie", `https://commons.wikimedia.org/w/index.php?search=${q(meno)}&title=Special:MediaSearch&type=image`, "voľné licencie; uveďte autora a licenciu"],
      ]],
      ["Články a literatúra", [
        ["Wikipédia (sk) – vyhľadať", `https://sk.wikipedia.org/w/index.php?search=${q(meno)}`, "prvý prehľad, údaje overte v primárnych zdrojoch"],
        ["Google Scholar", `https://scholar.google.com/scholar?q=${q(`"${meno}"`)}`, "odborné články, záverečné práce"],
        ["Google – technické parametre", `https://www.google.com/search?q=${q(`"${d.kratky}" turbíny spád hltnosť`)}`, "spád, hltnosť, objekty"],
      ]],
      ["Vplyv na prostredie (EIA, plány)", [
        ["Enviroportál – dokumenty EIA", `https://www.google.com/search?q=${q(`site:enviroportal.sk "${meno}"`)}`, "posudzovanie vplyvov, rekonštrukcie"],
        ["SVP, š. p. – dokumenty", `https://www.google.com/search?q=${q(`site:svp.sk "${meno}"`)}`, "správca tokov, vodné stavby, rybovody"],
      ]],
      ["Názory obyvateľov a médiá", [
        ["Google správy", `https://www.google.com/search?tbm=nws&q=${q(`"${meno}"`)}`, "regionálne médiá, kontroverzie"],
        ["YouTube – videá", `https://www.youtube.com/results?search_query=${q(meno)}`, "exkurzie, reportáže"],
      ]],
    ];
    box.innerHTML = skupiny.filter(([, z]) => z.length).map(([nad, zoz]) => `<h3>${esc(nad)}</h3><ul class="odkazy">${zoz.map(([tx, u, pozn]) =>
      `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(tx)}</a><small>${esc(pozn)}</small></li>`).join("")}</ul>`).join("") +
      `<p class="poznamka">Odkazy v sekciách okrem „Údaje o diele“ sú vyhľadávania – výsledky treba posúdiť. Pri fotkách a mapách vždy uveďte zdroj a licenciu.</p>`;
  }

  // ---------- spoločné ----------
  function hlasenie(id, text, chyba = false) { const el = $(id); el.textContent = text; el.classList.toggle("hlasenie--chyba", chyba); }
  function kopiruj() {
    const p = $("prompt").value;
    const hotovo = () => hlasenie("prompt-hlasenie", "Prompt je skopírovaný do schránky.");
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(p).then(hotovo).catch(() => zaloha());
    return Promise.resolve(zaloha());
    function zaloha() { const ta = $("prompt"); ta.select(); try { document.execCommand("copy"); hotovo(); } catch { hlasenie("prompt-hlasenie", "Skopírujte prompt ručne (Ctrl+C).", true); } }
  }

  function zapisHash() {
    const d = aktualneDielo();
    const p = new URLSearchParams();
    if (d && d.vlastne) p.set("vlastne", d.nazov); else if (d) p.set("dielo", d.id);
    p.set("tema", stav.tema); p.set("rozl", stav.rozl); p.set("ton", stav.ton); p.set("rozsah", stav.rozsah); p.set("v", stav.kod);
    history.replaceState(null, "", "#" + p.toString());
  }
  function citajHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    if (p.get("tema") && (p.get("tema") === "nahodna" || DIELA_TEMY.some((t) => t.id === p.get("tema")))) stav.tema = p.get("tema");
    if (p.get("rozl") && (p.get("rozl") === "nahodne" || DIELA_ROZLOZENIA.some((t) => t.id === p.get("rozl")))) stav.rozl = p.get("rozl");
    if (DIELA_TONY.some((t) => t.id === p.get("ton"))) stav.ton = p.get("ton");
    if (["kompaktna", "podrobna"].includes(p.get("rozsah"))) stav.rozsah = p.get("rozsah");
    if (/^[A-Z0-9]{2,8}$/.test(p.get("v") || "")) stav.kod = p.get("v");
    if (p.get("vlastne")) { stav.vlastne = true; $("v-nazov").value = p.get("vlastne"); }
    else if (p.get("dielo")) stav.dielo = stav.diela.find((d) => d.id === p.get("dielo")) || null;
  }

  function zmena() {
    const d = aktualneDielo();
    $("kod").value = stav.kod;
    $("rezim-vlastne").checked = stav.vlastne; $("vlastne-form").hidden = !stav.vlastne;
    for (const id of ["stiahni", "vytvor-prompt"]) $(id).disabled = !d;
    vykresliInfo(); vykresliNahlad(); vykresliOdkazy();
    if (!$("prompt-vystup").hidden && d) $("prompt").value = vytvorPrompt();
    zapisHash(); uloz();
  }

  function nastavKarty() {
    const tlac = document.querySelectorAll(".karty-vystup [role=tab]");
    tlac.forEach((b) => b.addEventListener("click", () => {
      tlac.forEach((x) => x.setAttribute("aria-selected", String(x === b)));
      document.querySelectorAll(".vystup-panel").forEach((p) => { p.hidden = p.id !== "panel-" + b.dataset.karta; });
    }));
  }

  async function start() {
    const n = nacitaj();
    if (n.tema) stav.tema = n.tema; if (n.rozl) stav.rozl = n.rozl; if (n.ton) stav.ton = n.ton; if (n.rozsah) stav.rozsah = n.rozsah;
    $("autor").value = n.autor || ""; $("predmet").value = n.predmet || "";
    if (typeof n.poznamky === "boolean") $("poznamky").checked = n.poznamky;
    if (n.vystupAI) $("vystup-ai").value = n.vystupAI;
    for (const [k, v] of Object.entries(DIELA_TYPY)) $("v-typ").add(new Option(v.nazov, k));

    try {
      const res = await fetch(DATA);
      if (!res.ok) throw new Error(res.status);
      const j = await res.json();
      stav.diela = j.diela;
    } catch (e) {
      $("dielo-info").hidden = false; $("dielo-info").innerHTML = `<p class="hlasenie hlasenie--chyba">Nepodarilo sa načítať údaje (${esc(e.message)}). Stránku otvorte cez webový server.</p>`;
      return;
    }
    citajHash();
    $("pocet-diel").textContent = stav.diela.length;
    vykresliStyly(); naplnSelect(); nastavHladanie(); nastavKarty();
    $("hladaj").disabled = false;

    $("vyber").addEventListener("change", () => { if ($("vyber").value) vyber($("vyber").value); });
    document.querySelectorAll('input[name="filter"]').forEach((i) => i.addEventListener("change", () => { stav.filter = i.value; naplnSelect(); }));
    $("nahodne").onclick = () => {
      const zoz = filtrovane();
      const ina = zoz.filter((d) => !stav.dielo || d.id !== stav.dielo.id);
      const d = (ina.length ? ina : zoz)[Math.floor(Math.random() * (ina.length || zoz.length))];
      vyber(d.id, { noveVariant: true });
    };
    $("rezim-vlastne").addEventListener("change", () => { stav.vlastne = $("rezim-vlastne").checked; zmena(); });
    for (const id of ["v-nazov", "v-tok", "v-oblast", "v-typ", "v-turbiny"]) $(id).addEventListener("change", zmena);
    $("v-nazov").addEventListener("input", () => { $("stiahni").disabled = $("vytvor-prompt").disabled = !$("v-nazov").value.trim(); });
    for (const id of ["autor", "predmet", "poznamky"]) $(id).addEventListener("change", uloz);
    $("vystup-ai").addEventListener("change", () => { uloz(); if (!$("prompt-vystup").hidden) $("prompt").value = vytvorPrompt(); });

    $("stiahni").onclick = () => { hlasenie("pptx-hlasenie", "Vytváram prezentáciu…"); vytvorPptx(); };
    $("vytvor-prompt").onclick = () => { $("prompt").value = vytvorPrompt(); $("prompt-vystup").hidden = false; $("dlzka").textContent = `${$("prompt").value.length.toLocaleString("sk-SK")} znakov`; };
    $("kopiruj").onclick = () => kopiruj();
    $("claude").onclick = () => kopiruj().then(() => {
      const p = $("prompt").value;
      window.open(p.length < 7000 ? "https://claude.ai/new?q=" + encodeURIComponent(p) : "https://claude.ai/new", "_blank", "noopener");
    });
    $("chatgpt").onclick = () => kopiruj().then(() => window.open("https://chatgpt.com/", "_blank", "noopener"));
    zmena();
  }

  start();
})();
