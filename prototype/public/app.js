// BuyRight front end (vanilla JS). Verdicts come from /api/check; the browser never decides fit itself.
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const inr = (n) => "₹" + Number(n).toLocaleString("en-IN");
const store = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };

const CATS = { ac: "Air conditioners", charger: "Chargers & power banks", rack: "Shoe racks" };
const WORD = { ac: "room", charger: "phone", rack: "space" };
let DATA = null, current = null, cat = store.get("br.cat", "ac");

const FORMS = {
  ac: (d) => [
    num("room_sqft", "Room size (sq ft)", "e.g. 150", "Length x breadth in feet"),
    sel("city", "City", d.cities.map((c) => [c, c]), "We use its peak summer temperature"),
    sel("top_floor_or_west_sun", "Top floor or strong afternoon sun?", [["", "Not sure"], ["false", "No"], ["true", "Yes"]]),
    num("ceiling_ft", "Ceiling height (ft)", "10"),
    num("occupants", "People usually in the room", "2"),
    sel("voltage", "Power supply", [["unknown", "Not sure"], ["stable", "Stable"], ["fluctuating", "Frequent voltage drops"]]),
    sel("outdoor_space", "Spot for an outdoor unit? (split AC)", [["unknown", "Not sure"], ["yes", "Yes"], ["no", "No"]]),
    num("window_w_cm", "Window width (cm)", "window AC only"),
    num("window_h_cm", "Window height (cm)", "window AC only"),
  ],
  charger: (d) => [
    sel("phone_id", "Your phone", [["", "Choose your phone"], ...d.phones.map((p) => [p.id, p.name])]),
    sel("goal", "What matters", [["fast", "Fast charging"], ["basic", "Just charging, speed doesn't matter"]]),
    num("laptop_w", "Also charge a laptop? Its USB-C wattage", "e.g. 65, leave blank if not"),
  ],
  rack: () => [
    num("space_w_cm", "Space width (cm)", "e.g. 70"),
    num("space_d_cm", "Space depth (cm)", "e.g. 35"),
    num("space_h_cm", "Space height (cm)", "e.g. 120"),
    num("pairs", "Pairs to store", "e.g. 12"),
    num("shoe_uk", "Largest shoe size (UK)", "e.g. 9"),
    sel("can_drill", "Can you drill into the wall?", [["unknown", "Not sure"], ["yes", "Yes"], ["no", "No (rented or not allowed)"]]),
    num("front_clearance_cm", "Free space in front (cm)", "for cabinets with doors"),
  ],
};
const PRESETS = {
  ac: [["180 sq ft top floor, Jaipur", { room_sqft: 180, city: "Jaipur", top_floor_or_west_sun: "true", voltage: "fluctuating", outdoor_space: "yes", ceiling_ft: "", occupants: "", window_w_cm: "", window_h_cm: "" }],
       ["110 sq ft bedroom, Pune", { room_sqft: 110, city: "Pune", top_floor_or_west_sun: "false", voltage: "stable", outdoor_space: "yes", ceiling_ft: "", occupants: "", window_w_cm: 70, window_h_cm: 50 }],
       ["140 sq ft, Nagpur, voltage drops", { room_sqft: 140, city: "Nagpur", top_floor_or_west_sun: "false", voltage: "fluctuating", outdoor_space: "yes", ceiling_ft: "", occupants: "", window_w_cm: 60, window_h_cm: 45 }]],
  charger: [["Orbit S24 Ultra", { phone_id: "orbit-s24-ultra", goal: "fast", laptop_w: "" }], ["Aster 11 (Lightning)", { phone_id: "aster-11", goal: "fast", laptop_w: "" }], ["Rhea 12 + 65 W laptop", { phone_id: "rhea-12", goal: "fast", laptop_w: 65 }]],
  rack: [["70 cm alcove, UK 10, renting", { space_w_cm: 70, space_d_cm: 32, space_h_cm: 120, pairs: 12, shoe_uk: 10, can_drill: "no", front_clearance_cm: 50 }],
         ["Narrow passage, 20 cm deep", { space_w_cm: 65, space_d_cm: 20, space_h_cm: 130, pairs: 14, shoe_uk: 7, can_drill: "yes", front_clearance_cm: 35 }],
         ["Big family, 22 pairs", { space_w_cm: 100, space_d_cm: 40, space_h_cm: 110, pairs: 22, shoe_uk: 9, can_drill: "yes", front_clearance_cm: 60 }]],
};
const ASKS = {
  ac: ["Will it cool my room on May afternoons?", "Do I need a stabilizer?", "Is it quiet enough for a bedroom?", "What did owners with rooms like mine say?"],
  charger: ["Will it fast-charge my phone?", "Do I need another cable?", "Can it charge my laptop too?", "Does it come with a braided cable?"],
  rack: ["Will my biggest shoes fit?", "Do I need to drill the wall?", "How long does assembly take?", "Will it fit boots?"],
};
function num(k, label, ph, hint) { return { k, label, html: `<input type="number" inputmode="decimal" name="${k}" placeholder="${esc(ph || "")}" min="0">`, hint }; }
function sel(k, label, opts, hint) { return { k, label, html: `<select name="${k}">${opts.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join("")}</select>`, hint }; }

async function api(path, body) {
  const r = await fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
  const j = await r.json().catch(() => ({ state: "error", answer: "The server sent an unreadable reply." }));
  if (!r.ok && !j.state) j.state = "error";
  return j;
}

async function init() {
  api("/api/health").then((h) => {
    const p = (h.models || [])[0], f = (h.models || []).slice(1).map((m) => m.model).join(", ");
    const b = $("#modelBadge");
    if (p && p.configured) { b.innerHTML = `<span class="dot"></span>AI: ${esc(p.model)} (${esc(p.provider)}) · fallback ${esc(f)}`; }
    else { b.classList.add("off"); b.innerHTML = `<span class="dot"></span>AI keys not configured: rule-based summaries only`; }
  }).catch(() => { $("#modelBadge").textContent = "Model status unavailable"; });
  DATA = await api("/api/catalog");
  renderTabs();
  // Shareable demo links: ?p=AC02&preset=0&ask=Do%20I%20need%20a%20stabilizer%3F
  const qs = new URLSearchParams(location.search);
  const linked = DATA.products.find((p) => p.id === qs.get("p"));
  if (linked) { cat = linked.category; current = null; window.__linked = qs.has("preset"); }
  const last = store.get("br.product", null);
  const first = linked || DATA.products.find((p) => p.id === last && p.category === cat) || DATA.products.find((p) => p.category === cat);
  openProduct(first.id);
  if (linked && qs.has("preset") && PRESETS[cat][Number(qs.get("preset"))]) { fillForm(PRESETS[cat][Number(qs.get("preset"))][1]); await runCheck(); }
  if (linked && qs.get("ask")) { $("#askInput").value = qs.get("ask"); runAsk(); }
}

function renderTabs() {
  $("#tabs").innerHTML = Object.entries(CATS).map(([k, v]) => `<button role="tab" aria-selected="${k === cat}" data-cat="${k}">${v}</button>`).join("");
  $("#tabs").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; cat = b.dataset.cat; store.set("br.cat", cat); renderTabs(); openProduct(DATA.products.find((p) => p.category === cat).id); };
  $("#productList").innerHTML = DATA.products.filter((p) => p.category === cat).map((p) =>
    `<li><button data-id="${p.id}" aria-current="${current && current.id === p.id}"><span class="pn">${esc(p.name)}</span><span class="pm">${inr(p.price_inr)} · ★ ${p.rating} (${p.ratings_count.toLocaleString("en-IN")})</span></button></li>`).join("");
  $("#productList").onclick = (e) => { const b = e.target.closest("button"); if (b) openProduct(b.dataset.id); };
}

function keySpecs(p) {
  const s = p.specs;
  if (p.category === "ac") return [`${s.capacity_tons} ton`, `${s.type} AC`, `${s.star_rating} star`, `cools up to ${s.max_ambient_c}°C outside`, `${s.voltage_range_v[0]}–${s.voltage_range_v[1]} V`];
  if (p.category === "charger") return [...s.ports.map((x) => `USB-${x.type}: ${["pd", "pps", "qc"].filter((k) => x[k]).map((k) => `${k.toUpperCase()} ${x[k]} W`).join(", ")}`), s.capacity_mah ? `${s.capacity_mah} mAh` : null, s.cable_included ? `${s.cable_included} cable` : "no cable in box"].filter(Boolean);
  return [`${s.dimensions_cm.w} x ${s.dimensions_cm.d} x ${s.dimensions_cm.h} cm`, `${s.capacity_pairs} pairs`, `shelf ${s.shelf_depth_cm} cm deep`, s.closed ? "closed cabinet" : "open shelves", s.mounting === "wall" ? "wall-mounted" : s.mounting === "anchor" ? "wall anchor" : "free-standing"];
}

function openProduct(id) {
  const p = DATA.products.find((x) => x.id === id); if (!p) return;
  const changedCat = !current || current.category !== p.category;
  current = p; store.set("br.product", id);
  if (p.category !== cat) { cat = p.category; store.set("br.cat", cat); }
  renderTabs();
  $("#product").innerHTML = `<h1>${esc(p.name)}</h1><div class="meta"><span class="price">${inr(p.price_inr)}</span><span>★ ${p.rating} · ${p.ratings_count.toLocaleString("en-IN")} ratings</span><span>${esc(p.brand)}</span></div>
    <div class="keyspecs">${keySpecs(p).map((k) => `<span>${esc(k)}</span>`).join("")}</div>`;
  $("#situationWord").textContent = WORD[p.category];
  if (changedCat) renderForm();
  $("#presets").innerHTML = `<span class="fine" style="align-self:center">Try:</span>` + PRESETS[p.category].map(([t], i) => `<button type="button" data-i="${i}">${esc(t)}</button>`).join("");
  $("#presets").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; fillForm(PRESETS[cat][b.dataset.i][1]); runCheck(); };
  $("#askChips").innerHTML = ASKS[p.category].map((q) => `<button type="button">${esc(q)}</button>`).join("");
  $("#askChips").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; $("#askInput").value = b.textContent; runAsk(); };
  $("#result").innerHTML = ""; $("#askOut").innerHTML = "";
  $("#specs").innerHTML = Object.entries(p.specs).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(typeof v === "object" && v !== null ? JSON.stringify(v) : v ?? "not listed")}</td></tr>`).join("");
  $("#revSummary").textContent = `All reviews (${p.review_count})`;
  $("#allReviews").innerHTML = "<p class='fine'>Loading…</p>";
  api(`/api/catalog?reviews=${p.id}`).then((j) => { $("#allReviews").innerHTML = j.reviews.map(revHtml).join(""); });
  const saved = store.get(`br.profile.${p.category}`, null);
  if (!window.__linked && saved && Object.values(saved).some((v) => v !== "" && v !== "unknown" && v !== "fast")) runCheck();
  window.__linked = false;
}

function renderForm() {
  const fields = FORMS[cat](DATA);
  $("#profileForm").innerHTML = fields.map((f) => `<label>${esc(f.label)}${f.html}${f.hint ? `<span class="hint">${esc(f.hint)}</span>` : ""}</label>`).join("");
  fillForm(store.get(`br.profile.${cat}`, {}));
  $("#profileForm").oninput = () => store.set(`br.profile.${cat}`, readForm());
  $("#profileForm").onsubmit = (e) => { e.preventDefault(); runCheck(); };
}
function fillForm(v) { for (const el of $("#profileForm").elements) if (el.name && v[el.name] !== undefined) el.value = String(v[el.name]); store.set(`br.profile.${cat}`, readForm()); }
function readForm() { const o = {}; for (const el of $("#profileForm").elements) if (el.name) o[el.name] = el.value; return o; }

const ICON = { works: "✓", works_with_caveats: "!", likely_mismatch: "✕", needs_info: "?" };
const SUB = { works: "Every check passed for your situation.", works_with_caveats: "It should work, but read the caveat below.", likely_mismatch: "At least one deal-breaker for your situation.", needs_info: "Answer the missing question to get a verdict." };

function md(text) {
  // Tiny, safe markdown: escape first, then bold, bullets and citation chips.
  const lines = esc(text).split(/\n/);
  let html = "", inList = false;
  for (let l of lines) {
    l = l.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\[((?:R-[A-Z]{2}\d{2}-\d{2}|CHK-[A-Z]+|SPEC:[a-z_]+)(?:\s*[,;]\s*(?:R-[A-Z]{2}\d{2}-\d{2}|CHK-[A-Z]+|SPEC:[a-z_]+))*)\]/g, (m, inner) =>
      inner.split(/\s*[,;]\s*/).map((c) => c.startsWith("R-") ? `<a class="cite" data-rev="${c}">${c}</a>` : `<span class="cite">${c}</span>`).join(""));
    if (/^\s*[-*•]\s+/.test(l)) { if (!inList) { html += "<ul>"; inList = true; } html += `<li>${l.replace(/^\s*[-*•]\s+/, "")}</li>`; }
    else { if (inList) { html += "</ul>"; inList = false; } if (l.trim()) html += `<p>${l}</p>`; }
  }
  return html + (inList ? "</ul>" : "");
}
function revHtml(r) { return `<div class="rev" id="rev-${r.id}"><div class="rh"><span class="stars">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</span><span>${r.id}</span><span>${r.date || ""}</span><span>synthetic review</span></div>${esc(r.text)}</div>`; }

async function runCheck() {
  const btn = $("#checkBtn"); btn.disabled = true; btn.innerHTML = `<span class="spin"></span>Checking listing and reviews…`;
  try {
    const r = await api("/api/check", { product_id: current.id, profile: readForm() });
    if (r.state === "error") { $("#result").innerHTML = `<div class="qa error">${esc(r.error || "Something went wrong.")}</div>`; return; }
    const ex = r.explanation || {};
    const src = ex.source === "model"
      ? `Written by ${esc(ex.model)}${ex.fallback_used ? " (fallback)" : ""} · <span class="ok">fact-checked: every number and citation matches the listing or a review</span>`
      : `Rule-based summary. ${esc(ex.note || "")}`;
    $("#result").innerHTML = `
      <div class="verdict v-${r.verdict}"><span class="ic">${ICON[r.verdict]}</span><div>${esc(r.verdict_label)}<small>${SUB[r.verdict]}</small></div></div>
      <ul class="checks">${r.checks.map((c) => `<li><span class="st st-${c.status}">${c.status === "missing" ? "need info" : c.status}</span><div><b>${esc(c.label)}</b><span class="d">${esc(c.detail)}</span> ${c.cite.map((x) => `<span class="cite">${esc(x)}</span>`).join("")} <span class="cite">${c.id}</span></div></li>`).join("")}</ul>
      <div class="explain">${md(ex.text || "")}<div class="src">${src}</div></div>
      ${r.alternatives && r.alternatives.length ? `<div class="alts"><h3>${r.alternatives[0].verdict === "works" ? "These pass all checks for you" : "Closest options for you"} (same category, ranked by rating, never sponsored)</h3><ul>${r.alternatives.map((a) => `<li><button type="button" data-id="${a.id}"><b>${esc(a.name)}</b><br><span class="fine">${inr(a.price_inr)} · ★ ${a.rating} · ${esc(a.verdict_label)}</span></button></li>`).join("")}</ul></div>` : ""}
      ${r.reviews && r.reviews.length ? `<div class="used"><h3>Reviews we read for your situation</h3>${r.reviews.map(revHtml).join("")}</div>` : ""}`;
    $("#result").querySelectorAll(".alts button").forEach((b) => (b.onclick = () => { openProduct(b.dataset.id); window.scrollTo({ top: 0, behavior: "smooth" }); }));
    wireCites($("#result"));
  } catch (e) { $("#result").innerHTML = `<div class="qa error">Could not reach the server. No verdict was guessed.</div>`; }
  finally { btn.disabled = false; btn.textContent = "Check it for me"; }
}
function wireCites(root) {
  root.querySelectorAll("a.cite[data-rev]").forEach((a) => (a.onclick = () => {
    const el = document.getElementById(`rev-${a.dataset.rev}`); if (!el) return;
    el.closest("details")?.setAttribute("open", ""); el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1600);
  }));
}

async function runAsk() {
  const q = $("#askInput").value.trim(); if (!q) return;
  const btn = $("#askBtn"); btn.disabled = true;
  const box = document.createElement("div"); box.className = "qa"; box.innerHTML = `<div class="q">${esc(q)}</div><span class="spin"></span>Reading the listing and reviews…`;
  $("#askOut").prepend(box);
  try {
    const r = await api("/api/ask", { product_id: current.id, profile: readForm(), question: q });
    box.className = `qa ${r.state}`;
    const tagline = r.state === "declined" ? "Declined by the scope gate (no AI call)" : r.state === "not_in_data" ? `The listing and reviews don't say · ${esc(r.model || "")}` : r.state === "answer" ? `${esc(r.model)}${r.fallback_used ? " (fallback)" : ""} · <span class="ok">fact-checked</span>` : esc(r.model || "");
    box.innerHTML = `<div class="q">${esc(q)}</div>${md(r.answer || "")}<div class="src">${tagline}</div>`;
    wireCites(box);
  } catch { box.className = "qa error"; box.innerHTML = `<div class="q">${esc(q)}</div>Could not reach the server.`; }
  finally { btn.disabled = false; $("#askInput").value = ""; }
}
$("#checkBtn").onclick = runCheck;
$("#askBtn").onclick = runAsk;
$("#askInput").addEventListener("keydown", (e) => { if (e.key === "Enter") runAsk(); });
init();
