// Checks the playpack recipes against a pretend CurseForge that is full of traps: mods that would
// win a place on downloads alone and must be turned away by one specific rule.
// Run: node tests/recipes.test.js
process.env.CURSEFORGE_API_KEY = "pretend-key";
require("../scripts/dev-server").pretendCurseForge();
const { PACKS, EXTRAS, TARGET_PICKS, resolve, spotlight } = require("../lib/recipes");
const WEEK = 7 * 24 * 3600 * 1000, NOW = Date.now();

(async () => {
  const problems = [], bad = (m) => problems.push(m);
  const packs = {};
  for (const id of Object.keys(PACKS)) packs[id] = await resolve(id, NOW);
  const picks = (id) => packs[id].core.concat(packs[id].spice, packs[id].extras);
  const names = (id) => picks(id).map((m) => m.name);
  const has = (id, text) => names(id).some((n) => n.includes(text));

  for (const id of Object.keys(PACKS)) {
    const jobs = PACKS[id].jobs.concat(EXTRAS).map((j) => j.label), list = picks(id);
    if (list.length < 6) bad(`${id}: only ${list.length} mods, a playpack needs at least 6`);
    if (list.length > 10) bad(`${id}: ${list.length} mods, more than the 10 a new player should start with`);
    if (packs[id].extras.length > 3) bad(`${id}: ${packs[id].extras.length} everyday extras, the limit is 3`);
    if (list.length < TARGET_PICKS && packs[id].extras.length < 2) bad(`${id}: stopped at ${list.length} mods without topping up from the everyday extras`);
    packs[id].extras.forEach((m) => { if (!EXTRAS.some((j) => j.label === m.role)) bad(`${id}: "${m.name}" is filed under extras but is not one`); });
    if (new Set(list.map((m) => m.id)).size !== list.length) bad(`${id}: the same mod appears twice`);
    list.forEach((m) => { if (!jobs.includes(m.role)) bad(`${id}: "${m.name}" has no job it was picked for`); });
    PACKS[id].jobs.concat(EXTRAS).forEach((j) => { const n = list.filter((m) => m.role === j.label).length; if (n > j.n) bad(`${id}: ${n} mods doing the job "${j.label}", which takes ${j.n}`); });
    if (packs[id].gameVersion !== "0.7") bad(`${id}: current game version worked out as "${packs[id].gameVersion}", expected 0.7`);
  }
  // an extra never doubles up on one of the playpack's own jobs
  if (picks("the-wanderer").filter((m) => /map/i.test(m.name)).length > 1) bad("the-wanderer: two map mods, one from its own job and one from the extras");
  if (packs["whole-circus"].extras.some((m) => /hud|info/i.test(m.name))) bad("whole-circus: an extra doubled up on its own everyday helpers job");
  if (!has("the-wanderer", "PretendBetterMap")) bad('the-wanderer: a run-together name like "BetterMap" was not recognised as a map mod');
  // whole words only
  if (has("beast-friend", "Carpets")) bad('beast-friend: "Carpets" was matched by the word "pet"');
  // each playpack's own avoid list, resource packs and add-ons
  if (has("too-many-legs", "Skin Pack")) bad("too-many-legs: a skin pack got in");
  if (has("too-many-legs", "Begone")) bad("too-many-legs: a mod that removes spiders got in");
  if (has("too-many-legs", "textures")) bad("too-many-legs: a resource pack got in");
  if (has("dungeon-gremlin", "integration")) bad("dungeon-gremlin: an add-on for another mod got in");
  // upkeep
  if (has("the-wanderer", "ancient")) bad("the-wanderer: an old, untouched mod for an old game version was picked");
  const staff = picks("wizard-dropout").find((m) => m.role === "Wands and staffs");
  if (!staff) bad("wizard-dropout: no fallback pick when every wand and staff mod is old");
  else if (!staff.caution) bad("wizard-dropout: an out-of-date fallback pick carries no warning");
  if (picks("cozy-farmer").some((m) => m.caution)) bad("cozy-farmer: a well-kept mod carries a warning");
  // new arrivals: a job marked fresh goes to a mod published in the last two months, even with few downloads
  const newcomer = picks("scenic-route").find((m) => m.name === "Pretend Waterfall Newcomer");
  if (!newcomer || newcomer.fresh !== true || newcomer.role !== "Water that moves") bad("scenic-route: the new waterfall mod was not given the fresh place: " + names("scenic-route").join(" | "));
  if (has("scenic-route", "Hours Old")) bad("scenic-route: a mod published yesterday with almost no downloads got in");
  if (picks("scenic-route").filter((m) => m.fresh).some((m) => !/Newcomer/.test(m.name))) bad("scenic-route: an old mod is labelled as a new arrival");
  if (has("cozy-farmer", "Crop Farm Newcomer")) bad("cozy-farmer: a barely-downloaded new mod took an ordinary place");
  if (Object.values(packs).flatMap((p) => p.core.concat(p.spice, p.extras)).some((m) => m.fresh && m.name.indexOf("Newcomer") < 0)) bad("a mod is labelled as a new arrival outside a fresh job");
  // a mod stays with the playpack it belongs to
  if (!has("beast-friend", "Taming Pets Mounts")) bad("beast-friend: the taming and pets mod is missing");
  if (has("dungeon-gremlin", "Taming Pets Mounts")) bad("dungeon-gremlin: took a mod that belongs to the pets playpack");
  // no more than two mods from one author
  const flood = picks("dungeon-gremlin").filter((m) => m.by === "flooder").length;
  if (flood > 2) bad(`dungeon-gremlin: ${flood} mods from one author`);
  if (flood < 1) bad("dungeon-gremlin: expected the popular dungeon mods to be picked");
  // clashes, doubling up and helper-heavy mods
  if (!has("hard-mode-hermit", "hardcore star")) bad("hard-mode-hermit: the hardcore mod is missing");
  if (has("hard-mode-hermit", "rival")) bad("hard-mode-hermit: picked a mod that clashes with one already chosen");
  if (has("hard-mode-hermit", "season mega")) bad("hard-mode-hermit: picked a second hunger mod for a different job");
  if (has("factory-goblin", "heavy")) bad("factory-goblin: picked a mod that needs five helper mods");
  // helpers, blocked words
  if (!packs["cozy-farmer"].helpers.some((m) => m.name === "Pretend Helper Lib")) bad("cozy-farmer: the helper mod was not found");
  if (has("cozy-farmer", "Helper Lib")) bad("cozy-farmer: a helper mod was used as a main pick");
  if (has("cozy-farmer", "Sexy")) bad("cozy-farmer: a mod with a blocked word got in");
  if (!has("cozy-farmer", "Sneaky Crops") || !has("cozy-farmer", "Coops")) bad("cozy-farmer: expected picks are missing: " + names("cozy-farmer").join(", "));
  // lesser-known picks: never the superstar, the same all week, different across weeks
  const gemNames = async (t) => (await resolve("cozy-farmer", t)).spice.map((m) => m.name).join(" | ");
  const weeks = [await gemNames(NOW), await gemNames(NOW + WEEK), await gemNames(NOW + 2 * WEEK), await gemNames(NOW + 3 * WEEK)];
  if (weeks.some((w) => w.includes("superstar"))) bad("cozy-farmer: the most downloaded mod was used as the lesser-known pick");
  if (new Set(weeks).size < 2) bad("cozy-farmer: the lesser-known picks never change from week to week");
  if ((await gemNames(NOW + 1000)) !== weeks[0]) bad("cozy-farmer: picks changed within the same week");
  // spotlight
  const spot = await spotlight(NOW);
  if (!spot || /Lib/.test(spot.name)) bad("spotlight: no mod, or a helper mod, was chosen");
  if ((await resolve("no-such-pack", NOW)) !== null) bad("an unknown playpack did not return nothing");

  console.log(problems.length ? problems.join("\n") : "RECIPES OK");
  process.exit(problems.length ? 1 : 0);
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
