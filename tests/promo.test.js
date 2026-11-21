// Checks HyMeta's advert kit (scripts/make-promo.js). Run: node tests/promo.test.js
// 1. Every advert, in every shape, is drawn and measured: words inside the picture, nothing cut off,
//    nothing too small, the site's own two fonts, Hex whole, nothing sitting on top of anything else.
// 2. An advert may only say what HyMeta itself wrote (the playpack list and scripts/promo/brand.js),
//    so a mod's name, logo or numbers cannot appear. Site screenshots must hold no mod row at all.
// 3. The saved kit in promo/out must be complete: a new playpack needs its adverts made.
// 4. Each check is shown to fail on a deliberately broken advert, so a quiet check is a real pass.
const fs = require("fs"), path = require("path"), os = require("os");
const { chromium } = require("playwright");
const promo = require("../scripts/make-promo"), brand = require("../scripts/promo/brand"), catalog = require("../lib/catalog"), weeks = require("../lib/weeks");
const problems = [], bad = (m) => problems.push(m);

(async () => {
  const browser = await chromium.launch(), list = promo.specs(), ids = catalog.base.concat(catalog.rota), shapes = Object.keys(brand.shapes);
  try {
    // ---- what an advert is allowed to say ----
    const allowed = new Set([brand.name, brand.site, brand.fine, brand.packEyebrow, "Hex says", "Picked by Hex", "·"]);
    brand.general.forEach((g) => [g.eyebrow, g.title, g.gold, g.say].forEach((t) => allowed.add(t)));
    Object.values(catalog.packs).forEach((p) => [p.name, p.blurb, p.hex].forEach((t) => allowed.add(t)));
    ((catalog.poll && catalog.poll.ideas) || []).forEach((d) => { allowed.add(d.name); allowed.add(d.line); });
    for (const t of allowed) {
      if (/—|–/.test(t)) bad("an advert line has a long dash in it: " + t);
      if (/curseforge|overwolf|hypixel|sample|pretend|download/i.test(t)) bad("an advert line names something it must not: " + t);
    }
    if (list.length !== (ids.length + brand.general.length) * shapes.length) bad("expected one advert for each playpack and each general advert in each shape, found " + list.length);
    for (const g of brand.general) if (!fs.existsSync(path.join(__dirname, "..", "promo", "hex", "hex-" + g.pose + ".png"))) bad("no picture of Hex called hex-" + g.pose + ".png");

    // ---- the site screenshots ----
    const shot = await promo.shots(browser);
    if (shot.mods) bad("a mod row is inside a site screenshot");
    if (shot.extras) bad("a site screenshot shows the private-preview notice, the welcome card or the preview switch");
    if (shot.calls) bad("taking the site screenshots asked CurseForge for something");
    if (shot.files.length !== 2 || shot.files.some((f) => !fs.existsSync(f) || fs.statSync(f).size < 20000)) bad("a site screenshot is missing or empty");

    // ---- every advert, drawn and measured (nothing is saved) ----
    for (let i = 0; i < list.length; i += 6) await Promise.all(list.slice(i, i + 6).map(async (s) => {
      const r = await promo.draw(browser, s, { save: false });
      r.problems.forEach((m) => bad(s.shape + "/" + s.id + ": " + m));
      r.texts.forEach((t) => { if (!allowed.has(t)) bad(s.shape + "/" + s.id + " says something HyMeta did not write: " + t); });
      if (!r.texts.includes(s.say) || !r.texts.includes(brand.site) || !r.texts.includes(brand.fine)) bad(s.shape + "/" + s.id + " is missing Hex's line, the site address or the fan site note");
      const w = promo.words(s); if (!w.post.includes(s.say) || !w.alt.includes(s.say) || /—/.test(w.post + w.alt)) bad(s.shape + "/" + s.id + ": the words to post are wrong");
    }));

    // ---- the saved kit ----
    const missing = list.filter((s) => !fs.existsSync(s.out) || fs.statSync(s.out).size < 30000);
    if (missing.length) bad(missing.length + " advert picture(s) are missing from promo/out, for example " + missing[0].shape + "/" + missing[0].id + ". Run: node scripts/make-promo.js");
    promo.leftovers().forEach((f) => bad("a leftover advert picture should be deleted (node scripts/make-promo.js does it): " + path.basename(f)));
    const page = path.join(__dirname, "..", "promo", "index.html"), html = fs.existsSync(page) ? fs.readFileSync(page, "utf8") : "";
    ids.forEach((id) => { if (!html.includes("out/wide/" + id + ".jpg")) bad("the kit page promo/index.html does not show " + id + ". Run: node scripts/make-promo.js"); });
    const kit = path.join(__dirname, "..", "promo", "kit-page.html"), link = fs.existsSync(kit) ? fs.readFileSync(kit, "utf8") : "";
    ids.forEach((id) => { if (!link.includes("out/wide/" + id + ".jpg")) bad("the page behind Ligia's link (promo/kit-page.html) does not show " + id + ". Run: node scripts/make-promo.js"); });
    if (/<!doctype|<html| download>/i.test(link) || !/^<title>HyMeta advert kit<\/title>/.test(link) || !/data-theme="dark"/.test(link) || !/Lumina Art House, LLC/.test(link)) bad("promo/kit-page.html is not in the form the private link needs");
    if (!/Lumina Art House, LLC/.test(html) || !/noindex/.test(html)) bad("the kit page is missing its copyright line or its keep-out-of-search mark");

    // ---- proof that the checks can fail: each broken advert below must be caught ----
    const base = list.find((s) => s.shape === "wide" && s.kind === "pack"), must = async (what, spec, re) => { const r = await promo.draw(browser, spec, { save: false }); if (!r.problems.some((m) => re.test(m))) bad("the checks did not notice " + what); };
    await must("a headline too long for its box", { ...base, noFit: true, title: "A very long playpack name that could never fit on one line of any advert at all" }, /cut off/);
    await must("Hex's line running past her bubble", { ...base, noFit: true, say: Array(14).join("This line goes on and on and on. ") }, /cut off|overlaps|run off/);
    await must("the wrong fonts", { ...base, brand: { ...brand, fonts: { ...brand.fonts, display: "No Such Font", css: "data:text/css," } } }, /fonts did not load/);
    await must("a missing picture of Hex", { ...base, hex: base.hex.replace("hex-", "nobody-") }, /missing|Hex is cut off/);
    const general = list.find((s) => s.shape === "square" && s.kind === "fan");
    await must("words sitting on top of the picture on show", { ...general, noFit: true, title: "A new playpack lands here every single Monday morning without fail", gold: "and then another one, and another one after that." }, /overlaps|cut off/);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "promo-proof-"));
    const leak = await promo.shots(browser, { crop: false, hash: "#pack-" + weeks.schedule().free, dir: tmp });
    if (!leak.mods) bad("the checks did not notice mod rows inside a screenshot of a playpack page");
    const safe = await promo.shots(browser, { hash: "#pack-" + weeks.schedule().free, dir: tmp });
    if (safe.mods) bad("cropping a playpack page did not keep its mod rows out of the picture");
    fs.rmSync(tmp, { recursive: true, force: true });
  } finally { await browser.close(); }
  if (problems.length) { console.log("PROMO PROBLEMS\n" + problems.join("\n")); process.exit(1); }
  console.log("promo kit: " + list.length + " adverts drawn and measured, screenshots hold no mods, and 7 broken versions were all caught");
})().catch((e) => { console.error(e); process.exit(1); });
