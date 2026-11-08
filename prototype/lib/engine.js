// BuyRight fit engine. Every verdict and every number in a verdict comes from this file, never from the model.
// Rules are deliberately simple and written down, so a shopper (and a reviewer) can see why a check passed or failed.
const REF = require("../data/reference.json");

const round = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
const isNum = (v) => v !== null && v !== undefined && v !== "" && isFinite(Number(v));
const num = (v) => (isNum(v) ? Number(v) : null);

// Status meaning: pass = fine, warn = works with a caveat, fail = deal-breaker, info = worth knowing, missing = we need an input.
function chk(id, label, status, detail, cite) { return { id, label, status, detail, cite: cite || [] }; }

// ---------------- Air conditioners ----------------
function requiredTons(p, city) {
  const room = num(p.room_sqft), ceil = num(p.ceiling_ft) || 10, occ = num(p.occupants) || 2;
  let t = (room * (ceil / 10)) / REF.ac_rules.sqft_per_ton;
  const factors = [];
  if (p.top_floor_or_west_sun === true || p.top_floor_or_west_sun === "yes") { t *= 1 + REF.ac_rules.sun_load; factors.push(`+${REF.ac_rules.sun_load * 100}% for top floor or west sun`); }
  if (city && city.climate === "hot") { t *= 1 + REF.ac_rules.hot_city_load; factors.push(`+${REF.ac_rules.hot_city_load * 100}% for a very hot city`); }
  if (occ > 2) { t *= 1 + REF.ac_rules.per_extra_person * (occ - 2); factors.push(`+${REF.ac_rules.per_extra_person * 100}% for each person over 2`); }
  return { tons: round(t, 2), factors, ceil, occ };
}

function checkAC(prod, p) {
  const s = prod.specs, out = [];
  const city = REF.cities.find((c) => c.name.toLowerCase() === String(p.city || "").toLowerCase());
  // 1. Cooling capacity vs room
  if (!isNum(p.room_sqft)) out.push(chk("CHK-COOL", "Cooling capacity for your room", "missing", "Tell us your room size in square feet.", ["SPEC:capacity_tons"]));
  else {
    const req = requiredTons(p, city), ratio = round(s.capacity_tons / req.tons, 2);
    const base = `Your ${num(p.room_sqft)} sq ft room needs about ${req.tons} ton${req.factors.length ? ` (${req.factors.join(", ")})` : ""}. This AC is ${s.capacity_tons} ton.`;
    if (ratio < REF.ac_rules.fail_below) out.push(chk("CHK-COOL", "Cooling capacity for your room", "fail", `${base} It is too small and will struggle on hot afternoons.`, ["SPEC:capacity_tons"]));
    else if (ratio < 1) out.push(chk("CHK-COOL", "Cooling capacity for your room", "warn", `${base} It is slightly under-sized, so it may run non-stop at peak heat.`, ["SPEC:capacity_tons"]));
    else if (ratio > REF.ac_rules.oversize_above) out.push(chk("CHK-COOL", "Cooling capacity for your room", "warn", `${base} It is much bigger than needed, so it will cool fast but may leave the room clammy and cost more to buy.`, ["SPEC:capacity_tons"]));
    else out.push(chk("CHK-COOL", "Cooling capacity for your room", "pass", `${base} That is enough.`, ["SPEC:capacity_tons"]));
  }
  // 2. Peak outdoor temperature
  if (!city) out.push(chk("CHK-HEAT", "Works in your city's peak heat", "missing", "Pick your city so we can check its peak summer temperature.", ["SPEC:max_ambient_c"]));
  else if (city.peak_c > s.max_ambient_c) out.push(chk("CHK-HEAT", "Works in your city's peak heat", "fail", `${city.name} reaches about ${city.peak_c}°C. This AC is rated to cool only up to ${s.max_ambient_c}°C outside.`, ["SPEC:max_ambient_c"]));
  else if (city.peak_c > s.max_ambient_c - 2) out.push(chk("CHK-HEAT", "Works in your city's peak heat", "warn", `${city.name} reaches about ${city.peak_c}°C, close to this AC's ${s.max_ambient_c}°C limit. Cooling will drop on the hottest days.`, ["SPEC:max_ambient_c"]));
  else out.push(chk("CHK-HEAT", "Works in your city's peak heat", "pass", `${city.name} reaches about ${city.peak_c}°C. This AC is rated up to ${s.max_ambient_c}°C outside.`, ["SPEC:max_ambient_c"]));
  // 3. Voltage
  const [lo, hi] = s.voltage_range_v;
  if (p.voltage === "fluctuating") {
    if (lo <= REF.ac_rules.stabilizer_free_below_v) out.push(chk("CHK-VOLT", "Handles your power supply", "pass", `It runs from ${lo} V to ${hi} V, so it copes with voltage drops without a stabilizer.`, ["SPEC:voltage_range_v"]));
    else out.push(chk("CHK-VOLT", "Handles your power supply", "warn", `It needs ${lo} V to ${hi} V. With frequent voltage drops you will need a separate stabilizer.`, ["SPEC:voltage_range_v"]));
  } else if (p.voltage === "stable") out.push(chk("CHK-VOLT", "Handles your power supply", "pass", `Your supply is stable and it runs from ${lo} V to ${hi} V.`, ["SPEC:voltage_range_v"]));
  else out.push(chk("CHK-VOLT", "Handles your power supply", "info", `It runs from ${lo} V to ${hi} V. If your voltage often drops, tell us and we will check if you need a stabilizer.`, ["SPEC:voltage_range_v"]));
  // 4. Install
  if (s.type === "window") {
    if (!isNum(p.window_w_cm) || !isNum(p.window_h_cm)) out.push(chk("CHK-FIT", "Fits your window", "missing", `This is a window AC. It needs a window opening of at least ${s.window_opening_cm.w} x ${s.window_opening_cm.h} cm. Tell us your window size.`, ["SPEC:window_opening_cm"]));
    else if (num(p.window_w_cm) >= s.window_opening_cm.w && num(p.window_h_cm) >= s.window_opening_cm.h) out.push(chk("CHK-FIT", "Fits your window", "pass", `Your ${num(p.window_w_cm)} x ${num(p.window_h_cm)} cm window is big enough for the ${s.window_opening_cm.w} x ${s.window_opening_cm.h} cm unit.`, ["SPEC:window_opening_cm"]));
    else out.push(chk("CHK-FIT", "Fits your window", "fail", `Your ${num(p.window_w_cm)} x ${num(p.window_h_cm)} cm window is smaller than the ${s.window_opening_cm.w} x ${s.window_opening_cm.h} cm opening this unit needs.`, ["SPEC:window_opening_cm"]));
  } else {
    if (p.outdoor_space === "no") out.push(chk("CHK-FIT", "Space for the outdoor unit", "fail", "This is a split AC. Its outdoor unit needs a wall bracket or balcony spot, and you said you have none.", ["SPEC:type"]));
    else if (p.outdoor_space === "yes") out.push(chk("CHK-FIT", "Space for the outdoor unit", "pass", "This is a split AC and you have a spot for the outdoor unit.", ["SPEC:type"]));
    else out.push(chk("CHK-FIT", "Space for the outdoor unit", "info", "This is a split AC. You need a wall or balcony spot for the outdoor unit.", ["SPEC:type"]));
  }
  return out;
}

// ---------------- Chargers and power banks ----------------
const PROTOS = ["pd", "pps", "qc"];
function effectiveWatts(prod, phone) {
  let best = { w: REF.charger_rules.basic_watts, proto: "basic 5V", port: null };
  for (const port of prod.specs.ports) {
    if (phone.port === "lightning" && port.type !== "C") continue; // Apple Lightning fast charge needs USB-C PD
    for (const pr of PROTOS) {
      if (port[pr] && phone.charging[pr]) { const w = Math.min(port[pr], phone.charging[pr]); if (w > best.w) best = { w, proto: pr.toUpperCase(), port: port.type }; }
    }
  }
  return best;
}
function checkCharger(prod, p) {
  const s = prod.specs, out = [];
  const phone = REF.phones.find((x) => x.id === p.phone_id);
  if (!phone) { out.push(chk("CHK-FAST", "Charging speed on your phone", "missing", "Pick your phone model.", ["SPEC:ports"])); }
  else {
    const eff = effectiveWatts(prod, phone);
    const std = Math.max(...PROTOS.map((k) => phone.charging[k] || 0));
    const goal = p.goal || "fast";
    const base = `On your ${phone.name} it charges at up to about ${eff.w} W (${eff.proto}). Your phone's fastest standard charging is ${std} W.`;
    if (goal === "basic") out.push(chk("CHK-FAST", "Charging speed on your phone", "pass", `${base} That is fine for normal charging.`, ["SPEC:ports"]));
    else if (!eff.port) out.push(chk("CHK-FAST", "Charging speed on your phone", "fail", `${base} Your phone and this charger share no fast-charging standard, so it will charge slowly.`, ["SPEC:ports"]));
    else if (eff.w >= REF.charger_rules.full_speed_share * std) out.push(chk("CHK-FAST", "Charging speed on your phone", "pass", `${base} You get full fast charging.`, ["SPEC:ports"]));
    else if (eff.w >= REF.charger_rules.partial_share * std) out.push(chk("CHK-FAST", "Charging speed on your phone", "warn", `${base} It charges fast, but not at your phone's full speed.`, ["SPEC:ports"]));
    else out.push(chk("CHK-FAST", "Charging speed on your phone", "fail", `${base} It charges at well under half your phone's fast-charging speed.`, ["SPEC:ports"]));
    if (phone.charging.proprietary && phone.charging.proprietary.w > eff.w) out.push(chk("CHK-PROP", "Your phone's own turbo charging", "info", `Your phone's ${phone.charging.proprietary.name} (${phone.charging.proprietary.w} W) only works with the phone maker's own charger. No third-party charger reaches it.`, []));
    // Cable
    const cable = s.cable_included; // e.g. "C-C", "A-C", null
    if (phone.port === "lightning") {
      const hasC = s.ports.some((x) => x.type === "C");
      if (!hasC) out.push(chk("CHK-CABLE", "Cable for your phone", "fail", "Your phone has a Lightning port. Fast charging it needs a USB-C port, and this charger has none.", ["SPEC:ports"]));
      else out.push(chk("CHK-CABLE", "Cable for your phone", "warn", `Your phone has a Lightning port. You need a USB-C to Lightning cable, which is not in the box${cable ? ` (the box has a ${cable} cable)` : ""}.`, ["SPEC:cable_included"]));
    } else if (cable) out.push(chk("CHK-CABLE", "Cable for your phone", "pass", `A ${cable} cable is in the box and fits your phone's USB-C port.`, ["SPEC:cable_included"]));
    else out.push(chk("CHK-CABLE", "Cable for your phone", "info", "No cable in the box. Your phone's USB-C cable will work.", ["SPEC:cable_included"]));
    if (s.capacity_mah) {
      const charges = round((s.capacity_mah * REF.charger_rules.powerbank_efficiency) / phone.battery_mah, 1);
      out.push(chk("CHK-CAP", "Full charges per power bank charge", charges >= 1.5 ? "pass" : "info", `About ${charges} full charges of your ${phone.battery_mah} mAh battery (${Math.round(REF.charger_rules.powerbank_efficiency * 100)}% of the ${s.capacity_mah} mAh rating is usable).`, ["SPEC:capacity_mah"]));
    }
  }
  if (isNum(p.laptop_w) && num(p.laptop_w) > 0) {
    const maxPd = Math.max(0, ...s.ports.filter((x) => x.type === "C").map((x) => x.pd || 0)), need = num(p.laptop_w);
    if (maxPd >= need) out.push(chk("CHK-LAPTOP", "Charges your laptop", "pass", `Your laptop needs ${need} W over USB-C and this gives up to ${maxPd} W.`, ["SPEC:ports"]));
    else if (maxPd >= REF.charger_rules.laptop_slow_share * need) out.push(chk("CHK-LAPTOP", "Charges your laptop", "warn", `Your laptop needs ${need} W but this gives ${maxPd} W. It will charge slowly and may drain while you work.`, ["SPEC:ports"]));
    else out.push(chk("CHK-LAPTOP", "Charges your laptop", "fail", maxPd ? `Your laptop needs ${need} W but this gives only ${maxPd} W over USB-C.` : `Your laptop needs ${need} W over USB-C and this has no USB-C power output for laptops.`, ["SPEC:ports"]));
  }
  return out;
}

// ---------------- Shoe racks and cabinets ----------------
const shoeLengthCm = (uk) => round(((Number(uk) + 25) / 3) * 2.54 + REF.rack_rules.shoe_outsole_extra_cm, 1);
function checkRack(prod, p) {
  const s = prod.specs, out = [], d = s.dimensions_cm;
  const dims = [["width", "space_w_cm", d.w], ["depth", "space_d_cm", d.d], ["height", "space_h_cm", d.h]];
  if (dims.some(([, k]) => !isNum(p[k]))) out.push(chk("CHK-FIT", "Fits your space", "missing", `It measures ${d.w} x ${d.d} x ${d.h} cm (W x D x H). Tell us the width, depth and height of your space.`, ["SPEC:dimensions_cm"]));
  else {
    const over = dims.filter(([, k, v]) => v > num(p[k])).map(([n, k, v]) => `${n} ${v} cm vs your ${num(p[k])} cm`);
    const tight = dims.filter(([, k, v]) => v <= num(p[k]) && num(p[k]) - v < REF.rack_rules.tight_margin_cm).map(([n]) => n);
    if (over.length) out.push(chk("CHK-FIT", "Fits your space", "fail", `Too big: ${over.join("; ")}.`, ["SPEC:dimensions_cm"]));
    else if (tight.length) out.push(chk("CHK-FIT", "Fits your space", "warn", `It fits, but with under ${REF.rack_rules.tight_margin_cm} cm to spare in ${tight.join(" and ")}. Measure again, including skirting boards.`, ["SPEC:dimensions_cm"]));
    else out.push(chk("CHK-FIT", "Fits your space", "pass", `It measures ${d.w} x ${d.d} x ${d.h} cm and fits your ${num(p.space_w_cm)} x ${num(p.space_d_cm)} x ${num(p.space_h_cm)} cm space.`, ["SPEC:dimensions_cm"]));
  }
  if (!isNum(p.pairs)) out.push(chk("CHK-PAIRS", "Holds all your shoes", "missing", `It holds about ${s.capacity_pairs} pairs. Tell us how many pairs you need to store.`, ["SPEC:capacity_pairs"]));
  else if (num(p.pairs) <= s.capacity_pairs) out.push(chk("CHK-PAIRS", "Holds all your shoes", "pass", `It holds about ${s.capacity_pairs} pairs and you have ${num(p.pairs)}.`, ["SPEC:capacity_pairs"]));
  else if (num(p.pairs) <= s.capacity_pairs * REF.rack_rules.pairs_warn_share) out.push(chk("CHK-PAIRS", "Holds all your shoes", "warn", `It holds about ${s.capacity_pairs} pairs and you have ${num(p.pairs)}, so it will be crowded.`, ["SPEC:capacity_pairs"]));
  else out.push(chk("CHK-PAIRS", "Holds all your shoes", "fail", `It holds about ${s.capacity_pairs} pairs and you have ${num(p.pairs)}.`, ["SPEC:capacity_pairs"]));
  if (isNum(p.shoe_uk)) {
    const len = shoeLengthCm(p.shoe_uk);
    if (len <= s.shelf_depth_cm) out.push(chk("CHK-SIZE", "Your biggest shoes fit the shelf", "pass", `A UK ${num(p.shoe_uk)} shoe is about ${len} cm long and the shelf is ${s.shelf_depth_cm} cm deep.`, ["SPEC:shelf_depth_cm"]));
    else if (!s.closed && len <= s.shelf_depth_cm + REF.rack_rules.open_overhang_cm) out.push(chk("CHK-SIZE", "Your biggest shoes fit the shelf", "warn", `A UK ${num(p.shoe_uk)} shoe is about ${len} cm long and the shelf is ${s.shelf_depth_cm} cm deep, so heels will stick out a little.`, ["SPEC:shelf_depth_cm"]));
    else out.push(chk("CHK-SIZE", "Your biggest shoes fit the shelf", "fail", `A UK ${num(p.shoe_uk)} shoe is about ${len} cm long but the shelf is only ${s.shelf_depth_cm} cm deep${s.closed ? " and the door will not close" : ""}.`, ["SPEC:shelf_depth_cm"]));
  } else out.push(chk("CHK-SIZE", "Your biggest shoes fit the shelf", s.closed ? "missing" : "info", `Shelves are ${s.shelf_depth_cm} cm deep.${s.closed ? " This cabinet has doors, so tell us your largest UK shoe size." : ""}`, ["SPEC:shelf_depth_cm"]));
  if (s.mounting === "wall") {
    if (p.can_drill === "no") out.push(chk("CHK-DRILL", "Installation", "fail", "It must be screwed to the wall, and you said you cannot drill.", ["SPEC:mounting"]));
    else out.push(chk("CHK-DRILL", "Installation", p.can_drill === "yes" ? "pass" : "info", "It must be screwed to the wall (drilling needed).", ["SPEC:mounting"]));
  } else if (s.mounting === "anchor") {
    if (p.can_drill === "no") out.push(chk("CHK-DRILL", "Installation", "warn", "It stands on the floor but the maker says to anchor it to the wall so it cannot tip. You said you cannot drill.", ["SPEC:mounting"]));
    else out.push(chk("CHK-DRILL", "Installation", "info", "It stands on the floor with a wall anchor against tipping (one drill hole).", ["SPEC:mounting"]));
  }
  if (s.front_clearance_cm) {
    if (!isNum(p.front_clearance_cm)) out.push(chk("CHK-DOOR", "Room to open the doors", "missing", `Its doors need ${s.front_clearance_cm} cm of free space in front. Tell us how much room is in front of the spot.`, ["SPEC:front_clearance_cm"]));
    else if (num(p.front_clearance_cm) >= s.front_clearance_cm) out.push(chk("CHK-DOOR", "Room to open the doors", "pass", `The doors need ${s.front_clearance_cm} cm and you have ${num(p.front_clearance_cm)} cm.`, ["SPEC:front_clearance_cm"]));
    else out.push(chk("CHK-DOOR", "Room to open the doors", "fail", `The doors need ${s.front_clearance_cm} cm in front but you have ${num(p.front_clearance_cm)} cm.`, ["SPEC:front_clearance_cm"]));
  }
  return out;
}

const CHECKERS = { ac: checkAC, charger: checkCharger, rack: checkRack };
const VERDICTS = {
  likely_mismatch: "Likely won't work for you",
  needs_info: "Need a bit more info",
  works_with_caveats: "Works, with a caveat",
  works: "Works for you",
};
function verdictOf(checks) {
  const st = new Set(checks.map((c) => c.status));
  if (st.has("fail")) return "likely_mismatch";
  if (st.has("missing")) return "needs_info";
  if (st.has("warn")) return "works_with_caveats";
  return "works";
}

function evaluate(prod, profile = {}) {
  const fn = CHECKERS[prod.category];
  if (!fn) throw new Error(`unknown category ${prod.category}`);
  const checks = fn(prod, profile || {});
  const verdict = verdictOf(checks);
  return { product_id: prod.id, verdict, verdict_label: VERDICTS[verdict], checks };
}

// Same-category products that pass for this shopper, best rated first. Never sponsored, never outside the catalogue.
function alternatives(products, prod, profile, n = 3) {
  const rows = products.filter((x) => x.category === prod.category && x.id !== prod.id).map((x) => ({ x, r: evaluate(x, profile) }));
  let ok = rows.filter((o) => o.r.verdict === "works");
  if (!ok.length) ok = rows.filter((o) => o.r.verdict === "works_with_caveats");
  return ok.sort((a, b) => b.x.rating - a.x.rating || a.x.price_inr - b.x.price_inr).slice(0, n)
    .map((o) => ({ id: o.x.id, name: o.x.name, price_inr: o.x.price_inr, rating: o.x.rating, verdict: o.r.verdict, verdict_label: o.r.verdict_label }));
}

module.exports = { evaluate, alternatives, requiredTons, effectiveWatts, shoeLengthCm, VERDICTS, REF };
