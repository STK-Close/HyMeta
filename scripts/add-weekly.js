// Adds one weekly playpack to HyMeta, for the week that starts next Monday.
// The weekly run (docs/weekly-run.md) writes a small description file and hands it to this tool,
// which checks it and puts every piece in the right place: the app's words, the recipe, the picture
// slot, and the next vote. Playpacks whose week has begun, or is already settled, are never moved.
//
//   node scripts/add-weekly.js spec.json          add the playpack described in spec.json
//   node scripts/add-weekly.js --remove <id>      take back a playpack whose week has not begun
//   node scripts/add-weekly.js --status           say what is settled and what is next
//
// A description file looks like docs/weekly-example.json.
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const root = path.join(__dirname, ".."), file = (p) => path.join(root, p);
const APP = file("src/app.html"), REC = file("lib/recipes.js"), ARTPY = file("scripts/make-art.py"), LEDGER = file("lib/ledger.json");
const FAMILIES = ["combat", "building", "survival", "creatures", "magic", "exploration", "everything"];
const ICONS = ["leaf", "sword", "house", "compass", "spider", "bolt", "paw", "gear", "skull", "star", "potion", "fish", "crown", "heart", "chest", "flame"];
const SAMPLE = { core: ["atlas", "sort", "camp", "far"], spice: ["trail"] }; // stand-in mods for the offline preview only
const RUDE = require("../lib/accounts").RUDE;
const WEEK_MS = 7 * 24 * 3600 * 1000, LAUNCH = Date.UTC(2026, 10, 16, 9);
const stop = (m) => { console.error("Not added: " + m); process.exit(1); };

const read = (p) => fs.readFileSync(p, "utf8");
function between(src, start, end) { const a = src.indexOf(start); if (a < 0) stop("could not find " + start); const b = src.indexOf(end, a); return [a, b + end.length]; }
function weeklyNow(app) { const [a, b] = between(app, "var WEEKLY = [", "\n];"); return new Function('var NIGHT = "@NIGHT", HILLS = "@HILLS"; return ' + app.slice(a + "var WEEKLY = ".length, b - 1))(); }
const q = (v) => JSON.stringify(v);
function entry(p) {
  const sky = (v) => (v === "@NIGHT" ? "NIGHT" : v === "@HILLS" ? "HILLS" : q(v));
  return `  { id:${q(p.id)}, family:${q(p.family)}, art:${q(p.art)}, name:${q(p.name)}, kind:"Standard", dare:${p.dare}, icon:${q(p.icon)}, sky:${sky(p.sky)}, moon:${q(p.moon)}, hills:${sky(p.hills)},
    blurb:${q(p.blurb)},
    warning:${q(p.warning)},
    pitch:{ gentle:${q(p.pitch.gentle)},
            cheeky:${q(p.pitch.cheeky)},
            unhinged:${q(p.pitch.unhinged)} },
    hint:${q(p.hint)}, core:${q(p.core)}, spice:${q(p.spice)} }`;
}
function writeWeekly(app, list) { const [a, b] = between(app, "var WEEKLY = [", "\n];"); return app.slice(0, a) + "var WEEKLY = [\n" + list.map(entry).join(",\n") + "\n];" + app.slice(b); }
function recipeText(id, r) {
  const job = (j) => "      { label: " + q(j.label) + ", kw: " + q(j.kw).replace(/","/g, '", "') + ", q: " + q(j.q).replace(/","/g, '", "') + (j.cat ? ", cat: " + q(j.cat) : "") + (j.needCat ? ", needCat: true" : "") + ", n: " + j.n + (j.gem ? ", gem: true" : "") + (j.fresh ? ", fresh: true" : "") + " },";
  return `  ${q(id)}: {\n    theme: ${q(r.theme).replace(/","/g, '", "')},\n    avoid: ${q(r.avoid).replace(/","/g, '", "')},\n    jobs: [\n${r.jobs.map(job).join("\n")}\n    ],\n  },\n`;
}
const thisWeek = () => (/^\d+$/.test(process.env.HYMETA_WEEK || "") ? +process.env.HYMETA_WEEK : Math.max(0, Math.floor((Date.now() - LAUNCH) / WEEK_MS))); // HYMETA_WEEK pins the week, for tests
const monday = (w) => new Date(LAUNCH + w * WEEK_MS).toISOString().slice(0, 10);
const build = () => execFileSync(process.execPath, [file("scripts/build.js")], { stdio: "inherit" });

const args = process.argv.slice(2);
let app = read(APP), ledger = JSON.parse(read(LEDGER));
const list = weeklyNow(app);
if (ledger.join() !== list.slice(0, ledger.length).map((p) => p.id).join()) stop("the settled weeks in lib/ledger.json no longer match the app. Someone moved a playpack by hand.");

if (args[0] === "--status" || !args.length) {
  const w = thisWeek();
  console.log("This is week " + w + " (began Monday " + monday(w) + "). Free now: " + (list[w] ? list[w].name : "the weekly list has run out"));
  console.log("Settled through week " + (ledger.length - 1) + ": " + ledger.join(", "));
  console.log(ledger.length > w + 1 ? "Next Monday (" + monday(w + 1) + ") is settled: " + list[w + 1].name + ". Nothing to add this week." : "Next Monday (" + monday(w + 1) + ") is NOT settled yet. A new playpack can be added for it.");
  console.log("In reserve after that: " + (list.slice(ledger.length).map((p) => p.name).join(", ") || "none"));
  const poll = (app.match(/^var POLL = (.*);$/m) || [])[1]; if (poll && poll !== "null") { const p = JSON.parse(poll); console.log("Open vote (" + p.id + ", decides week " + p.week + "): " + p.ideas.map((i) => i.id).join(", ")); }
  process.exit(0);
}

if (args[0] === "--remove") {
  const id = args[1], at = list.findIndex((p) => p.id === id), w = thisWeek();
  if (at < 0) stop("there is no weekly playpack called " + id);
  if (at <= w) stop(id + " belongs to week " + at + ", which has already begun. It cannot be taken back.");
  const gone = list.splice(at, 1)[0];
  app = writeWeekly(app, list).replace(new RegExp(",\\s*" + gone.art + ':"pack-' + gone.art + '"'), "");
  fs.writeFileSync(APP, app);
  fs.writeFileSync(REC, read(REC).replace(new RegExp('  "' + id + '": \\{\\n[\\s\\S]*?\\n  \\},\\n'), ""));
  fs.writeFileSync(ARTPY, read(ARTPY).replace(new RegExp(',\\n      "' + gone.art + '":"[^\\n]*"(?=\\n|\\})'), ""));
  if (ledger.includes(id)) fs.writeFileSync(LEDGER, JSON.stringify(ledger.slice(0, ledger.indexOf(id)), null, 1) + "\n");
  build();
  console.log("Removed " + gone.name + ". The playpacks after it each move a week earlier. Its pictures can be deleted: web/images/pack-" + gone.art + ".jpg and thumb-pack-" + gone.art + ".jpg");
  process.exit(0);
}

// ---- add ----
const spec = JSON.parse(read(path.resolve(args[0]))), target = thisWeek() + 1;
if (ledger.length > target) stop("next Monday's playpack is already settled (" + list[target].name + "). One new playpack a week.");
if (ledger.length < target) console.log("Note: week " + (ledger.length) + " to " + (target - 1) + " were never settled by a weekly run. The reserve covered them.");
const words = [spec.name, spec.blurb, spec.warning, spec.hint, spec.pitch && spec.pitch.gentle, spec.pitch && spec.pitch.cheeky, spec.pitch && spec.pitch.unhinged];
const limit = { name: 28, blurb: 110, warning: 110, hint: 60 };
if (!/^[a-z][a-z0-9-]{2,30}$/.test(spec.id || "")) stop("the id must be short lower-case words joined by dashes");
if (list.some((p) => p.id === spec.id) || new RegExp('^  "' + spec.id + '": \\{', "m").test(read(REC)) || new RegExp('id:"' + spec.id + '"').test(app)) stop("a playpack called " + spec.id + " already exists");
if (!FAMILIES.includes(spec.family)) stop("family must be one of " + FAMILIES.join(", "));
if (!ICONS.includes(spec.icon)) stop("icon must be one of " + ICONS.join(", "));
if (![1, 2, 3].includes(spec.dare)) stop("dare must be 1 (cozy), 2 (spicy) or 3 (send help)");
if (words.some((t) => typeof t !== "string" || t.trim().length < 8) && (spec.name || "").length < 4) stop("every piece of wording is needed: name, blurb, warning, hint and three pitches");
if (words.some((t) => typeof t !== "string" || !t.trim())) stop("every piece of wording is needed: name, blurb, warning, hint and three pitches");
for (const k of Object.keys(limit)) if (spec[k].length > limit[k]) stop(k + " is " + spec[k].length + " characters, the most that fits is " + limit[k]);
for (const k of ["gentle", "cheeky", "unhinged"]) if (spec.pitch[k].length > 130) stop("Hex's " + k + " line is too long (" + spec.pitch[k].length + " characters, 130 fit)");
const all = words.join(" ");
if (/[–—]/.test(all)) stop("no long dashes in the app's words");
if (RUDE.some((w) => new RegExp("\\b" + w, "i").test(all)) || /\b(damn|hell|crap|kill|die|dead|blood|gore|drunk|beer|sexy)\b/i.test(all)) stop("children use HyMeta: a word in there is not suitable");
if (spec.hint.toLowerCase().includes(spec.name.toLowerCase())) stop("the hint must not give the name away");
if (!/^[a-z]{3,12}$/.test(spec.art || "") || new RegExp("[ {,]" + spec.art + ':"').test(app)) stop("art must be a new short lower-case word for the picture, for example fishing");
if (typeof spec.artPrompt !== "string" || spec.artPrompt.length < 80 || /\b(text|words|letters|caption)\b/i.test(spec.artPrompt)) stop("artPrompt must describe the scene in a sentence or two, with no writing in it");
const r = spec.recipe || {};
if (!Array.isArray(r.theme) || r.theme.length < 4 || !Array.isArray(r.avoid) || !r.avoid.includes("skin pack")) stop("the recipe needs at least four theme words, and \"skin pack\" on its avoid list");
if (!Array.isArray(r.jobs) || r.jobs.length < 4 || r.jobs.length > 6) stop("the recipe needs four to six jobs");
for (const j of r.jobs) if (!j.label || !Array.isArray(j.kw) || !j.kw.length || !Array.isArray(j.q) || !j.q.length || ![1, 2].includes(j.n) || /[–—]/.test(j.label)) stop("each job needs a label, words to match (kw), words to search (q) and n of 1 or 2");
const picks = r.jobs.reduce((n, j) => n + j.n, 0);
if (picks < 5 || picks > 7) stop("the jobs add up to " + picks + " mods. Aim for 5 to 7, and the everyday extras top it up to 8.");
if (!r.jobs.some((j) => j.fresh)) stop("one job must be marked fresh, so a mod published in the last two months gets a place");
if (new Set(r.jobs.map((j) => j.label)).size !== r.jobs.length) stop("two jobs share a label");
const poll = spec.poll;
if (!poll || !Array.isArray(poll.ideas) || poll.ideas.length !== 3) stop("the next vote needs exactly three ideas");
for (const i of poll.ideas) if (!/^[a-z][a-z0-9-]{2,30}$/.test(i.id || "") || !i.name || i.name.length > 28 || !i.line || i.line.length > 90 || /[–—]/.test(i.name + i.line) || new RegExp('id:"' + i.id + '"').test(app) || i.id === spec.id) stop("each idea in the vote needs a new id, a name up to 28 characters and one line up to 90");
if (new Set(poll.ideas.map((i) => i.id)).size !== 3) stop("the three ideas in the vote must be different");

const pack = { id: spec.id, family: spec.family, art: spec.art, name: spec.name, dare: spec.dare, icon: spec.icon, sky: "@NIGHT", moon: "#ffe2a0", hills: "@HILLS", blurb: spec.blurb, warning: spec.warning, pitch: spec.pitch, hint: spec.hint, core: SAMPLE.core, spice: SAMPLE.spice };
list.splice(target, 0, pack);
app = writeWeekly(app, list);
const artEnd = app.indexOf(" };", app.indexOf("var ART = {")); app = app.slice(0, artEnd) + ", " + spec.art + ':"pack-' + spec.art + '"' + app.slice(artEnd);
const nextPoll = { id: "w" + (target + 1), week: target + 1, ideas: poll.ideas.map((i) => ({ id: i.id, name: i.name, line: i.line })) };
if (!/^var POLL = .*;$/m.test(app)) stop("could not find the vote in the app");
app = app.replace(/^var POLL = .*;$/m, () => "var POLL = " + JSON.stringify(nextPoll) + ";");
fs.writeFileSync(APP, app);
const rec = read(REC), end = rec.indexOf("\n};\n\n// ---- matching words"); if (end < 0) stop("could not find the end of the recipes");
fs.writeFileSync(REC, rec.slice(0, end + 1) + recipeText(spec.id, r) + rec.slice(end + 1));
const py = read(ARTPY), jobsEnd = py.indexOf("}\ndef call("); if (jobsEnd < 0) stop("could not find the picture list");
fs.writeFileSync(ARTPY, py.slice(0, jobsEnd) + ",\n      " + q(spec.art) + ":" + q(spec.artPrompt) + py.slice(jobsEnd));
fs.writeFileSync(LEDGER, JSON.stringify(list.slice(0, target + 1).map((p) => p.id), null, 1) + "\n");
build();
console.log("\nAdded " + spec.name + " for the week of Monday " + monday(target) + " (week " + target + "). The reserve playpacks after it each move back a week.");
console.log("The next vote (" + nextPoll.id + ") decides the week of " + monday(target + 1) + ": " + nextPoll.ideas.map((i) => i.name).join(", "));
console.log("Still to do: make the picture (scripts/make-art.py " + spec.art + "), check the recipe (scripts/try-pack.js " + spec.id + "), run npm test, and look at phone and desktop screenshots.");
