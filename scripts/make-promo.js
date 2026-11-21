// HyMeta's promo maker. One command draws the whole advert kit from the site's own look:
//   node scripts/make-promo.js                 every playpack and every general advert, in every shape
//   node scripts/make-promo.js cat-cafe hello  only these (playpack ids, or general advert ids from brand.js)
//   node scripts/make-promo.js --shapes wide   only this shape (wide, square, tall)
// Pictures land in promo/out/<shape>/<id>.jpg and promo/index.html shows them all on one page.
// Words come from lib/catalog.js (the playpack's name, its blurb and Hex's own line) and from
// scripts/promo/brand.js. Site screenshots are taken from the local copy of the site in its sample
// mode and cropped above the list of mods, so no mod name, logo or number can appear in an advert.
// Nothing is sent anywhere and nothing costs money. New Hex poses are made with scripts/make-hex.py.
const path = require("path"), fs = require("fs"), url = require("url");
const ROOT = path.join(__dirname, "..");
const brand = require("./promo/brand"), catalog = require("../lib/catalog"), weeks = require("../lib/weeks");
const OUT = path.join(ROOT, "promo", "out"), SHOTS = path.join(OUT, ".shots");
const fileUrl = (...parts) => url.pathToFileURL(path.join(ROOT, ...parts)).href;
const order = () => catalog.base.concat(catalog.rota);

// What each advert says and shows. Pure data: the tests read this too.
function specs({ ids = [], shapes = Object.keys(brand.shapes), now = Date.now() } = {}) {
  const all = order(), released = weeks.schedule(weeks.weekIndex(now)).released;
  const tile = (id) => ({ name: catalog.packs[id].name, art: fileUrl("web", "images", catalog.packs[id].art + ".jpg"), thumb: fileUrl("web", "images", "thumb-" + catalog.packs[id].art + ".jpg") });
  // newest first, so the adverts that show several playpacks always lead with the latest one
  const tiles = released.slice().reverse().map(tile);
  const list = [];
  const want = (id) => !ids.length || ids.includes(id);
  for (const shape of shapes) {
    const [w, h] = brand.shapes[shape], common = { shape, w, h, brand, icon: fileUrl(brand.icon) };
    all.forEach((id, i) => {
      const p = catalog.packs[id]; if (!want(id)) return;
      list.push({ ...common, id, kind: "pack", group: "playpacks", eyebrow: brand.packEyebrow, title: p.name, sub: p.blurb, say: p.hex, art: tile(id).art,
        hex: fileUrl("promo", "hex", "hex-" + brand.poses[i % brand.poses.length] + ".png"), out: path.join(OUT, shape, id + ".jpg") });
    });
    brand.general.forEach((g) => {
      if (!want(g.id)) return;
      list.push({ ...common, id: g.id, kind: g.kind, group: "general", eyebrow: g.eyebrow, title: g.title, gold: g.gold, say: g.say, tiles, ideas: (catalog.poll && catalog.poll.ideas) || [],
        shot: g.kind === "browser" ? url.pathToFileURL(path.join(SHOTS, "home-desktop.png")).href : g.kind === "phone" ? url.pathToFileURL(path.join(SHOTS, "home-phone.png")).href : undefined,
        hex: fileUrl("promo", "hex", "hex-" + g.pose + ".png"), out: path.join(OUT, shape, g.id + ".jpg") });
    });
  }
  return list;
}

// Screenshots of the real site, running on this computer in its sample mode, dark theme.
// Hidden for the picture: the private-preview notice, the welcome card, the Free and Member preview
// switch and pop-up messages. The crop stops above the list of mods. `mods` in the answer counts any
// mod row that still ended up inside a picture: it must be 0, and tests/promo.test.js checks that.
async function shots(browser, { crop = true, hash = "", dir = SHOTS } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const { start } = require("./dev-server");
  const keep = {}; ["HYMETA_WEEK", "SITE_PASSWORD", "CURSEFORGE_API_KEY", "SITE_OPEN", "HYMETA_LOCAL_DB"].forEach((k) => { keep[k] = process.env[k]; });
  const server = await start({ pretend: true, password: "promo-local-only", key: "", week: null });
  const result = { mods: 0, extras: 0, files: [], calls: 0 };
  try {
    for (const [name, w, h, scale] of [["home-desktop", 1120, 700, 2], ["home-phone", 390, 800, 3]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: "dark", deviceScaleFactor: scale, hasTouch: w < 500 });
      const p = await ctx.newPage();
      await p.goto(server.url); await p.fill("#pw", "promo-local-only"); await p.click('button[type="submit"]'); await p.waitForSelector("#view .page");
      if (hash) { await p.evaluate((x) => { location.hash = x; }, hash); await p.waitForSelector("#view h1"); }
      await p.addStyleTag({ content: ".notice,#welcome,.viewas,#toast{display:none!important} *{scroll-behavior:auto!important}" });
      await p.evaluate(() => { if (document.activeElement) document.activeElement.blur(); window.scrollTo(0, 0); return document.fonts.ready; }); await p.waitForTimeout(500);
      // stop the picture above the first mod row, if one would be inside it
      const firstMod = await p.evaluate(() => { const m = document.querySelector(".mod, .mrow, [data-mod], .tag-sample"); return m ? m.getBoundingClientRect().top : 1e9; });
      const hh = crop ? Math.min(h, Math.floor(firstMod - 8)) : h;
      result.mods += await p.evaluate((limit) => [...document.querySelectorAll(".mod, .mrow, [data-mod], .tag-sample")].filter((m) => { const r = m.getBoundingClientRect(); return r.height && r.top < limit; }).length, hh);
      result.extras += await p.evaluate((limit) => [...document.querySelectorAll(".notice, #welcome, .viewas, #toast")].filter((m) => { const r = m.getBoundingClientRect(); return r.height && r.top < limit; }).length, hh);
      const file = path.join(dir, name + ".png");
      await p.screenshot({ path: file, clip: { x: 0, y: 0, width: w, height: hh } }); result.files.push(file);
      await ctx.close();
    }
    result.calls = server.calls.length;
  } finally { server.close(); Object.keys(keep).forEach((k) => { if (keep[k] === undefined) delete process.env[k]; else process.env[k] = keep[k]; }); }
  return result;
}

// Draws one advert and reports what it found on the way: which fonts really drew the words, and any
// words that ran outside the picture, were cut off, or came out too small to read.
async function draw(browser, spec, { save = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: spec.w, height: spec.h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const missing = []; p.on("requestfailed", (r) => missing.push(r.url())); p.on("response", (r) => { if (r.status() >= 400) missing.push(r.url()); });
  await p.addInitScript((s) => { window.SPEC = s; }, spec);
  await p.goto(url.pathToFileURL(path.join(__dirname, "promo", "advert.html")).href);
  await p.evaluate(() => window.READY); await p.waitForTimeout(150);
  const report = await p.evaluate((B) => {
    const out = { problems: [], texts: [], fonts: [B.fonts.display, B.fonts.body].every((name) => [...document.fonts].some((f) => f.family.replace(/["']/g, "") === name && f.status === "loaded")) };
    // the headline must really be drawn in the display font: a fallback font gives the words a different width
    const probe = (family) => { const c = document.createElement("canvas").getContext("2d"); c.font = "900 80px " + family; return c.measureText("HyMeta playpacks").width; };
    if (out.fonts && probe('"' + B.fonts.display + '", monospace') === probe("monospace")) out.fonts = false;
    const W = innerWidth, H = innerHeight, minPx = W * 0.0125; // 20px on the wide picture, 13.5px on the others when seen at phone width
    const hex = document.querySelector(".hex").getBoundingClientRect();
    if (hex.left < -1 || hex.top < -1 || hex.right > W + 1 || hex.bottom > H + 1 || hex.width < W * 0.12) out.problems.push("Hex is cut off or too small");
    for (const e of document.querySelectorAll("body *")) {
      const own = [...e.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(" "); if (!own) continue;
      const cs = getComputedStyle(e), r = e.getBoundingClientRect(), label = own.slice(0, 30);
      if (cs.display === "none" || !r.width) continue;
      out.texts.push(own);
      if (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1) out.problems.push("words run off the picture: " + label);
      const box = e.closest(".fit, .card, .idea") || e;
      if (box.scrollHeight > box.clientHeight + 2 || (box.scrollWidth > box.clientWidth + 2 && cs.textOverflow !== "ellipsis")) out.problems.push("words are cut off: " + label);
      if (parseFloat(cs.fontSize) < minPx) out.problems.push("words too small (" + Math.round(parseFloat(cs.fontSize)) + "px): " + label);
    }
    // the headline, Hex's bubble and the footer must not sit on top of each other
    const boxes = [".copy", ".say", ".foot"].map((s) => [s, document.querySelector(s).getBoundingClientRect()]);
    for (const k of document.querySelectorAll(".stage > *, .stage .card, .stage .idea")) { const r = k.getBoundingClientRect(); if (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1) out.problems.push("the picture on show runs off the edge"); boxes.push(["the picture on show", r]); }
    boxes.push(["Hex", { left: hex.left + hex.width * 0.2, right: hex.right - hex.width * 0.2, top: hex.top + hex.height * 0.12, bottom: hex.bottom }]);
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const a = boxes[i][1], b = boxes[j][1]; if (boxes[i][0] !== boxes[j][0] && a.left < b.right - 2 && b.left < a.right - 2 && a.top < b.bottom - 2 && b.top < a.bottom - 2 && !out.problems.includes(boxes[i][0] + " overlaps " + boxes[j][0])) out.problems.push(boxes[i][0] + " overlaps " + boxes[j][0]); }
    return out;
  }, brand);
  if (!report.fonts) report.problems.push("the " + brand.fonts.display + " and " + brand.fonts.body + " fonts did not load");
  missing.forEach((m) => report.problems.push("a picture or font is missing: " + m.split("/").pop()));
  if (save) { fs.mkdirSync(path.dirname(spec.out), { recursive: true }); await p.screenshot({ path: spec.out, type: "jpeg", quality: 86 }); }
  await ctx.close();
  return report;
}

// Words to post beside an advert, and words that describe the picture for people who cannot see it.
function words(s) {
  const head = s.kind === "pack" ? s.title + ". " + s.sub : s.title + " " + s.gold;
  return { post: head + "\n\nHex says: \u201c" + s.say + "\u201d\n\n" + brand.site, alt: brand.name + " advert. " + head + " Hex, a small green troll with bright pink hair, says: " + s.say };
}
// Pictures left behind by a playpack or advert that no longer exists.
function leftovers() {
  const keep = new Set(specs().map((s) => s.out)), found = [];
  for (const shape of Object.keys(brand.shapes)) { const dir = path.join(OUT, shape); if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) if (f.endsWith(".jpg") && !keep.has(path.join(dir, f))) found.push(path.join(dir, f)); }
  return found;
}

// The page that shows the whole kit. Plain page, light and dark with the device, no outside files.
function sheet(list) {
  const rel = (f) => path.relative(path.join(ROOT, "promo"), f).split(path.sep).join("/"), esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const all = order(), day = (i) => new Date(weeks.LAUNCH + i * weeks.WEEK_MS).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  const when = (id) => { const i = catalog.rota.indexOf(id); return i < 0 ? "Out from the start" : (weeks.LAUNCH + i * weeks.WEEK_MS <= Date.now() ? "Out since " : "Not out until Monday, ") + day(i); };
  const ids = [...new Set(list.map((s) => s.id))], shapes = [...new Set(list.map((s) => s.shape))];
  const block = (id) => { const mine = list.filter((s) => s.id === id), s = mine[0], name = s.kind === "pack" ? s.title : s.title + " " + s.gold;
    return `<details${id === brand.general[0].id ? " open" : ""}><summary><b>${esc(name)}</b> <span>${esc(s.kind === "pack" ? when(id) : "General advert")}</span></summary><div class="row">` +
            mine.map((m) => `<figure><a href="${rel(m.out)}" download><img loading="lazy" src="${rel(m.out)}" width="${m.w}" height="${m.h}" alt="${esc(m.shape + " advert: " + name + ". Hex says: " + m.say)}"></a><figcaption>${m.shape}, ${m.w} by ${m.h}. Tap the picture to save it.</figcaption></figure>`).join("") + "</div>" + (() => { const t = words(s); return `<details class="w"><summary>Words to post with it</summary><div class="say"><p><b>Words to post with it</b><br><span class="copyme">${esc(t.post).replace(/\n/g, "<br>")}</span></p><p><b>Picture description (alt text)</b><br><span class="copyme">${esc(t.alt)}</span></p></div></details>`; })() + "</details>"; };
  const group = (g, title, note) => { const mine = ids.filter((id) => list.find((s) => s.id === id).group === g); return mine.length ? `<h2>${title}</h2><p>${note}</p>` + mine.map(block).join("") : ""; };
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>HyMeta advert kit</title>
<style>:root{--bg:#d9e3ef;--card:#fff;--fg:#121930;--muted:#3a4461;--line:#74869f;--focus:#0b5cad}@media(prefers-color-scheme:dark){:root{--bg:#0e1223;--card:#1a2143;--fg:#eef1fb;--muted:#b9c1de;--line:#6672b8;--focus:#4fe3d4}}
body{margin:0;padding:16px;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif;max-width:1200px;margin:auto}h1{font-size:1.6rem}h2{font-size:1.25rem;margin:28px 0 4px}p{margin:4px 0 12px;color:var(--muted)}
details{background:var(--card);border:1px solid var(--line);border-radius:12px;margin:8px 0}details.w{margin:0 14px 14px;background:transparent}details.w .say{padding:0 14px 14px}summary{min-height:44px;padding:10px 14px;cursor:pointer;display:flex;gap:10px;align-items:center;flex-wrap:wrap}summary span{color:var(--muted);font-size:.875rem}
summary:focus-visible,a:focus-visible{outline:3px solid var(--focus);outline-offset:2px}.row{display:flex;gap:12px;flex-wrap:wrap;padding:0 14px 14px;align-items:flex-start}figure{margin:0;flex:1 1 260px;max-width:520px}img{width:100%;height:auto;border-radius:8px;display:block}figcaption{font-size:.875rem;color:var(--muted);margin-top:4px}footer{margin:32px 0 8px;font-size:.875rem;color:var(--muted)}
.say{display:flex;gap:12px;flex-wrap:wrap}.say p{flex:1 1 280px;margin:0;color:var(--fg);font-size:.9375rem}.say button{display:block;margin-top:6px;min-height:44px;padding:0 14px;border-radius:10px;border:1px solid var(--line);background:transparent;color:var(--fg);font:inherit;font-weight:700;cursor:pointer}.say button:focus-visible{outline:3px solid var(--focus);outline-offset:2px}</style>
<h1>HyMeta advert kit</h1><p>${ids.length} adverts in ${shapes.length} shape${shapes.length === 1 ? "" : "s"} (${shapes.join(", ")}). Wide is for Discord, Reddit and X. Square and tall are for Instagram and Pinterest. Tap a name to see its pictures. No mod names, logos or numbers appear in any of them.</p>
${group("general", "General adverts", "About HyMeta as a whole. Good for a launch post or a profile banner.")}${group("playpacks", "One for each playpack", "Newest last. Post a playpack's advert in the week it comes out.")}
<p role="status" aria-live="polite" id="said" style="position:absolute;left:-9999px"></p>
<script>document.querySelectorAll(".copyme").forEach(function(s){var b=document.createElement("button");b.type="button";b.textContent="Copy these words";b.onclick=function(){var t=s.innerText;(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(function(){b.textContent="Copied";document.getElementById("said").textContent="Copied";setTimeout(function(){b.textContent="Copy these words";},1600);},function(){var r=document.createRange();r.selectNodeContents(s);var g=getSelection();g.removeAllRanges();g.addRange(r);b.textContent="Selected. Now press copy";});};s.parentNode.appendChild(b);});</script>
<footer>© ${new Date().getUTCFullYear()} Lumina Art House, LLC. HyMeta is an unofficial fan site. It is not affiliated with Hytale, Hypixel Studios, CurseForge or Overwolf.</footer></html>\n`;
  fs.writeFileSync(path.join(ROOT, "promo", "index.html"), html);
}

async function main(args) {
  const si = args.indexOf("--shapes"), shapes = si > -1 ? args.splice(si, 2)[1].split(",") : Object.keys(brand.shapes);
  const bad = shapes.filter((s) => !brand.shapes[s]); if (bad.length) throw new Error("no shape called " + bad.join(", ") + ". Choose from " + Object.keys(brand.shapes).join(", "));
  const known = order().concat(brand.general.map((g) => g.id)), lost = args.filter((a) => !known.includes(a));
  if (lost.length) throw new Error("nothing called " + lost.join(", ") + ". Use a playpack id (for example cat-cafe) or one of: " + brand.general.map((g) => g.id).join(", "));
  const { chromium } = require("playwright"), browser = await chromium.launch(), started = Date.now();
  try {
    const list = specs({ ids: args, shapes });
    if (list.some((s) => s.shot)) { const s = await shots(browser); if (s.mods || s.calls) throw new Error("a mod row ended up inside a site screenshot, or the site asked CurseForge for something. Nothing was saved."); }
    let wrong = 0;
    for (let i = 0; i < list.length; i += 6) await Promise.all(list.slice(i, i + 6).map(async (s) => { const r = await draw(browser, s); if (r.problems.length) { wrong++; console.log("PROBLEM " + s.shape + "/" + s.id + ": " + r.problems.join("; ")); } }));
    if (!args.length && shapes.length === Object.keys(brand.shapes).length) leftovers().forEach((f) => { fs.unlinkSync(f); console.log("removed a leftover picture: " + path.relative(ROOT, f)); });
    sheet(specs({ shapes: Object.keys(brand.shapes).filter((sh) => fs.existsSync(path.join(OUT, sh))) }).filter((s) => fs.existsSync(s.out)));
    console.log(`${list.length} adverts drawn in ${Math.round((Date.now() - started) / 1000)} seconds, ${wrong} with problems. See promo/index.html`);
    if (wrong) process.exitCode = 1;
  } finally { await browser.close(); }
}
module.exports = { specs, shots, draw, sheet, words, leftovers, OUT };
if (require.main === module) main(process.argv.slice(2)).catch((e) => { console.error(String(e.message || e)); process.exit(1); });
