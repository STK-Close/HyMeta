// Checks HyMeta's advert kit. Run: node tests/promo.test.js
// The shared promo maker (promo/tool) draws and measures every advert in every shape, checks the site
// screenshots hold no mod rows, checks the saved kit is complete, and proves its own checks by drawing
// deliberately broken adverts that must be caught. On top of that, HyMeta's own rule is checked here:
// an advert may only say what HyMeta itself wrote, in the playpack list and in promo/promo.config.js.
const { chromium } = require("playwright");
const kit = require("../scripts/make-promo"), catalog = require("../lib/catalog"), config = kit.config, brand = kit.brand;

(async () => {
  const browser = await chromium.launch(); let result;
  try { result = await kit.check(browser); } finally { await browser.close(); }
  const problems = result.problems, bad = (m) => problems.push(m), list = kit.specs(), ids = catalog.base.concat(catalog.rota);
  const allowed = new Set([brand.name, brand.site, brand.fine, brand.pill, brand.mascot.label, "A playpack for Hytale"]);
  config.GENERAL.forEach((g) => [g.eyebrow, g.title, g.gold, g.say].forEach((t) => allowed.add(t)));
  Object.values(catalog.packs).forEach((p) => [p.name, p.blurb, p.hex].forEach((t) => allowed.add(t)));
  ((catalog.poll && catalog.poll.ideas) || []).forEach((d) => { allowed.add(d.name); allowed.add(d.line); });
  for (const s of list) for (const t of [s.eyebrow, s.title, s.gold, s.sub, s.say, s.label].concat(s.tiles.map((x) => x.name), ...s.ideas.map((d) => [d.name, d.line])))
    if (t && !allowed.has(t)) bad(s.shape + "/" + s.id + " says something HyMeta did not write: " + t);
  if (list.length !== (ids.length + config.GENERAL.length) * Object.keys(brand.shapes).length) bad("expected one advert for each playpack and each general advert in each shape, found " + list.length);
  for (const id of ids) { const p = catalog.packs[id], s = list.find((x) => x.id === id); if (!s || s.title !== p.name || s.sub !== p.blurb || s.say !== p.hex || !s.hex) bad(id + " does not have an advert with its own name, blurb, Hex's line and Hex"); }
  // the list of things hidden for a screenshot, and of things that must never be in one, is HyMeta's own promise
  for (const sel of [".notice", "#welcome", ".viewas", "#toast"]) if (!config.shots.hide.split(",").map((x) => x.trim()).includes(sel)) bad("site screenshots no longer hide " + sel);
  for (const sel of [".mod", ".tag-sample"]) if (!config.shots.never.split(",").map((x) => x.trim()).includes(sel)) bad("site screenshots no longer keep " + sel + " out of the picture");
  if (!/unofficial fan site/i.test(brand.fine)) bad("the adverts no longer say HyMeta is an unofficial fan site");
  const page = require("fs").readFileSync(require("path").join(kit.PROMO, "kit-page.html"), "utf8");
  if (!/Lumina Art House, LLC/.test(page)) bad("the kit page is missing its copyright line");
  if (result.proofs < 7) bad("only " + result.proofs + " of the 7 broken-advert proofs ran");
  if (problems.length) { console.log("PROMO PROBLEMS\n" + problems.join("\n")); process.exit(1); }
  console.log("promo kit: " + result.adverts + " adverts drawn and measured, screenshots hold no mods, and " + result.proofs + " broken versions were all caught");
})().catch((e) => { console.error(e); process.exit(1); });
