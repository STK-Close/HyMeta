// Early playpack recipes. Each playpack is a set of live CurseForge searches, so nothing from
// CurseForge is stored. "core" takes the most popular matches. "spice" reaches further down the
// list and shifts every week, which is how lesser-known mods get their turn.
// These are test recipes: the smarter weekly generator replaces them later.
const { search, byIds, shape, isLibrary, requiredHelpers } = require("./cf");

const RECIPES = {
  "cozy-farmer":      { core: [{ cat: "farming", n: 3 }, { q: "farm", n: 1 }],              spice: [{ q: "animal", n: 1 }, { q: "decor", n: 1 }] },
  "dungeon-gremlin":  { core: [{ q: "dungeon", n: 2 }, { q: "combat", n: 2 }],              spice: [{ q: "boss", n: 1 }, { q: "weapon", n: 1 }] },
  "master-builder":   { core: [{ cat: "blocks", n: 2 }, { cat: "furniture", n: 2 }],        spice: [{ q: "decor", n: 1 }, { cat: "prefab", n: 1 }] },
  "the-wanderer":     { core: [{ q: "map", n: 2 }, { cat: "worldgen", n: 2 }],              spice: [{ q: "waypoint", n: 1 }, { q: "biome", n: 1 }] },
  "too-many-legs":    { core: [{ q: "spider", n: 3 }],                                      spice: [{ cat: "mobs", n: 2 }] },
  "wizard-dropout":   { core: [{ q: "magic", n: 2 }, { q: "spell", n: 2 }],                 spice: [{ q: "wand", n: 1 }, { q: "staff", n: 1 }] },
  "beast-friend":     { core: [{ q: "pet", n: 2 }, { q: "tame", n: 2 }],                    spice: [{ q: "mount", n: 1 }, { q: "animal", n: 1 }] },
  "factory-goblin":   { core: [{ q: "automation", n: 2 }, { q: "storage", n: 2 }],          spice: [{ q: "pipe", n: 1 }, { q: "machine", n: 1 }] },
  "hard-mode-hermit": { core: [{ q: "hardcore", n: 2 }, { q: "hunger", n: 2 }],             spice: [{ q: "temperature", n: 1 }, { q: "survival", n: 1 }] },
  "whole-circus":     { core: [{ cat: "gameplay", n: 2 }, { cat: "qol", n: 2 }],            spice: [{ cat: "mobs", n: 1 }, { cat: "worldgen", n: 1 }, { cat: "furniture", n: 1 }] },
};

function weekNumber(now = Date.now()) { return Math.floor(now / (7 * 24 * 3600 * 1000)); }

async function resolve(id, now) {
  const recipe = RECIPES[id];
  if (!recipe) return null;
  const week = weekNumber(now), used = new Set(), out = { core: [], spice: [], helpers: [] }, raw = [];
  const slots = ["core", "spice"].flatMap((part) => recipe[part].map((slot) => ({ part, slot })));
  const results = await Promise.all(slots.map(({ slot }) => search({ cat: slot.cat, q: slot.q, size: 30 })));
  slots.forEach(({ part, slot }, i) => {
    const list = results[i].filter((m) => !isLibrary(m));
    // spice skips the top of the list, further each week, but never past what the list holds
    const start = part === "spice" ? Math.min(4 + (week % 4) * 2, Math.max(0, list.length - slot.n - 1)) : 0;
    let got = 0;
    for (let k = 0; k < list.length && got < slot.n; k++) {
      const m = list[(start + k) % list.length];
      if (used.has(m.id)) continue;
      used.add(m.id); raw.push(m); out[part].push(shape(m)); got++;
    }
  });
  const need = [...new Set(raw.flatMap(requiredHelpers))].filter((n) => !used.has(n)).slice(0, 12);
  if (need.length) out.helpers = (await byIds(need)).map(shape);
  return out;
}

// One lesser-known mod a week: taken from well past the top of the popularity list.
async function spotlight(now) {
  const list = await search({ size: 20, index: 60 + (weekNumber(now) % 12) * 20 });
  const pick = list.find((m) => !isLibrary(m) && m.logo && m.summary);
  return pick ? shape(pick) : null;
}
module.exports = { RECIPES, resolve, spotlight, weekNumber };
