/* Voda a krajina v obciach – webová mapa (Leaflet). Autor: Šimon Lešiga. Licencia kódu: MIT. */
(function () {
  "use strict";

  const DATA = "data/";
  const MOBIL = window.matchMedia("(max-width: 760px)");

  const POKRYVKA = [
    { k: "p_les", nazov: "les", farba: "var(--les)", hex: "#2f7d32" },
    { k: "p_trava", nazov: "trávne porasty", farba: "var(--trava)", hex: "#b5cf62" },
    { k: "p_polno", nazov: "poľnohosp. pôda", farba: "var(--polno)", hex: "#e8c15a" },
    { k: "p_zast", nazov: "zastavané", farba: "var(--zast)", hex: "#c8463d" },
    { k: "p_ost", nazov: "ostatné", farba: "var(--ost)", hex: "#9aa5b1" },
  ];
  const SKLON_TRIEDY = ["0–1°", "1–3°", "3–7°", "7–12°", "12–17°", "17–25°", ">25°"];

  // Ukazovatele na zafarbenie obcí v mape
  const FARBENIE = {
    p_les: { nazov: "Lesnatosť", jednotka: "%", desatinne: 0, paleta: ["#edf8e9", "#bae4b3", "#74c476", "#31a354", "#006d2c"] },
    s_priemer: { nazov: "Priemerný sklon", jednotka: "°", desatinne: 1, paleta: ["#fff5eb", "#fdd0a2", "#fd8d3c", "#d94801", "#7f2704"] },
    t_hustota: { nazov: "Hustota riečnej siete", jednotka: "km/km²", desatinne: 2, paleta: ["#eff3ff", "#bdd7e7", "#6baed6", "#3182bd", "#08519c"] },
    q_pct: { nazov: "Záplavové územie Q100", jednotka: "%", desatinne: 1, paleta: ["#f7f7f7", "#c6dbef", "#6baed6", "#2171b5", "#08306b"],
      hranice: [0, 1, 3, 6], nula: "nie je zakreslené" },
    v_priemer: { nazov: "Priemerná nadmorská výška", jednotka: "m n. m.", desatinne: 0, paleta: ["#ffffcc", "#c2e699", "#78c679", "#31a354", "#006837"] },
    k_shdi: { nazov: "Diverzita krajiny (SHDI)", jednotka: "", desatinne: 2, paleta: ["#f7fcf5", "#c7e9c0", "#74c476", "#238b45", "#00441b"] },
    k_ed: { nazov: "Hustota okrajov (členitosť)", jednotka: "m/ha", desatinne: 0, paleta: ["#fcfbfd", "#dadaeb", "#9e9ac8", "#6a51a3", "#3f007d"] },
    p_polno: { nazov: "Podiel poľnohosp. pôdy", jednotka: "%", desatinne: 0, paleta: ["#fffbe6", "#fbe7a1", "#f2c94c", "#d69e2e", "#975a16"] },
  };

  const nf = (d) => new Intl.NumberFormat("sk-SK", { minimumFractionDigits: d, maximumFractionDigits: d });
  const cislo = (v, d = 1) => (v === null || v === undefined || Number.isNaN(v) ? "–" : nf(d).format(v));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const datum = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ""); return m ? `${+m[3]}. ${+m[2]}. ${m[1]}` : "–"; };
  const bezDiakritiky = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  const stav = { obce: [], vrstvaObci: null, vybrana: null, farbenie: "p_les", triedy: [], hranice: [] };

  // ---------- mapa ----------
  const mapa = L.map("mapa", { zoomControl: true, zoomSnap: 0.25 });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">prispievatelia OpenStreetMap</a>',
  }).addTo(mapa);
  mapa.attributionControl.setPrefix('<a href="zdroje.html">Zdroje dát</a> · <a href="https://leafletjs.com">Leaflet</a>');

  const panel = document.getElementById("panel");
  const karta = document.getElementById("karta");
  const zavriet = document.getElementById("zavriet");
  const uvodHTML = karta.innerHTML;

  // ---------- načítanie dát ----------
  async function json(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
    return r.json();
  }

  async function start() {
    panel.classList.add("panel--uvod");
    zavriet.hidden = !MOBIL.matches; // na mobile sa dá úvod zavrieť
    const zoznam = await json(DATA + "okresy.json");
    const okresy = zoznam.okresy || [];
    document.getElementById("podnadpis").textContent =
      okresy.length === 1 ? `Okres ${okresy[0].nazov} · ${okresy[0].pocet_obci} obcí` : `${okresy.length} okresov`;

    const vrstvy = { toky: L.layerGroup(), q100: L.layerGroup(), stanice: L.layerGroup() };
    const obceGeo = [];
    for (const o of okresy) {
      const cesta = DATA + o.id + "/";
      const g = await json(cesta + o.subory.obce);
      g.features.forEach((f) => (f.properties._okres = o.nazov));
      obceGeo.push(...g.features);
      if (o.subory.toky) json(cesta + o.subory.toky).then((d) => vrstvy.toky.addLayer(vrstvaTokov(d)));
      if (o.subory.q100) json(cesta + o.subory.q100).then((d) => vrstvy.q100.addLayer(vrstvaQ100(d)));
      if (o.subory.stanice) json(cesta + o.subory.stanice).then((d) => vrstvy.stanice.addLayer(vrstvaStanic(d)));
      stav.hranice.push(o.bbox);
    }
    stav.obce = obceGeo;
    stav.triedy = hraniceTried(stav.farbenie);

    stav.vrstvaObci = L.geoJSON({ type: "FeatureCollection", features: obceGeo }, {
      style: stylObce,
      onEachFeature: (f, l) => {
        l.bindTooltip(esc(f.properties.nazov), { sticky: true, className: "popis-obce" });
        l.on("click", () => vyberObec(f.properties.kod, false));
      },
    }).addTo(mapa);
    vrstvy.q100.addTo(mapa);
    vrstvy.toky.addTo(mapa);
    vrstvy.stanice.addTo(mapa);

    L.control.layers(null, {
      "Obce": stav.vrstvaObci,
      "Vodné toky (ZBGIS)": vrstvy.toky,
      "Záplavové územie Q100 (SVP)": vrstvy.q100,
      "Stanice SHMÚ": vrstvy.stanice,
    }, { collapsed: MOBIL.matches }).addTo(mapa);

    pridajLegendu();
    priblizNaVsetko();
    nastavHladanie();

    const kod = new URLSearchParams(location.hash.slice(1)).get("obec");
    if (kod) vyberObec(Number(kod), true);
  }

  function priblizNaVsetko() {
    const b = stav.hranice.reduce((a, x) => [Math.min(a[0], x[0]), Math.min(a[1], x[1]), Math.max(a[2], x[2]), Math.max(a[3], x[3])],
      [180, 90, -180, -90]);
    mapa.fitBounds([[b[1], b[0]], [b[3], b[2]]],
      MOBIL.matches ? { paddingTopLeft: [0, 70], paddingBottomRight: [0, 180] } : { padding: [10, 10] });
  }

  // ---------- vrstvy ----------
  function vrstvaTokov(d) {
    return L.geoJSON(d, {
      style: (f) => ({ color: "#1f78b4", weight: f.properties.staly ? 1.6 : 1, opacity: f.properties.staly ? 0.85 : 0.5,
        dashArray: f.properties.staly ? null : "3 3" }),
      onEachFeature: (f, l) => f.properties.nazov_toku && l.bindTooltip(esc(f.properties.nazov_toku), { sticky: true }),
      interactive: true,
    });
  }

  function vrstvaQ100(d) {
    return L.geoJSON(d, { style: { color: "#08519c", weight: 0.6, fillColor: "#4292c6", fillOpacity: 0.45 }, interactive: false });
  }

  function vrstvaStanic(d) {
    d.features.sort((a, b) => (a.properties.druh === "vodomerná") - (b.properties.druh === "vodomerná"));
    return L.geoJSON(d, {
      pointToLayer: (f, ll) => L.circleMarker(ll, {
        radius: f.properties.druh === "vodomerná" ? 6 : 4.5, weight: 1.5, color: "#fff",
        fillColor: f.properties.druh === "vodomerná" ? "#08519c" : "#2b8a3e", fillOpacity: 1,
      }),
      onEachFeature: (f, l) => l.bindTooltip(
        `<b>${esc(f.properties.nazov)}</b><br>${esc(f.properties.druh)} stanica SHMÚ${f.properties.typ ? " (" + esc(f.properties.typ) + ")" : ""}`),
    });
  }

  // ---------- zafarbenie obcí ----------
  function hraniceTried(k) {
    if (FARBENIE[k].hranice) return FARBENIE[k].hranice;
    const h = stav.obce.map((f) => f.properties[k]).filter((v) => typeof v === "number").sort((a, b) => a - b);
    if (!h.length) return [];
    return [0.2, 0.4, 0.6, 0.8].map((q) => h[Math.min(h.length - 1, Math.floor(q * h.length))]);
  }

  function farba(v, k) {
    const p = FARBENIE[k].paleta;
    if (typeof v !== "number") return "#cccccc";
    const t = stav.triedy;
    let i = 0;
    while (i < t.length && v > t[i]) i++;
    return p[i];
  }

  function stylObce(f) {
    const vybrana = stav.vybrana === f.properties.kod;
    return {
      color: vybrana ? "#111" : "#40525e", weight: vybrana ? 3 : 0.8,
      fillColor: farba(f.properties[stav.farbenie], stav.farbenie), fillOpacity: 0.55,
    };
  }

  function pridajLegendu() {
    const ctrl = L.control({ position: MOBIL.matches ? "topleft" : "bottomleft" });
    ctrl.onAdd = () => {
      const div = L.DomUtil.create("div", "legenda");
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.disableScrollPropagation(div);
      const sel = document.createElement("select");
      sel.setAttribute("aria-label", "Zafarbiť obce podľa ukazovateľa");
      for (const [k, v] of Object.entries(FARBENIE)) sel.add(new Option(v.nazov, k));
      sel.value = stav.farbenie;
      const telo = document.createElement("div");
      div.append(sel, telo);
      const prekresli = () => {
        stav.farbenie = sel.value;
        stav.triedy = hraniceTried(sel.value);
        stav.vrstvaObci.setStyle(stylObce);
        const F = FARBENIE[sel.value];
        const t = stav.triedy;
        const hodnoty = stav.obce.map((f) => f.properties[sel.value]).filter((v) => typeof v === "number");
        const min = Math.min(...hodnoty), max = Math.max(...hodnoty);
        const hr = [min, ...t, max];
        const popis = (i) => (F.nula && i === 0) ? `0 % – ${F.nula}`
          : (F.hranice && i === F.paleta.length - 1) ? `viac ako ${cislo(hr[i], F.desatinne)} ${F.jednotka}`
          : (F.nula && i === 1) ? `do ${cislo(hr[2], F.desatinne)} ${F.jednotka}`
          : `${cislo(hr[i], F.desatinne)} – ${cislo(hr[i + 1], F.desatinne)} ${F.jednotka}`;
        telo.innerHTML = '<div class="legenda__triedy">' + F.paleta.map((c, i) =>
          `<div class="riadok"><span class="stvorcek" style="background:${c}"></span>${popis(i)}</div>`
        ).join("") + "</div>" +
          `<div class="legenda__gradient"><span style="background:linear-gradient(90deg,${F.paleta.join(",")})"></span>` +
          `<small>${cislo(min, F.desatinne)}</small><small>${cislo(max, F.desatinne)} ${F.jednotka}</small></div>` +
          (F.nula ? '<div class="poznamka">mapy SVP pokrývajú len vybrané úseky tokov</div>' : "") +
          `<div class="legenda__vrstvy">
            <div class="riadok"><span class="ciarka"></span>vodný tok</div>
            <div class="riadok"><span class="stvorcek" style="background:#4292c6;opacity:.6"></span>záplavové územie Q100</div>
            <div class="riadok"><span class="bodka" style="background:#08519c"></span>vodomerná stanica</div>
            <div class="riadok"><span class="bodka" style="background:#2b8a3e"></span>zrážkomerná stanica</div>
          </div>`;
      };
      sel.addEventListener("change", prekresli);
      setTimeout(prekresli, 0);
      return div;
    };
    stav.triedy = hraniceTried(stav.farbenie);
    ctrl.addTo(mapa);
  }

  // ---------- karta obce ----------
  function vyberObec(kod, priblizit) {
    const f = stav.obce.find((x) => x.properties.kod === kod);
    if (!f) return;
    stav.vybrana = kod;
    stav.vrstvaObci.setStyle(stylObce);
    stav.vrstvaObci.eachLayer((l) => { if (l.feature.properties.kod === kod) l.bringToFront(); });
    if (priblizit) {
      const b = L.geoJSON(f).getBounds();
      mapa.fitBounds(b, { paddingTopLeft: [20, 20], paddingBottomRight: MOBIL.matches ? [20, 260] : [20, 20], maxZoom: 13 });
    }
    karta.innerHTML = kartaHTML(f.properties);
    panel.hidden = false;
    panel.classList.remove("panel--uvod");
    zavriet.hidden = false;
    panel.scrollTop = 0;
    history.replaceState(null, "", "#obec=" + kod);
    document.title = `${f.properties.nazov} – Voda a krajina v obciach`;
  }

  function zavriKartu() {
    stav.vybrana = null;
    stav.vrstvaObci.setStyle(stylObce);
    history.replaceState(null, "", location.pathname + location.search);
    document.title = "Voda a krajina v obciach";
    if (MOBIL.matches) {
      panel.hidden = true;
    } else {
      karta.innerHTML = uvodHTML;
      panel.classList.add("panel--uvod");
      zavriet.hidden = true;
    }
  }
  zavriet.addEventListener("click", zavriKartu);

  function polozka(nazov, hodnota, jednotka = "") {
    return `<div><dt>${nazov}</dt><dd>${hodnota}${jednotka ? ` <small>${jednotka}</small>` : ""}</dd></div>`;
  }

  function kartaHTML(p) {
    const triedy = Array.isArray(p.s_triedy) ? p.s_triedy : (() => { try { return JSON.parse(p.s_triedy || "[]"); } catch { return []; } })();
    const maxT = Math.max(1, ...triedy);

    const pruh = POKRYVKA.map((c) => `<span style="width:${p[c.k] || 0}%;background:${c.farba}" title="${c.nazov} ${cislo(p[c.k])} %"></span>`).join("");
    const legPokr = POKRYVKA.map((c) => `<li><span class="stvorcek" style="background:${c.farba}"></span>${c.nazov}<b>${cislo(p[c.k])} %</b></li>`).join("");

    const stlpce = triedy.map((v) => `<div class="stlpec"><span>${cislo(v, 0)}</span><i style="height:${(v / maxT) * 80}%"></i></div>`).join("");

    const q = p.q_zasah
      ? `<p><span class="znacka znacka--ano">Q100 zasahuje do obce</span></p>
         <dl class="cisla">${polozka("Plocha záplavového územia", cislo(p.q_ha, 1), "ha")}${polozka("Podiel z územia obce", cislo(p.q_pct, 1), "%")}</dl>`
      : `<p><span class="znacka znacka--nie">Q100 nie je zakreslené</span></p>`;

    const tokStanica = p.ht_nazov
      ? `<li>${esc(p.ht_nazov)} <small>vodomerná stanica na toku pretekajúcom obcou · ${cislo(p.ht_km)} km</small></li>`
      : `<li><small>Na tokoch obce nie je vodomerná stanica SHMÚ do 15 km.</small></li>`;

    return `<article class="karta">
      <h2>${esc(p.nazov)}</h2>
      <p class="podtitul">okres ${esc(p.okres || p._okres)} · kód obce ${esc(p.kod)}</p>

      <section>
        <h3>Územie a reliéf</h3>
        <dl class="cisla">
          ${polozka("Výmera", cislo(p.vymera_km2, 2), "km²")}
          ${polozka("Výškové rozpätie", cislo(p.v_rozpatie, 0), "m")}
          ${polozka("Najnižší bod", cislo(p.v_min, 0), "m n. m.")}
          ${polozka("Najvyšší bod", cislo(p.v_max, 0), "m n. m.")}
          ${polozka("Priemerná výška", cislo(p.v_priemer, 0), "m n. m.")}
          ${polozka("Priemerný sklon", cislo(p.s_priemer, 1), "°")}
          ${polozka("Sklon – 95. percentil", cislo(p.s_p95, 1), "°")}
          ${polozka("Maximálny sklon", cislo(p.s_max, 1), "°")}
        </dl>
        <p class="poznamka" style="margin-top:10px">Podiel plochy obce v sklonových triedach (%)</p>
        <div class="stlpce" role="img" aria-label="Podiel plochy v sklonových triedach">${stlpce}</div>
        <div class="stlpce-popisy">${SKLON_TRIEDY.map((t) => `<span>${t}</span>`).join("")}</div>
      </section>

      <section>
        <h3>Krajinná pokrývka</h3>
        <div class="pruh" role="img" aria-label="Krajinná pokrývka obce">${pruh}</div>
        <ul class="legenda-pokryvky">${legPokr}</ul>
        <p class="poznamka">Družicová klasifikácia ESA WorldCover 2021 (10 m), nie údaje katastra.</p>
      </section>

      ${p.k_shdi === null || p.k_shdi === undefined ? "" : `<section>
        <h3>Štruktúra krajiny</h3>
        <dl class="cisla">
          ${polozka("Diverzita (Shannonov index)", cislo(p.k_shdi, 2))}
          ${polozka("Počet plôšok", cislo(p.k_plosky, 0))}
          ${polozka("Hustota plôšok", cislo(p.k_pd, 1), "/100 ha")}
          ${polozka("Hustota okrajov", cislo(p.k_ed, 0), "m/ha")}
          ${polozka("Najväčšia plôška", cislo(p.k_lpi, 1), "% územia")}
          ${polozka("Súvislosť lesa (MESH)", cislo(p.k_meff, 0), "ha")}
        </dl>
        <p class="poznamka">Krajinné metriky z ESA WorldCover 2021 (PyLandStats). Vyššia diverzita a hustota okrajov = pestrejšia, členitejšia mozaika.</p>
      </section>`}

      <section>
        <h3>Vodné toky</h3>
        <dl class="cisla">
          ${polozka("Dĺžka tokov", cislo(p.t_dlzka, 1), "km")}
          ${polozka("Hustota riečnej siete", cislo(p.t_hustota, 2), "km/km²")}
        </dl>
        <p><b>Hlavné toky:</b> ${p.t_hlavne ? esc(p.t_hlavne) : "–"}</p>
      </section>

      <section>
        <h3>Povodňové ohrozenie</h3>
        ${q}
        <p class="poznamka">Mapy povodňového ohrozenia SVP (záplavové územie pri prietoku Q100, verzia ${esc(datum(p.q_verzia))}).
          Mapy pokrývajú len vybrané úseky tokov – ak Q100 nie je zakreslené, neznamená to, že obec nie je ohrozená.</p>
      </section>

      <section>
        <h3>Najbližšie stanice SHMÚ</h3>
        <ul class="stanice">
          <li>${esc(p.z_nazov)} <small>zrážkomerná stanica${p.z_typ ? " (" + esc(p.z_typ) + ")" : ""} · ${cislo(p.z_km)} km</small></li>
          <li>${esc(p.h_nazov)} <small>najbližšia vodomerná stanica · ${cislo(p.h_km)} km</small></li>
          ${tokStanica}
        </ul>
        <p class="poznamka">Vzdušná vzdialenosť od ťažiska obce.</p>
      </section>

      <section>
        <p><a class="tlacidlo-odkaz" href="prompt.html#obec=${esc(p.kod)}">Vytvoriť prompt pre AI – rozbor obce ${esc(p.nazov)} →</a></p>
        <p class="poznamka">Hranice obcí platné k ${esc(datum(p.datum_hranic))}. <a href="zdroje.html">Zdroje dát a metodika</a></p>
      </section>
    </article>`;
  }

  // ---------- vyhľadávanie ----------
  function nastavHladanie() {
    const input = document.getElementById("hladaj");
    const ul = document.getElementById("navrhy");
    const zoznam = stav.obce.map((f) => ({ kod: f.properties.kod, nazov: f.properties.nazov,
      okres: f.properties.okres || f.properties._okres, kluc: bezDiakritiky(f.properties.nazov) }))
      .sort((a, b) => a.nazov.localeCompare(b.nazov, "sk"));
    let aktivny = -1, vysledky = [];

    const zobraz = () => {
      const q = bezDiakritiky(input.value.trim());
      if (!q) { ul.hidden = true; input.setAttribute("aria-expanded", "false"); return; }
      const zac = zoznam.filter((o) => o.kluc.startsWith(q));
      const obs = zoznam.filter((o) => !o.kluc.startsWith(q) && o.kluc.includes(q));
      vysledky = [...zac, ...obs].slice(0, 12);
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
      input.value = o.nazov;
      ul.hidden = true;
      input.setAttribute("aria-expanded", "false");
      input.blur();
      vyberObec(o.kod, true);
    };
    input.addEventListener("input", zobraz);
    input.addEventListener("focus", () => input.value && zobraz());
    input.addEventListener("keydown", (e) => {
      if (ul.hidden) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        aktivny = (aktivny + (e.key === "ArrowDown" ? 1 : -1) + vysledky.length) % vysledky.length;
        [...ul.children].forEach((li, i) => li.setAttribute("aria-selected", String(i === aktivny)));
        input.setAttribute("aria-activedescendant", "navrh-" + aktivny);
      } else if (e.key === "Enter") {
        e.preventDefault();
        vyber(aktivny);
      } else if (e.key === "Escape") {
        ul.hidden = true;
      }
    });
    ul.addEventListener("mousedown", (e) => {
      const li = e.target.closest("li[data-i]");
      if (li) { e.preventDefault(); vyber(Number(li.dataset.i)); }
    });
    document.addEventListener("click", (e) => { if (!e.target.closest(".hladanie")) ul.hidden = true; });
  }

  start().catch((e) => {
    console.error(e);
    karta.innerHTML = `<p><b>Dáta sa nepodarilo načítať.</b></p><p class="poznamka">${esc(e.message)}</p>
      <p class="poznamka">Ak stránku otvárate priamo zo súboru, spustite lokálny server (pozri README).</p>`;
  });
})();
