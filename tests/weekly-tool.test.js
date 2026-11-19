// Checks the tool the weekly run uses to add a playpack (scripts/add-weekly.js), on a throwaway
// copy of the project: it must put every piece in place, refuse anything unsuitable or half-finished,
// and never move a playpack whose week is settled.
// Run: node tests/weekly-tool.test.js
const fs = require("fs"), path = require("path"), os = require("os"), { spawnSync } = require("child_process");
const root = path.join(__dirname, ".."), work = fs.mkdtempSync(path.join(os.tmpdir(), "hymeta-weekly-"));
const problems = [], bad = (m) => problems.push(m);
fs.cpSync(root, work, { recursive: true, filter: (src) => !/(^|[\\/])(\.git|node_modules)([\\/]|$)/.test(path.relative(root, src)) });
fs.symlinkSync(path.join(root, "node_modules"), path.join(work, "node_modules"));
const at = (p) => path.join(work, p), read = (p) => fs.readFileSync(at(p), "utf8");
const tool = (...args) => { const r = spawnSync(process.execPath, [at("scripts/add-weekly.js"), ...args], { cwd: work, encoding: "utf8", env: { ...process.env, HYMETA_WEEK: "0" } }); return { ok: r.status === 0, out: r.stdout + r.stderr }; };
const catalog = () => { delete require.cache[require.resolve(at("lib/catalog.js"))]; return require(at("lib/catalog.js")); };
const FILES = ["src/app.html", "lib/recipes.js", "scripts/make-art.py", "lib/ledger.json"], snap = () => FILES.map(read).join("\u0000");

// it is week 0 and next Monday is already settled: one new playpack a week, no more
const base = JSON.parse(read("docs/weekly-example.json"));
const spec = (change) => { const s = JSON.parse(JSON.stringify(base)); s.id = "test-pack"; s.name = "The test pack"; s.art = "testart"; s.poll.ideas.forEach((i, n) => { i.id = "test-idea-" + n; }); if (change) change(s); fs.writeFileSync(at("spec.json"), JSON.stringify(s)); return "spec.json"; };
const settled = snap();
if (!/is settled: /.test(tool("--status").out)) bad("the tool does not report that next Monday is settled");
if (tool(spec()).ok || snap() !== settled) bad("a second playpack was added for a Monday that is already settled");

// pretend this week's run has not happened yet: week 0 settled, next Monday open
fs.writeFileSync(at("lib/ledger.json"), JSON.stringify([catalog().rota[0]]));
const before = snap(), order = catalog().rota.slice();
if (!/NOT settled/.test(tool("--status").out)) bad("the tool does not report that next Monday is open");
const refusals = [
  ["a word unsuitable for children", (s) => { s.warning = "This one is damn hard."; }], ["a long dash", (s) => { s.blurb = "Waterfalls — and waves."; }],
  ["a hint that gives the name away", (s) => { s.hint = "It is The test pack."; }], ["no place for a new mod", (s) => { s.recipe.jobs.forEach((j) => { delete j.fresh; }); }],
  ["only two ideas to vote on", (s) => { s.poll.ideas.pop(); }], ["a vote idea that already exists as a playpack", (s) => { s.poll.ideas[0].id = "cozy-farmer"; }],
  ["a name already taken", (s) => { s.id = "cozy-farmer"; }], ["a weekly name already taken", (s) => { s.id = order[3]; }], ["far too many mods", (s) => { s.recipe.jobs.forEach((j) => { j.n = 2; }); }],
  ["an unknown icon", (s) => { s.icon = "rocket"; }], ["an unknown playstyle", (s) => { s.family = "horror"; }], ["a name too long to fit", (s) => { s.name = "The very long name that will not fit on a card"; }],
  ["a missing line for Hex", (s) => { delete s.pitch.unhinged; }], ["a picture with writing in it", (s) => { s.artPrompt += " A sign with the words welcome on it."; }], ["a picture name already used", (s) => { s.art = "farm"; }],
  ["skin packs not ruled out", (s) => { s.recipe.avoid = ["dungeon"]; }], ["a job with nothing to search for", (s) => { s.recipe.jobs[0].q = []; }],
];
for (const [label, change] of refusals) { const r = tool(spec(change)); if (r.ok || snap() !== before) bad("accepted a playpack with " + label + (snap() !== before ? " (and changed files)" : "")); if (snap() !== before) FILES.forEach((f, i) => fs.writeFileSync(at(f), before.split("\u0000")[i])); }

// a good one goes in for next Monday, ahead of the reserve, with everything in place
const added = tool(spec());
if (!added.ok) bad("a good playpack was refused: " + added.out.slice(0, 300));
const c = catalog();
if (c.rota.join() !== [order[0], "test-pack", ...order.slice(1)].join()) bad("the new playpack is not next Monday's, or the reserve changed order: " + c.rota.slice(0, 4).join(", "));
if (JSON.parse(read("lib/ledger.json")).join() !== order[0] + ",test-pack") bad("the new playpack was not recorded as settled");
if (!c.packs["test-pack"] || c.packs["test-pack"].name !== "The test pack" || c.packs["test-pack"].art !== "pack-testart" || c.packs["test-pack"].hint !== base.hint) bad("the app's list does not have the new playpack's words and picture");
if (!c.poll || c.poll.id !== "w2" || c.poll.week !== 2 || c.poll.ideas.map((i) => i.id).join() !== "test-idea-0,test-idea-1,test-idea-2") bad("the next vote was not put in place: " + JSON.stringify(c.poll));
delete require.cache[require.resolve(at("lib/recipes.js"))];
for (const k of Object.keys(require.cache)) if (k.startsWith(work)) delete require.cache[k];
const rec = require(at("lib/recipes.js")).PACKS["test-pack"];
if (!rec || rec.jobs.length !== base.recipe.jobs.length || !rec.jobs.some((j) => j.fresh) || rec.jobs[0].kw.join() !== base.recipe.jobs[0].kw.join()) bad("the recipe did not arrive whole");
if (!read("scripts/make-art.py").includes('"testart":' + JSON.stringify(base.artPrompt))) bad("the picture was not added to the picture list");
if (spawnSync("python3", ["-c", "import ast,sys;ast.parse(open(sys.argv[1]).read())", at("scripts/make-art.py")]).status !== 0) bad("the picture list no longer runs");
if (tool(spec((s) => { s.id = "test-pack-two"; s.art = "testtwo"; })).ok) bad("two playpacks were added for the same Monday");

// taking one back: only before its week begins, and it leaves no trace
if (tool("--remove", order[0]).ok) bad("a playpack whose week has begun was taken back");
if (tool("--remove", "cozy-farmer").ok) bad("a standing playpack was taken back as if it were a weekly one");
const removed = tool("--remove", "test-pack");
const strip = (s) => s.replace(/^var POLL = .*;$/m, "");
if (!removed.ok) bad("a playpack whose week has not begun could not be taken back: " + removed.out.slice(0, 200));
if (strip(read("src/app.html")) !== strip(before.split("\u0000")[0]) || read("lib/recipes.js") !== before.split("\u0000")[1] || read("scripts/make-art.py") !== before.split("\u0000")[2]) bad("taking a playpack back left pieces of it behind");
if (catalog().rota.join() !== order.join() || JSON.parse(read("lib/ledger.json")).join() !== order[0]) bad("taking a playpack back did not restore the order and the record");

// a playpack moved by hand is noticed
fs.writeFileSync(at("lib/ledger.json"), JSON.stringify([order[1], order[0]]));
if (tool("--status").ok) bad("a settled playpack moved by hand went unnoticed");
fs.rmSync(work, { recursive: true, force: true });
console.log(problems.length ? problems.join("\n") : "WEEKLY TOOL OK");
process.exit(problems.length ? 1 : 0);
