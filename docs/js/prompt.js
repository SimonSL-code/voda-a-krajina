/* Generátor promptu pre AI – rozbor obce. Autor: Šimon Lešiga. Licencia kódu: MIT. */
(function () {
  "use strict";

  const DATA = "data/";
  const ULOZISKO = "vk-prompt-nastavenia";
  const PORTAL = new URL(".", location.href).href;

  const $ = (id) => document.getElementById(id);
  const nf = (d) => new Intl.NumberFormat("sk-SK", { minimumFractionDigits: d, maximumFractionDigits: d });
  const cislo = (v, d = 1) => (v === null || v === undefined || Number.isNaN(v) ? "–" : nf(d).format(v));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const bezDiakritiky = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const datum = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ""); return m ? `${+m[3]}. ${+m[2]}. ${m[1]}` : "–"; };
  const krajGen = (k) => (k ? String(k).replace(/ý$/, "ého") : "príslušného");

  const stav = { obce: [], podlaKodu: new Map(), meta: {}, vybrana: null, detail: null, okresy: new Map() };

  // ---------- nastavenia (zapamätanie výberu) ----------
  function nacitajNastavenia() {
    try { return JSON.parse(localStorage.getItem(ULOZISKO)) || {}; } catch { return {}; }
  }
  function ulozNastavenia() {
    try {
      localStorage.setItem(ULOZISKO, JSON.stringify({
        temy: vybraneTemy().map((t) => t.id), ucel: $("ucel").value, rozsah: $("rozsah").value, tabulka: $("tabulka").checked,
      }));
    } catch { /* úložisko nemusí byť dostupné */ }
  }

  // ---------- formulár ----------
  function vykresliFormular() {
    const n = nacitajNastavenia();
    const zvolene = new Set(n.temy || AI_TEMY.filter((t) => t.predvolene).map((t) => t.id));
    $("temy").innerHTML = AI_TEMY.map((t) => `
      <label class="tema"><input type="checkbox" value="${t.id}" ${zvolene.has(t.id) ? "checked" : ""}>
        <span>${esc(t.nazov)}<small>${esc(t.co)}</small></span></label>`).join("");
    for (const u of AI_UCELY) $("ucel").add(new Option(u.nazov, u.id));
    for (const r of AI_ROZSAHY) $("rozsah").add(new Option(r.nazov, r.id));
    if (n.ucel) $("ucel").value = n.ucel;
    $("rozsah").value = n.rozsah || "stredne";
    if (typeof n.tabulka === "boolean") $("tabulka").checked = n.tabulka;

    $("vsetky").onclick = () => { $("temy").querySelectorAll("input").forEach((i) => (i.checked = true)); zmena(); };
    $("ziadne").onclick = () => { $("temy").querySelectorAll("input").forEach((i) => (i.checked = false)); zmena(); };
    for (const el of [$("temy"), $("ucel"), $("rozsah"), $("tabulka"), $("doplnenie")]) el.addEventListener("change", zmena);
    $("vytvor").onclick = vytvor;
    $("kopiruj").onclick = () => kopiruj();
    $("claude").onclick = () => kopiruj().then(() => {
      const p = $("prompt").value;
      const url = p.length < 7000 ? "https://claude.ai/new?q=" + encodeURIComponent(p) : "https://claude.ai/new";
      window.open(url, "_blank", "noopener");
    });
    $("chatgpt").onclick = () => kopiruj().then(() => window.open("https://chatgpt.com/", "_blank", "noopener"));
  }

  function vybraneTemy() {
    const ids = new Set([...$("temy").querySelectorAll("input:checked")].map((i) => i.value));
    return AI_TEMY.filter((t) => ids.has(t.id));
  }

  function zmena() {
    ulozNastavenia();
    $("vytvor").disabled = !stav.vybrana || vybraneTemy().length === 0;
    if (!$("vystup").hidden && stav.vybrana) vytvor();
  }

  // ---------- obce ----------
  async function nacitajObce() {
    const r = await fetch(DATA + "obce_sr.json");
    if (!r.ok) throw new Error("data/obce_sr.json: " + r.status);
    const d = await r.json();
    const s = d.stlpce;
    stav.meta = d;
    stav.obce = d.obce.map((row) => Object.fromEntries(s.map((k, i) => [k, row[i]])));
    stav.obce.forEach((o) => { o.kluc = bezDiakritiky(o.nazov); stav.podlaKodu.set(o.kod, o); });
    // rovnaké názvy obcí v rôznych okresoch – pri nich zobrazujeme okres
    const pocty = {};
    stav.obce.forEach((o) => (pocty[o.kluc] = (pocty[o.kluc] || 0) + 1));
    stav.obce.forEach((o) => (o.duplicita = pocty[o.kluc] > 1));
  }

  async function nacitajDetail(o) {
    if (!o.okres_id) return null;
    if (!stav.okresy.has(o.okres_id)) {
      const zoznam = await fetch(DATA + "okresy.json").then((r) => r.json()).catch(() => ({ okresy: [] }));
      const okr = zoznam.okresy.find((x) => x.id === o.okres_id);
      if (!okr) return null;
      const g = await fetch(DATA + okr.id + "/" + okr.subory.obce).then((r) => r.json());
      stav.okresy.set(o.okres_id, new Map(g.features.map((f) => [f.properties.kod, f.properties])));
    }
    return stav.okresy.get(o.okres_id).get(o.kod) || null;
  }

  function nazovSOkresom(o, voci) {
    return o.okres !== voci ? `${o.nazov} (okres ${o.okres})` : o.nazov;
  }

  async function vyberObec(kod) {
    const o = stav.podlaKodu.get(kod);
    if (!o) return;
    stav.vybrana = o;
    $("hladaj").value = o.nazov;
    history.replaceState(null, "", "#obec=" + kod);
    document.title = `Prompt pre AI – ${o.nazov} · Voda a krajina v obciach`;
    stav.detail = null;
    vykresliInfo(o, "načítavam…");
    try { stav.detail = await nacitajDetail(o); } catch (e) { console.error(e); }
    if (stav.vybrana !== o) return;
    vykresliInfo(o);
    zmena();
  }

  function vykresliInfo(o, stavDetailu) {
    const susedia = (o.susedia || []).map((k) => stav.podlaKodu.get(k)).filter(Boolean);
    const stitok = stavDetailu
      ? `<span class="stitok stitok--nie">${esc(stavDetailu)}</span>`
      : stav.detail
        ? `<span class="stitok stitok--ano">portál má pre obec vypočítané ukazovatele – pridajú sa do promptu</span>
           <a href="index.html#obec=${o.kod}">zobraziť na mape</a>`
        : `<span class="stitok stitok--nie">pre tento okres portál zatiaľ nemá ukazovatele – AI ich dohľadá v zdrojoch</span>`;
    $("obec-info").innerHTML = `<b>${esc(o.nazov)}</b> · okres ${esc(o.okres)} · ${esc(o.kraj)} kraj<br>
      kód obce ${esc(o.kod)} · výmera ${cislo(o.vymera_km2, 2)} km²<br>
      susedné obce: ${susedia.length ? esc(susedia.map((s) => nazovSOkresom(s, o.okres)).join(", ")) : "–"}<br>${stitok}`;
    $("obec-info").hidden = false;
  }

  // ---------- prompt ----------
  function blokPortalu(p) {
    const triedy = Array.isArray(p.s_triedy) ? p.s_triedy : (() => { try { return JSON.parse(p.s_triedy || "[]"); } catch { return []; } })();
    const popisy = ["0–1°", "1–3°", "3–7°", "7–12°", "12–17°", "17–25°", ">25°"];
    const sklony = triedy.map((v, i) => `${popisy[i]}: ${cislo(v, 1)} %`).join(", ");
    const q = p.q_zasah
      ? `záplavové územie Q100 je v obci zakreslené na ploche ${cislo(p.q_ha, 1)} ha, t. j. ${cislo(p.q_pct, 1)} % územia obce`
      : "záplavové územie Q100 nie je v mapách SVP v obci zakreslené (mapy pokrývajú len vybrané úseky tokov – neznamená to, že obec nie je ohrozená)";
    const tokSt = p.ht_nazov ? `${p.ht_nazov} (${cislo(p.ht_km, 1)} km) – najbližšia vodomerná stanica na toku, ktorý preteká obcou`
      : "na tokoch obce nie je vodomerná stanica SHMÚ do 15 km";
    return [
      `Ukazovatele vypočítal automaticky portál „Voda a krajina v obciach“ z verejných údajov (metodika a zdroje: ${PORTAL}zdroje.html). Používaj ich ako východisko a pri ich použití uveď zdroj.`,
      `- Reliéf (DMR 3.5, 10 m, GKÚ Bratislava): nadmorská výška ${cislo(p.v_min, 0)}–${cislo(p.v_max, 0)} m n. m. (Bpv), priemerná ${cislo(p.v_priemer, 0)} m n. m., výškové rozpätie ${cislo(p.v_rozpatie, 0)} m; priemerný sklon ${cislo(p.s_priemer, 1)}°, 95. percentil sklonu ${cislo(p.s_p95, 1)}°, maximálny sklon ${cislo(p.s_max, 1)}°.`,
      sklony ? `- Podiel plochy obce v sklonových triedach: ${sklony}.` : "",
      `- Krajinná pokrývka (ESA WorldCover 2021, 10 m; družicová klasifikácia, nie údaje katastra): les ${cislo(p.p_les, 1)} %, trávne porasty ${cislo(p.p_trava, 1)} %, poľnohospodárska pôda ${cislo(p.p_polno, 1)} %, zastavané plochy ${cislo(p.p_zast, 1)} %, ostatné ${cislo(p.p_ost, 1)} % (z toho vodné plochy ${cislo(p.p_voda, 1)} %).`,
      `- Vodné toky (INSPIRE Hydrografia / ZBGIS, GKÚ Bratislava): dĺžka tokov v obci ${cislo(p.t_dlzka, 1)} km, z toho stále toky ${cislo(p.t_stale, 1)} km; hustota riečnej siete ${cislo(p.t_hustota, 2)} km/km²; najdlhšie toky v obci: ${p.t_hlavne || "–"}.`,
      `- Povodňové ohrozenie (SVP, š. p., mapy povodňového ohrozenia, verzia údajov ${datum(p.q_verzia)}): ${q}.`,
      `- Najbližšie stanice SHMÚ (vzdušná vzdialenosť od ťažiska obce): zrážkomerná ${p.z_nazov} (${cislo(p.z_km, 1)} km); vodomerná ${p.h_nazov} (${cislo(p.h_km, 1)} km); ${tokSt}.`,
    ].filter(Boolean).join("\n");
  }

  function vytvorText() {
    const o = stav.vybrana;
    const p = stav.detail;
    const temy = vybraneTemy();
    const ucel = AI_UCELY.find((u) => u.id === $("ucel").value)?.nazov || "";
    const rozsah = AI_ROZSAHY.find((r) => r.id === $("rozsah").value)?.nazov || "";
    const doplnenie = $("doplnenie").value.trim();
    const susedia = (o.susedia || []).map((k) => stav.podlaKodu.get(k)).filter(Boolean).map((s) => nazovSOkresom(s, o.okres));

    const kapitoly = temy.map((t, i) => {
      const zdroje = t.zdroje.map((z) => {
        const nazov = z.nazov.replace("príslušného kraja", `${krajGen(o.kraj)} kraja`);
        return z.url ? `${nazov} (${z.url})` : nazov;
      }).join("; ");
      return `${i + 1}. ${t.nazov} – ${t.co}.\n   Odporúčané zdroje: ${zdroje}.`;
    }).join("\n");

    return [
      `Si odborník na krajinné plánovanie, vodné hospodárstvo krajiny a prírodné pomery Slovenska. Priprav text pre účel „${ucel}“ pre obec ${o.nazov} (okres ${o.okres}).`,
      "",
      "## 1. Identifikácia obce",
      `- Obec: ${o.nazov}, kód obce ${o.kod}${o.lau2 ? `, LAU2 ${o.lau2}` : ""}`,
      `- Okres: ${o.okres}; kraj: ${o.kraj} kraj`,
      `- Výmera územia obce: ${cislo(o.vymera_km2, 2)} km² (hranice GKÚ Bratislava, stav k ${datum(stav.meta.datum_hranic)})`,
      `- Poloha ťažiska územia obce: ${cislo(o.lat, 5)}° s. š., ${cislo(o.lon, 5)}° v. d. (WGS 84)`,
      `- Susedné obce: ${susedia.length ? susedia.join(", ") : "–"}`,
      "",
      "## 2. Údaje z portálu",
      p ? blokPortalu(p) : "Pre túto obec portál zatiaľ nemá vypočítané ukazovatele. Potrebné údaje dohľadaj v odporúčaných zdrojoch.",
      "",
      "## 3. Úloha",
      "Spracuj tieto kapitoly v uvedenom poradí, každú s vlastným nadpisom:",
      kapitoly,
      `Rozsah: ${rozsah}.`,
      doplnenie ? `Doplňujúce informácie od zadávateľa: ${doplnenie}` : "",
      "",
      "## 4. Pravidlá",
      `1. Píš po slovensky, vecným odborným štýlom vhodným pre účel „${ucel}“.`,
      "2. Nevymýšľaj čísla, názvy, roky ani citácie. Ak údaj nepoznáš s istotou alebo ho nevieš overiť v zdroji, napíš [OVERIŤ] a uveď, kde ho získať.",
      "3. Ak máš prístup na web, vyhľadaj údaje v odporúčaných zdrojoch a pri každom údaji uveď konkrétny zdroj (inštitúcia, dielo alebo URL). Ak prístup na web nemáš, uveď to na začiatku odpovede.",
      "4. Pri údajoch rozlišuj pôvod: (P) údaj z portálu uvedený vyššie, (Z) údaj dohľadaný v konkrétnom zdroji, (V) všeobecná odborná znalosť bez konkrétneho zdroja.",
      "5. Údaje z portálu nemeň. Ak nájdeš rozpor s iným zdrojom, uveď obe hodnoty a možný dôvod rozdielu (iný zdroj, mierka, rok, metodika).",
      $("tabulka").checked
        ? "6. Na konci uveď zoznam použitých zdrojov a tabuľku chýbajúcich alebo neoverených údajov (údaj – kde ho získať – poznámka)."
        : "6. Na konci uveď zoznam použitých zdrojov.",
    ].filter((r) => r !== null && r !== undefined).join("\n").replace(/\n{3,}/g, "\n\n");
  }

  function vytvor() {
    if (!stav.vybrana || vybraneTemy().length === 0) return;
    const text = vytvorText();
    $("prompt").value = text;
    $("dlzka").textContent = `${text.length.toLocaleString("sk-SK")} znakov`;
    $("vystup").hidden = false;
    $("hlasenie").textContent = "";
  }

  async function kopiruj() {
    const t = $("prompt");
    try {
      await navigator.clipboard.writeText(t.value);
    } catch {
      t.focus(); t.select();
      try { document.execCommand("copy"); } catch { /* nič */ }
    }
    $("hlasenie").textContent = "Prompt je skopírovaný do schránky.";
  }

  // ---------- vyhľadávanie ----------
  function nastavHladanie() {
    const input = $("hladaj");
    const ul = $("navrhy");
    let aktivny = -1, vysledky = [];
    const zobraz = () => {
      const q = bezDiakritiky(input.value.trim());
      if (!q) { ul.hidden = true; input.setAttribute("aria-expanded", "false"); return; }
      const zac = stav.obce.filter((o) => o.kluc.startsWith(q));
      const obs = q.length >= 3 ? stav.obce.filter((o) => !o.kluc.startsWith(q) && o.kluc.includes(q)) : [];
      vysledky = [...zac, ...obs].slice(0, 15);
      aktivny = vysledky.length ? 0 : -1;
      ul.innerHTML = vysledky.length
        ? vysledky.map((o, i) => `<li role="option" id="navrh-${i}" data-i="${i}" aria-selected="${i === aktivny}">${esc(o.nazov)}<small>okres ${esc(o.okres)}</small></li>`).join("")
        : '<li aria-disabled="true">Obec sa nenašla</li>';
      ul.hidden = false;
      input.setAttribute("aria-expanded", "true");
    };
    const vyber = (i) => {
      const o = vysledky[i];
      if (!o) return;
      ul.hidden = true;
      input.setAttribute("aria-expanded", "false");
      vyberObec(o.kod);
    };
    input.addEventListener("input", zobraz);
    input.addEventListener("focus", () => { if (input.value) { input.select(); zobraz(); } });
    input.addEventListener("keydown", (e) => {
      if (ul.hidden) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        aktivny = (aktivny + (e.key === "ArrowDown" ? 1 : -1) + vysledky.length) % vysledky.length;
        [...ul.children].forEach((li, i) => li.setAttribute("aria-selected", String(i === aktivny)));
        input.setAttribute("aria-activedescendant", "navrh-" + aktivny);
      } else if (e.key === "Enter") { e.preventDefault(); vyber(aktivny); }
      else if (e.key === "Escape") { ul.hidden = true; }
    });
    ul.addEventListener("mousedown", (e) => {
      const li = e.target.closest("li[data-i]");
      if (li) { e.preventDefault(); vyber(Number(li.dataset.i)); }
    });
    document.addEventListener("click", (e) => { if (!e.target.closest(".hladanie")) ul.hidden = true; });
  }

  // ---------- štart ----------
  vykresliFormular();
  nacitajObce().then(() => {
    $("hladaj").disabled = false;
    $("hladaj").placeholder = `Začnite písať názov obce (${stav.obce.length.toLocaleString("sk-SK")} obcí)…`;
    nastavHladanie();
    const kod = Number(new URLSearchParams(location.hash.slice(1)).get("obec"));
    if (kod) vyberObec(kod);
  }).catch((e) => {
    console.error(e);
    $("obec-info").hidden = false;
    $("obec-info").innerHTML = `<b>Zoznam obcí sa nepodarilo načítať.</b><br>${esc(e.message)}<br>
      Spustite <code>python scripts/11_obce_sr.py</code> a stránku otvorte cez lokálny server (pozri README).`;
  });
})();
