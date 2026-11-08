// Loads lib/ and data/. Uses the bundled copies when present (git deploys and local dev);
// otherwise downloads them once per cold start from the public repo at SOURCE_REF (inline deploys).
const fs = require("fs"), path = require("path");
const FILES = ["lib/buyright.js", "lib/engine.js", "lib/guard.js", "lib/llm.js", "data/products.json", "data/reviews.json", "data/reference.json"];
let ready;
function load(mod) {
  if (!ready) ready = (async () => {
    const local = path.join(__dirname, "..");
    if (fs.existsSync(path.join(local, "lib", "buyright.js")) && fs.existsSync(path.join(local, "data", "products.json"))) return local;
    const ref = process.env.SOURCE_REF || "main";
    const base = `https://raw.githubusercontent.com/ashokburasiya93/buyright-fit-check/${ref}/prototype/`;
    const root = "/tmp/buyright-app";
    await Promise.all(FILES.map(async (f) => {
      const r = await fetch(base + f); if (!r.ok) throw new Error(`load ${f}: ${r.status}`);
      const p = path.join(root, f); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, await r.text());
    }));
    return root;
  })().catch((e) => { ready = null; throw e; });
  return ready.then((root) => require(path.join(root, "lib", mod)));
}
module.exports = { load };
