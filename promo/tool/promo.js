// Promo maker. One command draws an app's whole advert kit from the app's own look.
// It lives in an app at promo/tool/ (put there by promo-maker's install.js) and reads promo/promo.config.js.
//   node promo/tool/promo.js                 every advert, in every shape
//   node promo/tool/promo.js hello pricing   only these adverts (ids from the settings file)
//   node promo/tool/promo.js --shapes wide   only this shape
//   node promo/tool/promo.js --check         draw and measure everything, save nothing, and prove the checks can fail
//   node promo/tool/promo.js --files         list the pictures the kit page shows (for publishing the page)
//   add --config <path to promo.config.js> to work on an app from somewhere else
// Pictures land in promo/out/<shape>/<id>.jpg. promo/index.html shows them all with words to post, and
// promo/kit-page.html is the same page in the form a private claude.ai page needs.
// Nothing is sent anywhere and nothing costs money. Do not edit this copy: change promo-maker and reinstall.
const path = require("path"), fs = require("fs"), url = require("url"), os = require("os");

const DEFAULT_SHAPES = { wide: [1600, 900], square: [1080, 1080], tall: [1080, 1350] };
const KIT_LIGHT = { bg: "#e9edf3", card: "#ffffff", fg: "#141a2a", muted: "#434c63", line: "#77839b", focus: "#0b5cad" };
const KIT_DARK = { bg: "#10141f", card: "#1b2233", fg: "#eef1f8", muted: "#b8c0d4", line: "#66739a", focus: "#5fd8e6" };

function load(configPath) {
  const PROMO = path.dirname(path.resolve(configPath)), config = require(path.resolve(configPath));
  const ROOT = path.resolve(PROMO, config.root || ".."), brand = config.brand, OUT = path.join(PROMO, "out"), SHOTS = path.join(OUT, ".shots");
  brand.shapes = brand.shapes || DEFAULT_SHAPES;
  const mascot = brand.mascot || null, kitInfo = brand.kit || {};
  const fileUrl = (p) => (p ? url.pathToFileURL(path.resolve(ROOT, p)).href : undefined);
  const tileUrl = (t) => ({ name: t.name, art: fileUrl(t.art), thumb: fileUrl(t.thumb || t.art) });

  // What each advert says and shows, once for each shape. Pure data: the checks read this too.
  function specs({ ids = [], shapes = Object.keys(brand.shapes), now = Date.now() } = {}) {
    const adverts = config.adverts({ now }), list = [];
    for (const shape of shapes) {
      const [w, h] = brand.shapes[shape];
      for (const a of adverts) {
        if (ids.length && !ids.includes(a.id)) continue;
        list.push({ shape, w, h, brand, icon: fileUrl(brand.icon), id: a.id, kind: a.kind || (a.art ? "feature" : "mosaic"), group: a.group || "general", note: a.note || "",
          eyebrow: a.eyebrow || "", title: a.title, gold: a.gold || "", sub: a.sub || "", say: a.say || "", art: fileUrl(a.art), tiles: (a.tiles || []).map(tileUrl), ideas: a.ideas || [],
          shot: a.shot ? url.pathToFileURL(path.join(SHOTS, a.shot + ".png")).href : undefined,
          hex: mascot && a.pose ? fileUrl(path.join(mascot.dir, (mascot.prefix || "") + a.pose + ".png")) : undefined, label: mascot ? mascot.label || mascot.name + " says" : "",
          out: path.join(OUT, shape, a.id + ".jpg") });
      }
    }
    return list;
  }

  // Screenshots of the app itself, running on this computer. The settings file says how to start it, which
  // pages to capture, what to hide for the picture and what must never be inside one (`never`): the crop
  // stops above the first of those, and any that still ends up inside a picture is counted.
  async function shots(browser, { crop = true, leak = false, dir = SHOTS } = {}) {
    const S = config.shots, result = { never: 0, hidden: 0, files: [], calls: 0 };
    if (!S) return result;
    fs.mkdirSync(dir, { recursive: true });
    const server = await S.start();
    try {
      for (const pg of S.pages) {
        const ctx = await browser.newContext({ viewport: { width: pg.w, height: pg.h }, colorScheme: S.scheme || "dark", deviceScaleFactor: pg.scale || 2, hasTouch: pg.w < 500 });
        const p = await ctx.newPage();
        if (S.enter) await S.enter(p, server.url); else await p.goto(server.url);
        if (leak && S.leak) await S.leak(p); else if (pg.go) await pg.go(p);
        await p.addStyleTag({ content: (S.hide ? S.hide + "{display:none!important} " : "") + "*{scroll-behavior:auto!important}" });
        await p.evaluate(() => { if (document.activeElement) document.activeElement.blur(); window.scrollTo(0, 0); return document.fonts.ready; }); await p.waitForTimeout(500);
        const count = (sel, limit) => (sel ? p.evaluate(([s, l]) => [...document.querySelectorAll(s)].filter((m) => { const r = m.getBoundingClientRect(); return r.height && r.top < l; }).length, [sel, limit]) : 0);
        const first = S.never ? await p.evaluate((s) => { const m = [...document.querySelectorAll(s)].filter((x) => x.getBoundingClientRect().height)[0]; return m ? m.getBoundingClientRect().top : 1e9; }, S.never) : 1e9;
        const hh = crop ? Math.max(40, Math.min(pg.h, Math.floor(first - 8))) : pg.h;
        result.never += await count(S.never, hh); result.hidden += await count(S.hide, hh);
        const file = path.join(dir, pg.name + ".png");
        await p.screenshot({ path: file, clip: { x: 0, y: 0, width: pg.w, height: hh } }); result.files.push(file);
        await ctx.close();
      }
      result.calls = (server.calls && server.calls.length) || 0;
    } finally { await server.close(); }
    return result;
  }

  // Draws one advert and reports what it found on the way: which fonts really drew the words, and any
  // words that ran outside the picture, were cut off, came out too small to read, or sat on something else.
  async function draw(browser, spec, { save = true } = {}) {
    const ctx = await browser.newContext({ viewport: { width: spec.w, height: spec.h }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    const missing = []; p.on("requestfailed", (r) => missing.push(r.url())); p.on("response", (r) => { if (r.status() >= 400) missing.push(r.url()); });
    await p.addInitScript((s) => { window.SPEC = s; }, spec);
    await p.goto(url.pathToFileURL(path.join(__dirname, "advert.html")).href);
    await p.evaluate(() => window.READY); await p.waitForTimeout(150);
    const B = spec.brand, who = (B.mascot && B.mascot.name) || "the mascot";
    const report = await p.evaluate(([B, who]) => {
      const out = { problems: [], texts: [], fonts: [B.fonts.display, B.fonts.body].every((name) => [...document.fonts].some((f) => f.family.replace(/["']/g, "") === name && f.status === "loaded")) };
      // the headline must really be drawn in the display font: a fallback font gives the words a different width
      const probe = (family) => { const c = document.createElement("canvas").getContext("2d"); c.font = "900 80px " + family; return c.measureText(B.name + " adverts, measured").width; };
      if (out.fonts && probe('"' + B.fonts.display + '", monospace') === probe("monospace")) out.fonts = false;
      const W = innerWidth, H = innerHeight, minPx = W * 0.0125; // 20px on the wide picture, 13.5px on the others when seen at phone width
      const hexEl = document.querySelector(".hex"), hex = hexEl && hexEl.getBoundingClientRect();
      if (hex && (hex.left < -1 || hex.top < -1 || hex.right > W + 1 || hex.bottom > H + 1 || hex.width < W * 0.12)) out.problems.push(who + " is cut off or too small");
      for (const e of document.querySelectorAll("body *")) {
        const own = [...e.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(" "); if (!own) continue;
        const cs = getComputedStyle(e), r = e.getBoundingClientRect(), label = own.slice(0, 30);
        if (cs.display === "none" || !r.width) continue;
        out.texts.push(own);
        if (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1) out.problems.push("words run off the picture: " + label);
        // measured by the height the lines need, not by the ink of the letters, so a typeface with tall letters is not mistaken for overflow
        const fit = e.closest(".fit"), box = e.closest(".card, .idea");
        if (fit) { const allowed = parseFloat(getComputedStyle(fit).maxHeight) || 1e9, old = fit.style.maxHeight; fit.style.maxHeight = "none"; const need = fit.getBoundingClientRect().height; fit.style.maxHeight = old; if (need > allowed + 2 || fit.scrollWidth > fit.clientWidth + 2) out.problems.push("words are cut off: " + label); }
        if (box) { const b = box.getBoundingClientRect(), rot = getComputedStyle(box).transform !== "none"; if (!rot && (r.bottom > b.bottom + 2 || r.right > b.right + 2)) out.problems.push("words are cut off: " + label); if (box.scrollHeight > box.clientHeight + 6) out.problems.push("words are cut off: " + label); }
        if (parseFloat(cs.fontSize) < minPx) out.problems.push("words too small (" + Math.round(parseFloat(cs.fontSize)) + "px): " + label);
      }
      // the headline, the speech bubble, the footer, the thing on show and the mascot must not sit on top of each other
      const boxes = [".copy", ".say", ".foot"].filter((s) => document.querySelector(s)).map((s) => [s, document.querySelector(s).getBoundingClientRect()]);
      for (const k of document.querySelectorAll(".stage > *, .stage .card, .stage .idea")) { const r = k.getBoundingClientRect(); if (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1) out.problems.push("the picture on show runs off the edge"); boxes.push(["the picture on show", r]); }
      if (hex) boxes.push([who, { left: hex.left + hex.width * 0.2, right: hex.right - hex.width * 0.2, top: hex.top + hex.height * 0.12, bottom: hex.bottom }]);
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const a = boxes[i][1], b = boxes[j][1]; if (boxes[i][0] !== boxes[j][0] && a.left < b.right - 2 && b.left < a.right - 2 && a.top < b.bottom - 2 && b.top < a.bottom - 2 && !out.problems.includes(boxes[i][0] + " overlaps " + boxes[j][0])) out.problems.push(boxes[i][0] + " overlaps " + boxes[j][0]); }
      return out;
    }, [B, who]);
    if (!report.fonts) report.problems.push("the " + B.fonts.display + " and " + B.fonts.body + " fonts did not load");
    missing.forEach((m) => report.problems.push("a picture or font is missing: " + m.split("/").pop()));
    if (save) { fs.mkdirSync(path.dirname(spec.out), { recursive: true }); await p.screenshot({ path: spec.out, type: "jpeg", quality: 86 }); }
    await ctx.close();
    return report;
  }

  // Words to post beside an advert, and words that describe the picture for people who cannot see it.
  function words(s) {
    const head = s.gold ? s.title + " " + s.gold + (s.sub ? " " + s.sub : "") : s.title + (s.sub ? ". " + s.sub : "");
    const said = s.say && mascot ? "\n\n" + mascot.name + " says: “" + s.say + "”" : s.say ? "\n\n" + s.say : "";
    const seen = s.say && mascot ? " " + (mascot.describe || mascot.name) + ", says: " + s.say : s.say ? " " + s.say : "";
    return { post: head + said + "\n\n" + brand.site, alt: brand.name + " advert. " + head + seen };
  }
  // Pictures left behind by an advert that no longer exists.
  function leftovers() {
    const keep = new Set(specs().map((s) => s.out)), found = [];
    for (const shape of Object.keys(brand.shapes)) { const dir = path.join(OUT, shape); if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) if (f.endsWith(".jpg") && !keep.has(path.join(dir, f))) found.push(path.join(dir, f)); }
    return found;
  }
  const kitTitle = () => kitInfo.title || brand.name + " advert kit";

  // The page that shows the whole kit. Plain page, light and dark with the device, no outside files.
  function sheet(list) {
    const rel = (f) => path.relative(PROMO, f).split(path.sep).join("/"), esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const ids = [...new Set(list.map((s) => s.id))], shapes = [...new Set(list.map((s) => s.shape))];
    const groups = kitInfo.groups || [...new Set(list.map((s) => s.group))].map((id) => ({ id, title: id === "general" ? "General adverts" : id, note: "" }));
    const first = (ids.filter((id) => list.find((s) => s.id === id).group === groups[0].id)[0]) || ids[0];
    const tokens = (t) => Object.keys(t).map((k) => "--" + k + ":" + t[k]).join(";"), light = { ...KIT_LIGHT, ...(kitInfo.light || {}) }, dark = { ...KIT_DARK, ...(kitInfo.dark || {}) };
    const block = (id) => { const mine = list.filter((s) => s.id === id), s = mine[0], name = s.title + (s.gold ? " " + s.gold : ""), t = words(s);
      return `<details${id === first ? " open" : ""}><summary><b>${esc(name)}</b> <span>${esc(s.note)}</span></summary><div class="row">` +
        mine.map((m) => `<figure><a href="${rel(m.out)}" download><img loading="lazy" src="${rel(m.out)}" width="${m.w}" height="${m.h}" alt="${esc(m.shape + " advert. " + t.alt)}"></a><figcaption>${m.shape}, ${m.w} by ${m.h}. Tap the picture to save it.</figcaption></figure>`).join("") + "</div>" +
        `<details class="w"><summary>Words to post with it</summary><div class="say"><p><b>Words to post with it</b><br><span class="copyme">${esc(t.post).replace(/\n/g, "<br>")}</span></p><p><b>Picture description (alt text)</b><br><span class="copyme">${esc(t.alt)}</span></p></div></details></details>`; };
    const group = (g) => { const mine = ids.filter((id) => list.find((s) => s.id === id).group === g.id); return mine.length ? `<h2>${esc(g.title)}</h2>${g.note ? "<p>" + esc(g.note) + "</p>" : ""}` + mine.map(block).join("") : ""; };
    const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(kitTitle())}</title>
<style>:root{${tokens(light)}}@media(prefers-color-scheme:dark){:root{${tokens(dark)}}}
body{margin:0;padding:16px;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif;max-width:1200px;margin:auto}h1{font-size:1.6rem}h2{font-size:1.25rem;margin:28px 0 4px}p{margin:4px 0 12px;color:var(--muted)}
details{background:var(--card);border:1px solid var(--line);border-radius:12px;margin:8px 0}details.w{margin:0 14px 14px;background:transparent}details.w .say{padding:0 14px 14px}summary{min-height:44px;padding:10px 14px;cursor:pointer;display:flex;gap:10px;align-items:center;flex-wrap:wrap}summary span{color:var(--muted);font-size:.875rem}
summary:focus-visible,a:focus-visible{outline:3px solid var(--focus);outline-offset:2px}.row{display:flex;gap:12px;flex-wrap:wrap;padding:0 14px 14px;align-items:flex-start}figure{margin:0;flex:1 1 260px;max-width:520px}img{width:100%;height:auto;border-radius:8px;display:block}figcaption{font-size:.875rem;color:var(--muted);margin-top:4px}footer{margin:32px 0 8px;font-size:.875rem;color:var(--muted)}
.say{display:flex;gap:12px;flex-wrap:wrap}.say p{flex:1 1 280px;margin:0;color:var(--fg);font-size:.9375rem}.say button{display:block;margin-top:6px;min-height:44px;padding:0 14px;border-radius:10px;border:1px solid var(--line);background:transparent;color:var(--fg);font:inherit;font-weight:700;cursor:pointer}.say button:focus-visible{outline:3px solid var(--focus);outline-offset:2px}</style>
<h1>${esc(kitTitle())}</h1><p>${ids.length} adverts in ${shapes.length} shape${shapes.length === 1 ? "" : "s"} (${shapes.join(", ")}). ${esc(kitInfo.shapesNote || "Wide is for Discord, Reddit and X. Square and tall are for Instagram and Pinterest.")} Tap a name to see its pictures.${kitInfo.intro ? " " + esc(kitInfo.intro) : ""}</p>
${groups.map(group).join("")}
<p role="status" aria-live="polite" id="said" style="position:absolute;left:-9999px"></p>
<script>document.querySelectorAll(".copyme").forEach(function(s){var b=document.createElement("button");b.type="button";b.textContent="Copy these words";b.onclick=function(){var t=s.innerText;(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(function(){b.textContent="Copied";document.getElementById("said").textContent="Copied";setTimeout(function(){b.textContent="Copy these words";},1600);},function(){var r=document.createRange();r.selectNodeContents(s);var g=getSelection();g.removeAllRanges();g.addRange(r);b.textContent="Selected. Now press copy";});};s.parentNode.appendChild(b);});</script>
<footer>${esc(kitInfo.legal || "© " + new Date().getUTCFullYear() + " Lumina Art House, LLC.")}</footer></html>\n`;
    fs.writeFileSync(path.join(PROMO, "index.html"), html);
    fs.writeFileSync(path.join(PROMO, "kit-page.html"), linkPage(html, light, dark, tokens));
  }

  // The same page in the form a private claude.ai page needs: no page wrapper, colors that follow the
  // viewer's theme switch, the app's two fonts, and no save-on-tap links, which do nothing on that kind of page.
  function linkPage(html, light, dark, tokens) {
    let css = html.slice(html.indexOf("<style>") + 7, html.indexOf("</style>"));
    css = css.slice(css.indexOf("body{")).replace(/^body\{[^}]*\}/, 'body{margin:0 auto;padding-block:16px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));background:var(--bg);color:var(--fg);font:16px/1.5 "' + brand.fonts.body + '",system-ui,sans-serif;max-width:1200px}h1,h2,summary b{font-family:"' + brand.fonts.display + '","Trebuchet MS",system-ui,sans-serif}');
    const body = html.slice(html.indexOf("<h1>")).replace("</html>", "").replace(/<a href="[^"]*" download>(<img[^>]*>)<\/a>/g, "$1").replace(/Tap the picture to save it\./g, "Press and hold the picture to save it (right-click on a computer).");
    return `<title>${kitTitle()}</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<link rel="stylesheet" href="${brand.fonts.css}">\n<style>\n/* Layout: one column of short rows that open on a tap, in the app's own colors and typefaces. */\n:root{${tokens(light)}}\n@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${tokens(dark)};color-scheme:dark}}\n:root[data-theme="dark"]{${tokens(dark)};color-scheme:dark}\n${css}</style>\n${body}`;
  }
  const files = () => specs().filter((s) => fs.existsSync(s.out)).map((s) => ({ path: path.relative(PROMO, s.out).split(path.sep).join("/") }));

  // Draws and measures every advert without saving, checks the saved kit is complete, and proves the
  // checks themselves by drawing deliberately broken adverts that must be caught. Returns the problems found.
  async function check(browser) {
    const problems = [], bad = (m) => problems.push(m), list = specs(), adverts = config.adverts({ now: Date.now() });
    const banned = config.banned || null, fixed = new Set([brand.name, brand.site, brand.fine, brand.pill, mascot && (mascot.label || mascot.name + " says"), "·"].filter(Boolean));
    if (new Set(adverts.map((a) => a.id)).size !== adverts.length) bad("two adverts share the same id");
    if (list.length !== adverts.length * Object.keys(brand.shapes).length) bad("expected every advert in every shape, found " + list.length);
    for (const a of adverts) {
      if (mascot && a.pose && !fs.existsSync(path.resolve(ROOT, mascot.dir, (mascot.prefix || "") + a.pose + ".png"))) bad("no picture of " + mascot.name + " for the pose " + a.pose);
      for (const t of [a.eyebrow, a.title, a.gold, a.sub, a.say]) { if (!t) continue; if (/—|–/.test(t)) bad("an advert line has a long dash in it: " + t); if (banned && banned.test(t)) bad("an advert line names something it must not: " + t); }
    }
    let proofs = 0;
    if (config.shots && list.some((s) => s.shot)) {
      const shot = await shots(browser);
      if (shot.never) bad("something that must never be in an advert is inside a screenshot of the app");
      if (shot.hidden) bad("a screenshot of the app shows something that was meant to be hidden for the picture");
      if (shot.calls) bad("taking the screenshots made the app call an outside service");
      if (shot.files.length !== config.shots.pages.length || shot.files.some((f) => !fs.existsSync(f) || fs.statSync(f).size < 20000)) bad("a screenshot of the app is missing or empty");
    }
    for (let i = 0; i < list.length; i += 6) await Promise.all(list.slice(i, i + 6).map(async (s) => {
      const r = await draw(browser, s, { save: false }), own = new Set([s.eyebrow, s.title, s.gold, s.sub, s.say].concat(s.tiles.map((t) => t.name), ...s.ideas.map((d) => [d.name, d.line])).filter(Boolean));
      r.problems.forEach((m) => bad(s.shape + "/" + s.id + ": " + m));
      r.texts.forEach((t) => { if (!fixed.has(t) && !own.has(t)) bad(s.shape + "/" + s.id + " says something the settings file did not give it: " + t); });
      if ((s.say && s.hex && !r.texts.includes(s.say)) || !r.texts.includes(brand.site) || (brand.fine && !r.texts.includes(brand.fine))) bad(s.shape + "/" + s.id + " is missing its spoken line, the site address or the small print");
      const w = words(s); if (!w.post.includes(brand.site) || /—/.test(w.post + w.alt)) bad(s.shape + "/" + s.id + ": the words to post are wrong");
    }));
    // the saved kit
    const missing = list.filter((s) => !fs.existsSync(s.out) || fs.statSync(s.out).size < 30000);
    if (missing.length) bad(missing.length + " advert picture(s) are missing from promo/out, for example " + missing[0].shape + "/" + missing[0].id + ". Draw the kit again.");
    leftovers().forEach((f) => bad("a leftover advert picture should be deleted (drawing the whole kit does it): " + path.basename(f)));
    for (const [file, name] of [["index.html", "the kit page"], ["kit-page.html", "the page behind the private link"]]) {
      const html = fs.existsSync(path.join(PROMO, file)) ? fs.readFileSync(path.join(PROMO, file), "utf8") : "";
      adverts.forEach((a) => { if (!html.includes("out/" + Object.keys(brand.shapes)[0] + "/" + a.id + ".jpg")) bad(name + " (promo/" + file + ") does not show " + a.id + ". Draw the kit again."); });
    }
    const link = fs.existsSync(path.join(PROMO, "kit-page.html")) ? fs.readFileSync(path.join(PROMO, "kit-page.html"), "utf8") : "";
    if (/<!doctype|<html| download>/i.test(link) || !link.startsWith("<title>" + kitTitle() + "</title>") || !/data-theme="dark"/.test(link)) bad("promo/kit-page.html is not in the form the private link needs");
    // proof that the checks can fail: each broken advert below must be caught
    const must = async (what, spec, re) => { proofs++; const r = await draw(browser, spec, { save: false }); if (!r.problems.some((m) => re.test(m))) bad("the checks did not notice " + what); };
    const base = list[0], long = "A headline that goes on and on, far past anything that could ever fit inside one advert of any shape at all, however small the letters became in the end";
    await must("a headline too long for its box", { ...base, noFit: true, title: long }, /cut off|overlaps|run off/);
    await must("the wrong fonts", { ...base, brand: { ...brand, fonts: { ...brand.fonts, display: "No Such Font", css: "data:text/css," } } }, /fonts did not load/);
    const staged = list.find((s) => s.shape === "square" && ["fan", "wall", "browser", "vote"].includes(s.kind));
    if (staged) await must("words sitting on top of the picture on show", { ...staged, noFit: true, title: long, gold: long }, /overlaps|cut off/);
    const spoken = list.find((s) => s.hex && s.say);
    if (spoken) {
      await must("a spoken line running past its bubble", { ...spoken, noFit: true, say: Array(14).join("This line goes on and on and on. ") }, /cut off|overlaps|run off/);
      await must("a missing picture of the mascot", { ...spoken, hex: spoken.hex.replace(/[^/]+$/, "nobody.png") }, /missing|cut off or too small/);
    }
    if (config.shots && config.shots.never && config.shots.leak) {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "promo-proof-"));
      proofs += 2;
      if (!(await shots(browser, { crop: false, leak: true, dir: tmp })).never) bad("the checks did not notice forbidden things inside an uncropped screenshot");
      if ((await shots(browser, { leak: true, dir: tmp })).never) bad("cropping a screenshot did not keep forbidden things out of the picture");
      fs.rmSync(tmp, { recursive: true, force: true });
    }
    if (config.check) await config.check({ bad, list, browser, draw, shots, specs, words });
    return { problems, adverts: list.length, proofs };
  }

  async function main(args) {
    if (args[0] === "--files") { console.log(JSON.stringify(files())); return; }
    const { chromium } = require("playwright");
    if (args[0] === "--check") {
      const browser = await chromium.launch();
      try { const r = await check(browser); if (r.problems.length) { console.log("PROMO PROBLEMS\n" + r.problems.join("\n")); process.exitCode = 1; } else console.log("promo kit: " + r.adverts + " adverts drawn and measured, and " + r.proofs + " broken versions were all caught"); } finally { await browser.close(); }
      return;
    }
    const si = args.indexOf("--shapes"), shapes = si > -1 ? args.splice(si, 2)[1].split(",") : Object.keys(brand.shapes);
    const wrongShape = shapes.filter((s) => !brand.shapes[s]); if (wrongShape.length) throw new Error("no shape called " + wrongShape.join(", ") + ". Choose from " + Object.keys(brand.shapes).join(", "));
    const known = config.adverts({ now: Date.now() }).map((a) => a.id), lost = args.filter((a) => !known.includes(a));
    if (lost.length) throw new Error("no advert called " + lost.join(", ") + ". Choose from: " + known.join(", "));
    const browser = await chromium.launch(), started = Date.now();
    try {
      const list = specs({ ids: args, shapes });
      if (list.some((s) => s.shot)) { const s = await shots(browser); if (s.never || s.calls) throw new Error("something that must never be in an advert ended up inside a screenshot, or the app called an outside service. Nothing was saved."); }
      let wrong = 0;
      for (let i = 0; i < list.length; i += 6) await Promise.all(list.slice(i, i + 6).map(async (s) => { const r = await draw(browser, s); if (r.problems.length) { wrong++; console.log("PROBLEM " + s.shape + "/" + s.id + ": " + r.problems.join("; ")); } }));
      if (!args.length && shapes.length === Object.keys(brand.shapes).length) leftovers().forEach((f) => { fs.unlinkSync(f); console.log("removed a leftover picture: " + path.relative(ROOT, f)); });
      sheet(specs({ shapes: Object.keys(brand.shapes).filter((sh) => fs.existsSync(path.join(OUT, sh))) }).filter((s) => fs.existsSync(s.out)));
      console.log(`${list.length} adverts drawn in ${Math.round((Date.now() - started) / 1000)} seconds, ${wrong} with problems. See promo/index.html`);
      if (wrong) process.exitCode = 1;
    } finally { await browser.close(); }
  }
  return { specs, shots, draw, sheet, words, leftovers, files, check, main, OUT, PROMO, ROOT, brand, config };
}

module.exports = { load };
if (require.main === module) {
  const args = process.argv.slice(2), ci = args.indexOf("--config"), cfg = ci > -1 ? args.splice(ci, 2)[1] : path.join(__dirname, "..", "promo.config.js");
  if (!fs.existsSync(cfg)) { console.error("No settings file at " + cfg + ". Copy promo-maker's starter/promo.config.js to promo/promo.config.js and fill it in."); process.exit(1); }
  load(cfg).main(args).catch((e) => { console.error(String(e.message || e)); process.exit(1); });
}
