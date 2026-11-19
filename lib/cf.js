// The only place HyMeta talks to CurseForge. Every call is made live and nothing is stored,
// which is what the CurseForge API terms require. The key comes from the host's settings
// (CURSEFORGE_API_KEY) and never reaches the app in the browser.
const BASE = "https://api.curseforge.com";
const HYTALE = 70216;      // CurseForge's id for Hytale
const MODS_SECTION = 9137; // the "Mods" section, as opposed to worlds, prefabs and translations
const LIBRARY = 9297;      // helper mods that other mods need
const CATEGORY = { blocks: 9285, cosmetics: 10466, farming: 9288, furniture: 9211, gameplay: 9212, library: LIBRARY, minigames: 10684,
  misc: 9290, mobs: 9283, prefab: 9287, qol: 9213, resource: 10425, utility: 9289, worldgen: 9286 };

// Children use HyMeta, so mods whose name or description contains any of these never appear.
const BLOCKED = ["nsfw", "18+", "adult only", "adults only", "sexy", "sexual", "nude", "naked", "porn", "hentai", "lewd", "erotic", "femboy", "fetish",
  "strip club", "fuck", "shit", "bitch", "bastard", "asshole", "dick", "cock", "pussy", "slut", "whore", "rape", "nazi", "hitler", "suicide", "drug dealer", "cocaine", "meth ", "gambling", "casino", "slot machine"];

function hasKey() { return !!process.env.CURSEFORGE_API_KEY; }

async function cf(path, init) {
  const key = process.env.CURSEFORGE_API_KEY;
  if (!key) throw Object.assign(new Error("No CurseForge key is set"), { code: "nokey" });
  const r = await fetch(BASE + path, { ...(init || {}), headers: { Accept: "application/json", "x-api-key": key, ...((init && init.headers) || {}) } });
  if (!r.ok) throw Object.assign(new Error("CurseForge answered " + r.status), { code: "upstream", status: r.status });
  return r.json();
}

function clean(m) {
  const text = (" " + m.name + " " + (m.summary || "") + " ").toLowerCase();
  return !BLOCKED.some((w) => text.includes(w));
}
const usable = (m) => m && m.gameId === HYTALE && m.classId === MODS_SECTION && m.isAvailable !== false && clean(m);
const isLibrary = (m) => m.primaryCategoryId === LIBRARY;

// The file a player actually gets when they install the mod.
function mainFile(m) {
  const files = m.latestFiles || [];
  return files.find((f) => f.id === m.mainFileId) || files[0] || null;
}
const related = (m, type) => { const f = mainFile(m); return f ? (f.dependencies || []).filter((d) => d.relationType === type).map((d) => d.modId) : []; };
// The helper mods a mod says it cannot run without (relation type 3 is "required").
const requiredHelpers = (m) => related(m, 3);
// Mods this one says it must not be installed alongside (relation type 5 is "incompatible").
const incompatibleWith = (m) => related(m, 5);
// Game versions the main file is marked for, as numbers only: ["0.7", "0.6"]. "Early Access" style labels are left out.
function gameVersions(m) { const f = mainFile(m); return f ? (f.gameVersions || []).filter((v) => /^\d+(\.\d+)*$/.test(v)) : []; }
function compareVersions(a, b) {
  const x = String(a).split(".").map(Number), y = String(b).split(".").map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; }
  return 0;
}
const newestVersion = (m) => gameVersions(m).sort(compareVersions).pop() || "";

// What the app receives for each mod: only what a mod card shows.
function shape(m) {
  return {
    id: "cf" + m.id,
    name: m.name,
    by: (m.authors || []).slice(0, 2).map((a) => a.name).join(", "),
    blurb: m.summary || "",
    tags: (m.categories || []).slice(0, 3).map((c) => String(c.name).replace(/\\/g, " and ")),
    downloads: m.downloadCount || 0,
    updated: m.dateModified || "",
    logo: (m.logo && m.logo.thumbnailUrl) || "",
    url: (m.links && m.links.websiteUrl) || "",
    canAutoInstall: m.allowModDistribution !== false,
    version: newestVersion(m),
  };
}

// Most popular first. `cat` is a key of CATEGORY, `q` is a search word.
async function search({ cat, q, size = 30, index = 0 }) {
  const p = new URLSearchParams({ gameId: HYTALE, classId: MODS_SECTION, sortField: 2, sortOrder: "desc", pageSize: Math.min(size, 50), index });
  if (cat && CATEGORY[cat]) p.set("categoryId", CATEGORY[cat]);
  if (q) p.set("searchFilter", q);
  const d = await cf("/v1/mods/search?" + p);
  return (d.data || []).filter(usable);
}

async function byIds(ids) {
  const clean = [...new Set(ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 50);
  if (!clean.length) return [];
  const d = await cf("/v1/mods", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ modIds: clean }) });
  return (d.data || []).filter(usable);
}

function fail(res, json, err) {
  if (err && err.code === "nokey") return json(res, 503, { error: "nokey" });
  return json(res, 502, { error: "curseforge", status: (err && err.status) || 0 });
}
module.exports = { hasKey, search, byIds, shape, isLibrary, requiredHelpers, incompatibleWith, gameVersions, newestVersion, compareVersions, fail, CATEGORY };
