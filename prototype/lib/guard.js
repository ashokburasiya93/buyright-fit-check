// Guardrails: a scope gate before any model call, and an output check after every model call.

const INJECT = /(ignore|disregard|forget)\s+(all\s+|any\s+|the\s+|your\s+)?(previous|prior|above|earlier)?\s*(instructions|rules|prompt)|system prompt|reveal (your|the) (prompt|instructions|rules)|you are now|act as (a|an)\b|developer mode|jailbreak|pretend (you|to be)/i;
const UNSAFE = /\b(bypass|remove|skip|cut|disconnect|without)\b.{0,30}\b(earthing|grounding|earth wire|fuse|mcb|breaker|rccb)\b|\b(earthing|earth wire|fuse|mcb)\b.{0,25}\b(bypass|remove|skip|not needed|unnecessary)\b|\b(open|modify|tamper|rewire|repair)\b.{0,25}\b(charger|battery|power bank|compressor|gas)\b|\b(refill|top.?up|recharge)\b.{0,15}\bgas\b.{0,20}\b(myself|my own|diy)\b|\bextension (cord|board|box)\b.{0,40}\b(ac|air conditioner)\b|\b(ac|air conditioner)\b.{0,40}\bextension (cord|board|box)\b|\bplug\b.{0,30}\b(ac|air conditioner)\b.{0,30}\b(5 ?a|6 ?a|normal|regular|small)\s+(socket|plug|point)/i;
const ACTION = /\b(place|cancel|track)\s+(the\s+|my\s+|an?\s+)?order\b|\b(buy|order|add)\s+(it|this|one)?\s*(for me|to (my )?cart)\b|\b(apply|use)\s+(a\s+)?(coupon|promo|voucher)\b|\b(return|refund|replace)\s+(it|this|my)\b|\brefund\b|\breturn (window|policy)\b|\bcash on delivery\b|\bcod\b/i;
const OUT = /\b(will (the )?price (drop|go down|fall)|price (prediction|history|drop)|best time to buy|(is|was) (this|the) (discount|deal|sale) (real|fake|genuine)|stock (market|price|tip)|share price|crypto|weather (today|tomorrow)|cricket|movie|recipe|poem|joke|write (code|an essay|a poem)|python|javascript|capital of|who won|horoscope|medical|diabetes|blood pressure|pregnan|lawyer|legal advice|politic|election)\b/i;
const PRIVACY = /\b(phone number|address|email|contact|who is|real name)\b.{0,30}\b(reviewer|review(er)? R-|author|seller)\b|\b(reviewer|author)\b.{0,30}\b(phone|address|email|contact|live)\b/i;

const DECLINE = {
  injection: "I can't change how I work or reveal my instructions. I check whether this product fits your situation, using the listing and owner reviews only.",
  unsafe: "I can't advise on wiring, earthing, fuses or opening up electrical products. Please use a licensed electrician or the brand's installer and follow the manual. I can still tell you what the listing says about voltage and power.",
  action: "I can't place, cancel or return orders, apply coupons or handle payments and refunds. BuyRight only checks, before you buy, whether a product suits your room, device or space.",
  out_of_scope: "That's outside what BuyRight does. I answer one question: will this product work in your home or with your device? Try asking about room size, compatibility, dimensions or what similar owners said.",
  privacy: "I can't share or look up personal details about reviewers or sellers. I can summarise what reviewers said about the product.",
};

function scopeGate(q) {
  if (INJECT.test(q)) return "injection";
  if (PRIVACY.test(q)) return "privacy";
  if (UNSAFE.test(q)) return "unsafe";
  if (ACTION.test(q)) return "action";
  if (OUT.test(q)) return "out_of_scope";
  return null;
}

// Phrases that must never appear in shopper-facing text, whatever the verdict.
const PRESSURE = /\b(guarantee[ds]?|100\s?% (sure|certain|safe|guaranteed)|definitely (will )?work|buy (it )?now|hurry|limited (stock|time)|before (stock|it) runs out|don'?t miss|act fast|best (product|ac|charger|cabinet) ever)\b/i;
const ACTION_CLAIM = /\bI (have|'ve)\s+(ordered|placed|added|bought|purchased|returned|cancelled|applied)\b/i;
// Phrases that say "this will work" — not allowed when the code verdict is a mismatch or needs more info.
const POSITIVE = /\b(perfect (fit|for you|for your|choice)|great (fit|choice) for you|good fit for you|ideal for your|safe to buy|go ahead and buy|you should buy|will work (fine|well|perfectly|great)|works (perfectly|fine) for (you|your)|is suitable for your|it will fit)\b/i;
const NEGATIVE = /\b(won'?t (work|fit|cool)|will not (work|fit|cool)|not (enough|suitable|a good fit)|too (small|big|large)|does not fit|doesn'?t fit|likely mismatch|mismatch)\b/i;

const normText = (s) => String(s || "").replace(/[‐-―−]/g, "-").replace(/[   ]/g, " ").replace(/[【「]/g, "[").replace(/[】」]/g, "]");

function numbersIn(texts) {
  const set = new Set();
  const add = (x) => { const v = Math.abs(Number(String(x).replace(/,/g, ""))); if (!isFinite(v)) return; [v, Math.round(v), Math.round(v * 10) / 10, Math.round(v * 100) / 100].forEach((y) => set.add(String(y))); };
  for (const t of texts) (String(t).match(/\d[\d,]*(?:\.\d+)?/g) || []).forEach(add);
  return set;
}

// facts: the JSON the model was given. reviewIds: review ids the model was allowed to cite. verdict: code verdict.
function checkText(text, { facts, reviewIds = [], specFields = [], checkIds = [], verdict, question = "" }) {
  const t = normText(text);
  const problems = [];
  if (!t.trim()) problems.push("empty answer");
  const allowed = numbersIn([JSON.stringify(facts), question]);
  [0, 1, 2, 3, 4, 5].forEach((n) => allowed.add(String(n)));
  const stripped = t.replace(/\[[^\]]{1,40}\]/g, " ").replace(/^\s*\d+[.)]\s/gm, " ").replace(/\bR-[A-Z]{2}\d{2}-\d{2}\b/g, " ").replace(/\b[A-Z]{2}\d{2}\b/g, " ").replace(/\bCHK-[A-Z]+\b/g, " ").replace(/\bR32\b/g, " ");
  const badNums = [...new Set((stripped.match(/\d[\d,]*(?:\.\d+)?/g) || []).filter((n) => { const v = Math.abs(Number(n.replace(/,/g, ""))); return !allowed.has(String(v)) && !allowed.has(String(Math.round(v * 10) / 10)); }))];
  if (badNums.length) problems.push(`numbers not in the facts: ${badNums.join(", ")}`);
  const cites = [...t.matchAll(/\[([^\]]{1,40})\]/g)].map((m) => m[1].trim());
  const badCites = [];
  for (const c of cites) for (const part of c.split(/[,;]\s*/)) {
    const x = part.trim();
    if (/^R-/.test(x) && !reviewIds.includes(x)) badCites.push(x);
    else if (/^SPEC:/i.test(x) && !specFields.includes(x.slice(5).trim())) badCites.push(x);
    else if (/^CHK-/.test(x) && !checkIds.includes(x)) badCites.push(x);
  }
  if (badCites.length) problems.push(`citations that don't exist: ${[...new Set(badCites)].join(", ")}`);
  if (PRESSURE.test(t)) problems.push(`pressure or guarantee wording: "${t.match(PRESSURE)[0]}"`);
  if (ACTION_CLAIM.test(t)) problems.push("claims to have taken an action");
  if ((verdict === "likely_mismatch" || verdict === "needs_info") && POSITIVE.test(t)) problems.push(`says it will work, but the check verdict is ${verdict}: "${t.match(POSITIVE)[0]}"`);
  if (verdict === "works" && NEGATIVE.test(t) && !/\b(reviewer|owner|review|R-)\b/i.test(t)) problems.push(`says it won't work, but the check verdict is works: "${t.match(NEGATIVE)[0]}"`);
  return { passed: problems.length === 0, problems, citations: cites.length };
}

module.exports = { scopeGate, checkText, DECLINE, normText, PRESSURE, POSITIVE };
