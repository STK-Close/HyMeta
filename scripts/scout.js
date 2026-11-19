// Weekly scouting: what is new on CurseForge for Hytale right now?
// Prints the newest mods, the ones updated most recently, and the words that keep turning up,
// so a new playpack can be built around what players are actually getting this month.
// It only prints. Nothing from CurseForge is saved anywhere.
//   NODE_USE_ENV_PROXY=1 CURSEFORGE_API_KEY=... node scripts/scout.js
const { search, isLibrary } = require("../lib/cf");
const { PACKS } = require("../lib/recipes");
const DAY = 24 * 3600 * 1000, days = (d) => Math.round((Date.now() - Date.parse(d || 0)) / DAY);
const STOP = new Set("the a an and or of for to in on with your you is are it this that from by new more all can be at as into mod mods hytale adds add added pack plus simple better custom now use using up s t no not will has have its my our their them one two get any just also over via only when which each every other than then out off own made make makes work works support supports version update updated fix fixed fixes server servers plugin plugins client player players game world items item block blocks".split(" "));
(async () => {
  const pages = (sort, n) => Promise.all(Array.from({ length: n }, (_, i) => search({ sort, size: 50, index: i * 50 }))).then((p) => p.flat().filter((m) => !isLibrary(m)));
  const [fresh, updated] = await Promise.all([pages("new", 4), pages("updated", 2)]);
  const line = (m) => "  " + String(m.name).slice(0, 38).padEnd(39) + String(m.downloadCount || 0).padStart(8) + " dl  " + String(days(m.dateCreated)).padStart(4) + "d old  " + String(m.summary || "").replace(/\s+/g, " ").slice(0, 70);
  const month = fresh.filter((m) => days(m.dateCreated) <= 35);
  console.log("NEW IN THE LAST 5 WEEKS (" + month.length + " mods), most downloaded first");
  month.slice().sort((a, b) => (b.downloadCount || 0) - (a.downloadCount || 0)).slice(0, 45).forEach((m) => console.log(line(m)));
  console.log("\nUPDATED THIS WEEK, most downloaded first");
  updated.filter((m) => days(m.dateModified) <= 7).sort((a, b) => (b.downloadCount || 0) - (a.downloadCount || 0)).slice(0, 25).forEach((m) => console.log(line(m)));
  // words that turn up in many new mods: a theme with several new mods behind it makes a good playpack
  const tally = new Map(), taken = new Set(Object.values(PACKS).flatMap((p) => p.theme));
  month.forEach((m) => new Set((m.name + " " + (m.summary || "")).replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().match(/[a-z]{3,}/g) || []).forEach((w) => { if (!STOP.has(w)) tally.set(w, (tally.get(w) || 0) + 1); }));
  const words = [...tally.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 70);
  console.log("\nWORDS IN SEVERAL NEW MODS (a star marks words no playpack is built around yet)");
  console.log("  " + words.map(([w, n]) => (taken.has(w) || [...taken].some((t) => t && w.startsWith(t)) ? "" : "*") + w + " " + n).join(", "));
})().catch((e) => { console.error("Scouting failed:", e.message); process.exit(1); });
