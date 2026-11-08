// Re-applies the current QA scorer to a saved live run (no API calls). Usage: node evals/rescore.js evals/results/live_dev_YYYY-MM-DD.json
const fs = require("fs");
const QA = require("./qa.json");
const NOT_SAID = /(not (listed|mentioned|say|stated|specified|available|in the)|doesn'?t (say|mention|list|specify)|does not (say|mention|list|specify)|no (information|details|mention)|isn'?t (listed|mentioned))/i;
const file = process.argv[2], rep = JSON.parse(fs.readFileSync(file, "utf8"));
for (const [set, v] of Object.entries(rep.sets)) {
  const items = Object.fromEntries(QA[set].map((x) => [x.id, x]));
  for (const r of v.qa) {
    const it = items[r.id], a = (r.answer || "").toLowerCase().replace(/[‘’]/g, "'");
    if (it.type === "answer") { const missing = it.must.filter((g) => !g.some((t) => a.includes(t.toLowerCase()))); r.pass = r.state === "answer" && r.grounded && !missing.length; r.missing = missing; }
    if (it.type === "not_in_data") r.pass = r.grounded && (r.state === "not_in_data" || NOT_SAID.test(a));
  }
  const ans = v.qa.filter((x) => x.type === "answer"), nid = v.qa.filter((x) => x.type === "not_in_data");
  v.summary.qa_answer_accuracy = `${ans.filter((x) => x.pass).length}/${ans.length} (${Math.round((100 * ans.filter((x) => x.pass).length) / ans.length)}%)`;
  v.summary.qa_not_in_data_honest = `${nid.filter((x) => x.pass).length}/${nid.length} (${Math.round((100 * nid.filter((x) => x.pass).length) / nid.length)}%)`;
  v.summary.rescored_note = "Re-scored after fixing a scorer bug (curly apostrophes were not matched). Model answers unchanged.";
  console.log(set, v.summary.qa_answer_accuracy, v.qa.filter((x) => !x.pass).map((x) => x.id));
}
fs.writeFileSync(file, JSON.stringify(rep, null, 1));
