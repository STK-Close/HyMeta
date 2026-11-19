// Playpack recipes. Each playpack is a list of jobs ("crops", "animals", "cooking"), and each job is
// filled by the best-fitting mod found by live CurseForge searches. Nothing from CurseForge is stored.
//
// How a mod earns its place:
//   fit       the job's words appear in its name or description, as whole words ("pet" never matches "carpet")
//   upkeep    updated recently, and marked for the game version most mods currently support
//   trust     more downloads count for more, for the main picks
//   fairness  one mod per job, at most two mods per author, nothing that needs a pile of helper mods,
//             nothing a chosen mod says it clashes with, and nothing that plainly belongs to another playpack
// "Gem" jobs skip the most popular match and rotate weekly among good lesser-known mods.
const { search, byIds, shape, isLibrary, requiredHelpers, incompatibleWith, gameVersions, compareVersions } = require("./cf");

const DAY = 24 * 3600 * 1000;
// Add-ons that only make sense on top of some other big mod are never main picks.
const NEVER = ["integration", "compat", "addon", "add-on", "skin"];
const RESOURCE_PACKS = 10425; // texture and skin packs change looks, not how you play
const MAX_HELPERS_PER_MOD = 3, MAX_PER_AUTHOR = 2, MIN_DOWNLOADS = 500, MIN_GEM_DOWNLOADS = 500;
// Guides for new players suggest starting with 5 to 10 mods, so every playpack aims for 8 picks:
// its own jobs first, then up to three everyday extras that suit any playstyle.
const TARGET_PICKS = 8, MAX_EXTRAS = 3;
const EXTRAS = [
  { label: "Know what you are looking at", kw: ["hud", "info", "tooltip", "identif"], q: ["hud", "info"], cat: "qol", n: 1, extra: true },
  { label: "A better map", kw: ["map", "minimap"], q: ["map"], n: 1, extra: true },
  { label: "More room in your bags", kw: ["backpack", "inventory", "bag", "pouch"], q: ["backpack", "inventory"], n: 1, extra: true },
];

// job: { label, kw: words that mean a mod does this job, q: words to search for, cat: CurseForge category, n, gem, avoid }
const PACKS = {
  "cozy-farmer": {
    theme: ["farm", "crop", "harvest", "garden", "cook", "food", "livestock", "chicken", "cow", "coop", "husbandry", "cozy", "fish"],
    avoid: ["combat", "weapon", "boss", "dungeon", "gun", "skin pack"],
    jobs: [
      { label: "Crops and gardens", kw: ["crop", "farm", "harvest", "garden", "seed", "plant", "orchard"], q: ["farm", "crop"], cat: "farming", needCat: true, n: 2 },
      { label: "Farm animals", kw: ["animal", "livestock", "chicken", "cow", "sheep", "coop", "husbandry", "breed"], q: ["animal", "breeding"], n: 1 },
      { label: "Cooking", kw: ["cook", "food", "recipe", "kitchen", "culinary", "meal", "brew", "bak"], q: ["cooking", "food"], n: 1 },
      { label: "A cozy home", kw: ["decor", "furniture", "cozy", "greenhouse", "cottage", "rustic"], q: ["decor", "cozy"], cat: "furniture", n: 1, gem: true },
      { label: "Fishing and seasons", kw: ["fish", "season", "weather", "angl"], q: ["fishing", "season"], n: 1, gem: true },
    ],
  },
  "dungeon-gremlin": {
    theme: ["dungeon", "boss", "combat", "weapon", "loot", "elite", "raid", "sword", "monster", "tomb", "parr"],
    avoid: ["farm", "furniture", "decor", "skin pack"],
    jobs: [
      { label: "Dungeons to raid", kw: ["dungeon", "tomb", "crypt", "labyrinth", "raid", "catacomb"], q: ["dungeon", "tomb"], n: 2 },
      { label: "Sharper combat", kw: ["combat", "parr", "dodge", "block", "stun", "combo"], q: ["combat", "parry"], n: 1 },
      { label: "Bosses", kw: ["boss", "elite", "titan"], q: ["boss"], n: 1 },
      { label: "Weapons", kw: ["weapon", "sword", "blade", "armory", "axe", "bow"], q: ["weapon", "sword"], n: 1, gem: true },
      { label: "Loot and levels", kw: ["loot", "level", "skill", "enchant", "treasure"], q: ["loot", "enchant"], n: 1, gem: true },
    ],
  },
  "master-builder": {
    theme: ["block", "build", "furniture", "decor", "door", "window", "roof", "wall", "brick", "lamp", "construct", "blueprint"],
    avoid: ["dungeon", "combat", "boss", "weapon", "skin pack", "machine", "lucky", "automat", "furnace"],
    jobs: [
      { label: "New blocks", kw: ["block", "brick", "slab", "tile", "masonry", "plank", "path"], q: ["blocks", "brick"], cat: "blocks", needCat: true, n: 2 },
      { label: "Furniture", kw: ["furniture", "furnish", "chair", "table", "shelf", "kitchen", "bed"], q: ["furniture"], cat: "furniture", needCat: true, n: 1 },
      { label: "Doors, windows and roofs", kw: ["door", "window", "roof", "stair", "fence", "gate"], q: ["door", "window", "roof"], n: 1 },
      { label: "Building tools", kw: ["build", "builder", "scaffold", "blueprint", "schematic", "copy"], q: ["builder", "blueprint"], n: 1 },
      { label: "Finishing touches", kw: ["decor", "lamp", "light", "plush", "carpet", "painting", "banner"], q: ["decor", "lamp"], n: 1, gem: true },
    ],
  },
  "the-wanderer": {
    theme: ["map", "minimap", "waypoint", "explor", "biome", "travel", "structure", "ruin", "cave", "compass", "landmark"],
    avoid: ["skin pack"],
    jobs: [
      { label: "A better map", kw: ["map", "minimap"], q: ["map", "minimap"], n: 1 },
      { label: "Waypoints", kw: ["waypoint", "teleport", "recall", "marker", "trail"], q: ["waypoint"], n: 1 },
      { label: "New places", kw: ["biome", "world gen", "worldgen", "landscape", "terrain", "dimension", "realm", "island"], q: ["biome", "dimension"], cat: "worldgen", needCat: true, n: 2 },
      { label: "Things to find", kw: ["structure", "ruin", "village", "tower", "landmark", "temple"], q: ["structure", "ruin"], cat: "prefab", n: 1, gem: true },
      { label: "Getting around", kw: ["glider", "boat", "vehicle", "backpack", "camp", "travel"], q: ["glider", "backpack", "travel"], n: 1, gem: true },
    ],
  },
  "too-many-legs": {
    theme: ["spider", "arachn", "web", "cocoon", "insect", "bug", "swarm", "venom", "scorpion", "beetle"],
    avoid: ["skin", "spider-man", "spiderman", "begone", "arachnophob", "remove", "disable", "horror", "nightmare", "gore", "blood"], // children use HyMeta: creepy is fine, horror is not
    jobs: [
      { label: "Spiders", kw: ["spider", "arachn", "web", "cocoon"], q: ["spider"], n: 2 },
      { label: "Creepy crawlies", kw: ["insect", "bug", "swarm", "scorpion", "beetle", "centipede", "wasp"], q: ["insect", "swarm", "scorpion"], n: 1 },
      { label: "Tougher monsters", kw: ["monster", "elite", "mob", "enemy", "creature"], q: ["monster"], cat: "mobs", needCat: true, n: 1 },
      { label: "Deeper caves", kw: ["cave", "underground", "dark", "depth"], q: ["cave", "underground"], n: 1, gem: true },
    ],
  },
  "wizard-dropout": {
    theme: ["magic", "spell", "wand", "staff", "arcan", "mana", "rune", "wizard", "mage", "potion", "alchem", "sorcer"],
    avoid: ["builder", "building", "merchant", "skin pack"],
    jobs: [
      { label: "Spells", kw: ["spell", "magic", "arcan", "sorcer"], q: ["spell", "magic"], n: 2 },
      { label: "Wands and staffs", kw: ["wand", "staff", "stave", "scepter"], q: ["staff", "wand"], n: 1 },
      { label: "Potions", kw: ["potion", "alchem", "elixir", "brew"], q: ["potion", "alchemy"], n: 1 },
      { label: "Runes and enchanting", kw: ["enchant", "rune", "mana"], q: ["enchant", "rune"], n: 1, gem: true },
      { label: "Magical gear", kw: ["robe", "amulet", "artifact", "relic", "talisman", "crystal"], q: ["artifact", "relic"], n: 1, gem: true },
    ],
  },
  "beast-friend": {
    theme: ["pet", "tame", "taming", "mount", "animal", "companion", "breed", "ride", "saddle", "horse", "wildlife"],
    avoid: ["skin pack"],
    jobs: [
      { label: "Taming", kw: ["tame", "taming", "tameable"], q: ["tame", "taming"], n: 1 },
      { label: "Pets", kw: ["pet", "companion", "cat", "dog"], q: ["pet", "companion"], n: 2 },
      { label: "Mounts", kw: ["mount", "ride", "saddle", "horse", "dino"], q: ["mount"], n: 1 },
      { label: "New creatures", kw: ["creature", "animal", "wildlife", "fauna", "bird"], q: ["creature", "wildlife"], n: 1, gem: true },
      { label: "Care and breeding", kw: ["breed", "feed", "treat", "baby", "egg"], q: ["breeding", "feed"], n: 1, gem: true },
    ],
  },
  "factory-goblin": {
    theme: ["automat", "machine", "conveyor", "pipe", "factory", "sort", "power", "energy", "tech", "industrial", "hopper", "quarry"],
    avoid: ["gambling", "backpack", "skin pack"],
    jobs: [
      { label: "Machines", kw: ["automat", "machine", "factory", "industrial", "tech"], q: ["automation", "machine", "factory"], n: 2 },
      { label: "Moving items", kw: ["pipe", "hopper", "conveyor", "transport", "logistic"], q: ["pipe", "hopper", "conveyor"], n: 1 },
      { label: "Storage that sorts itself", kw: ["storage", "sort", "warehouse", "drawer", "chest"], q: ["storage", "sort"], n: 1 },
      { label: "Smarter crafting", kw: ["craft", "workbench", "furnace", "smelt", "anvil"], q: ["crafting", "workbench", "furnace"], n: 1 },
      { label: "Power and mining", kw: ["generator", "electric", "miner", "quarry", "drill", "ore"], q: ["generator", "miner", "quarry"], n: 1, gem: true },
    ],
  },
  "hard-mode-hermit": {
    theme: ["hardcore", "permadeath", "survival", "hunger", "thirst", "temperature", "difficult", "harsh", "realistic"],
    avoid: ["skin pack", "creative"],
    jobs: [
      { label: "One life", kw: ["hardcore", "permadeath", "yolo"], q: ["hardcore", "permadeath"], n: 1 },
      { label: "Hunger and thirst", kw: ["hunger", "thirst", "hungry"], q: ["hunger", "thirst"], n: 1 },
      { label: "Cold and heat", kw: ["temperature", "cold", "heat", "season", "weather"], q: ["temperature", "season"], n: 1 },
      { label: "Tougher world", kw: ["difficult", "harder", "tougher", "challenge", "scaling"], q: ["difficulty", "harder"], n: 1 },
      { label: "Survival gear", kw: ["survival", "camp", "shelter", "torch", "bandage", "injur"], q: ["survival", "camp"], n: 1, gem: true },
    ],
  },
  "whole-circus": {
    theme: [], avoid: ["skin pack"], sharesFreely: true,
    jobs: [
      { label: "Everyday helpers", kw: ["hud", "info", "tooltip", "sort", "quality", "inventory"], q: ["hud", "inventory"], cat: "qol", n: 2 },
      { label: "A bit of combat", kw: ["combat", "weapon", "parr"], q: ["combat"], n: 1 },
      { label: "A bit of farming", kw: ["farm", "crop", "animal"], q: ["farm"], cat: "farming", n: 1 },
      { label: "A bit of magic", kw: ["magic", "spell", "arcan"], q: ["magic"], n: 1 },
      { label: "A bit of exploring", kw: ["biome", "structure", "dungeon", "map"], q: ["biome"], cat: "worldgen", n: 1 },
      { label: "A bit of building", kw: ["furniture", "block", "decor"], q: ["furniture"], n: 1, gem: true },
    ],
  },
};

// ---- matching words -------------------------------------------------------------------------
const patterns = new Map();
// A word matches at the start of a word and may run on: "farm" matches "farming", "pet" does not match "carpet".
function pattern(word) {
  if (!patterns.has(word)) patterns.set(word, new RegExp("(^|[^a-z0-9])" + word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "[ -]?") + "[a-z]*", "i"));
  return patterns.get(word);
}
// "BetterMap" is read as "Better Map", so run-together names still match
const spaced = (text) => String(text).replace(/([a-z])([A-Z])/g, "$1 $2");
const hits = (text, words) => { const t = spaced(text); return words.filter((w) => pattern(w).test(t)).length; };
// needCat: the mod must also sit in the job's CurseForge category
function fit(m, words, cat, needCat) {
  const inName = hits(m.name, words), inBlurb = hits(m.summary || "", words);
  const inCat = !!cat && (m.categories || []).some((c) => c.id === cat);
  // capped, so a name stuffed with keywords does not outrank a better mod
  return { score: 3 * Math.min(inName, 2) + Math.min(inBlurb, 2) + (inCat ? 2 : 0), named: inName > 0, ok: needCat ? inCat && inName + inBlurb > 0 : inName > 0 || (inBlurb > 0 && inCat) || inBlurb >= 2 };
}
const themeFit = (m, pack) => 3 * hits(m.name, pack.theme) + Math.min(hits(m.summary || "", pack.theme), 3);
const avoided = (m, words) => !!words && hits(m.name + " " + (m.summary || ""), words) > 0;

// ---- upkeep ---------------------------------------------------------------------------------
const daysSinceUpdate = (m, ctx) => (ctx.now - Date.parse(m.dateModified || 0)) / DAY;
const supportsCurrent = (m, ctx) => !!ctx.current && gameVersions(m).some((v) => compareVersions(v, ctx.current) >= 0);
function upkeep(m, ctx) {
  const days = daysSinceUpdate(m, ctx);
  const fresh = days <= 45 ? 1.5 : days <= 120 ? 0.75 : days <= 240 ? 0 : -2;
  const marked = gameVersions(m);
  const version = !ctx.current || !marked.length ? 0 : supportsCurrent(m, ctx) ? 1 : -2.5;
  // every helper mod a pick needs is one more thing that can break
  return fresh + version - 0.75 * requiredHelpers(m).length;
}
// Likely still working: marked for the current game version, or touched recently enough to trust.
// Hytale changes fast in early access, so an old mod with no current-version mark is left out.
function alive(m, ctx) {
  if (supportsCurrent(m, ctx)) return true;
  const days = daysSinceUpdate(m, ctx);
  return gameVersions(m).length ? days <= 60 : days <= 270;
}
// The game version most of the candidate mods are marked for is treated as "current".
function currentVersion(mods) {
  const tally = new Map();
  mods.forEach((m) => gameVersions(m).forEach((v) => tally.set(v, (tally.get(v) || 0) + 1)));
  return [...tally.entries()].sort((a, b) => b[1] - a[1] || compareVersions(b[0], a[0])).map((e) => e[0])[0] || "";
}

const authorsOf = (m) => (m.authors || []).map((a) => a.name).filter(Boolean);
// A plain warning for the card when a pick may not work with the current game.
function caution(m, ctx) {
  if (supportsCurrent(m, ctx)) return "";
  if (gameVersions(m).length) return "Made for an older game version. It may not work.";
  return daysSinceUpdate(m, ctx) > 240 ? "Not updated in a long time. It may not work." : "";
}
function weekNumber(now = Date.now()) { return Math.floor(now / (7 * DAY)); }
const CAT_ID = require("./cf").CATEGORY;

async function resolve(id, now = Date.now()) {
  const pack = PACKS[id];
  if (!pack) return null;
  // 1. gather candidates with live searches (each distinct search runs once)
  const wanted = new Map();
  const jobs = pack.jobs.concat(EXTRAS);
  jobs.forEach((job) => { (job.q || []).forEach((q) => wanted.set("q:" + q, { q })); if (job.cat) wanted.set("c:" + job.cat, { cat: job.cat }); });
  const lists = await Promise.all([...wanted.values()].map((s) => search({ ...s, size: 40 })));
  const pool = new Map();
  lists.flat().forEach((m) => { if (!isLibrary(m) && m.primaryCategoryId !== RESOURCE_PACKS && !avoided(m, pack.avoid) && !avoided(m, NEVER)) pool.set(m.id, m); });
  const everything = [...pool.values()];
  const ctx = { now, current: currentVersion(everything) };
  const mods = everything.filter((m) => alive(m, ctx));

  // 2. fill each job
  const used = new Set(), perAuthor = new Map(), clashes = new Set(), out = { core: [], spice: [], extras: [], helpers: [], gameVersion: ctx.current }, chosen = [];
  const picked = () => out.core.concat(out.spice, out.extras);
  const others = Object.entries(PACKS).filter(([key, p]) => key !== id && !p.sharesFreely).map(([, p]) => p);
  const filled = (job) => picked().filter((p) => p.role === job.label).length;
  const allowed = (m, job) => {
    if (used.has(m.id) || clashes.has(m.id) || incompatibleWith(m).some((x) => used.has(x))) return false;
    if (requiredHelpers(m).length > MAX_HELPERS_PER_MOD) return false;
    if (authorsOf(m).some((a) => (perAuthor.get(a) || 0) >= MAX_PER_AUTHOR)) return false;
    // one mod per job: if its name says it does a job that is already filled, it would double up
    if (jobs.some((other) => other !== job && filled(other) >= other.n && hits(m.name, other.kw) > 0)) return false;
    // leave it for the playpack it clearly belongs to
    if (!pack.sharesFreely && !job.extra) { const mine = themeFit(m, pack); if (others.some((p) => themeFit(m, p) >= mine + 4)) return false; }
    return true;
  };
  const take = (m, job) => {
    used.add(m.id); incompatibleWith(m).forEach((x) => clashes.add(x)); chosen.push(m);
    authorsOf(m).forEach((a) => perAuthor.set(a, (perAuthor.get(a) || 0) + 1));
    out[job.extra ? "extras" : job.gem ? "spice" : "core"].push({ ...shape(m), role: job.label, caution: caution(m, ctx) });
  };
  // the job each mod suits best, so a furniture mod is not used up as "new blocks"
  const best = new Map();
  const bestJob = (m) => {
    if (!best.has(m.id)) best.set(m.id, pack.jobs.map((j) => ({ j, f: fit(m, j.kw, j.cat ? CAT_ID[j.cat] : 0, j.needCat) })).filter((x) => x.f.ok).sort((a, b) => b.f.score - a.f.score)[0]);
    return best.get(m.id) && best.get(m.id).j;
  };
  let extrasTaken = 0;
  jobs.forEach((job) => {
    if (job.extra && (picked().length >= TARGET_PICKS || extrasTaken >= MAX_EXTRAS)) return;
    const cat = job.cat ? CAT_ID[job.cat] : 0;
    const judge = (list) => list.map((m) => ({ m, f: fit(m, job.kw, cat, job.needCat) })).filter((x) => x.f.ok && !avoided(x.m, job.avoid));
    const fits = judge(mods);
    if (process.env.HYMETA_EXPLAIN) console.log(`  job "${job.label}": ` + fits.slice().sort((a, b) => (b.m.downloadCount || 0) - (a.m.downloadCount || 0)).slice(0, 6).map((x) => `${x.m.name.slice(0, 24)} (fit ${x.f.score}, up ${upkeep(x.m, ctx)}, ok ${allowed(x.m, job)})`).join(" | "));
    const popularity = (m) => Math.log10((m.downloadCount || 0) + 1);
    // mods that name the job in their title come first, then fit, trust and upkeep decide
    const rank = (list, minDownloads) => list.filter((x) => (x.m.downloadCount || 0) >= minDownloads)
      .map((x) => ({ m: x.m, named: x.f.named, home: bestJob(x.m) === job, s: x.f.score + 1.5 * popularity(x.m) + 1.5 * upkeep(x.m, ctx) }))
      .sort((a, b) => (b.home - a.home) || (b.named - a.named) || b.s - a.s || a.m.id - b.m.id);
    const fill = (list, upTo) => list.some((x) => { if (allowed(x.m, job)) take(x.m, job); return filled(job) >= upTo; });
    if (!job.gem) {
      fill(rank(fits, MIN_DOWNLOADS), job.n);
      // nothing established does this job: accept a smaller well-kept mod, then an older one (flagged on its card)
      if (!filled(job)) fill(rank(fits, 50), 1);
      if (!filled(job) && !job.extra) fill(rank(judge(everything.filter((m) => !alive(m, ctx))), 50), 1);
      if (job.extra) extrasTaken += filled(job);
    } else {
      // skip the single most downloaded match, then rotate weekly among the best lesser-known ones
      const star = fits.slice().sort((a, b) => (b.m.downloadCount || 0) - (a.m.downloadCount || 0))[0];
      const gems = fits.filter((x) => x !== star && (x.m.downloadCount || 0) >= MIN_GEM_DOWNLOADS && allowed(x.m, job))
        .map((x) => ({ m: x.m, s: x.f.score + 1.5 * upkeep(x.m, ctx) - 0.6 * popularity(x.m) })).sort((a, b) => b.s - a.s || a.m.id - b.m.id).slice(0, 4);
      const list = gems.length ? gems : star && allowed(star.m, job) ? [{ m: star.m }] : [];
      for (let k = 0, got = 0; k < list.length && got < job.n; k++) { const pick = list[(weekNumber(now) + k) % list.length].m; if (allowed(pick, job)) { take(pick, job); got++; } }
    }
  });

  // 3. add the helper mods the picks cannot run without
  const need = [...new Set(chosen.flatMap(requiredHelpers))].filter((n) => !used.has(n)).slice(0, 12);
  if (need.length) out.helpers = (await byIds(need)).map(shape);
  return out;
}

// One lesser-known, well-kept mod a week, taken from well past the top of the popularity list.
async function spotlight(now = Date.now()) {
  const list = (await search({ size: 40, index: 80 + (weekNumber(now) % 10) * 40 })).filter((m) => !isLibrary(m) && m.logo && m.summary);
  if (!list.length) return null;
  const ctx = { now, current: currentVersion(list) };
  const best = list.map((m) => ({ m, s: upkeep(m, ctx) })).sort((a, b) => b.s - a.s || a.m.id - b.m.id).slice(0, 5);
  return shape(best[weekNumber(now) % best.length].m);
}

// Every word the recipes search for (used by the pretend CurseForge in tests).
const searchWords = () => [...new Set(Object.values(PACKS).flatMap((p) => p.jobs).concat(EXTRAS).flatMap((j) => j.q || []))];
module.exports = { PACKS, EXTRAS, TARGET_PICKS, resolve, spotlight, weekNumber, searchWords };
