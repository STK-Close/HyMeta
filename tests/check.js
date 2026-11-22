// Starts HyMeta's own server with a pretend CurseForge, then opens the app in a real browser at
// phone, tablet and desktop sizes, in light and dark, clicks through every main flow and reports
// anything broken. First with sample mods (no key), then with live-style mods (key set).
// Run: node tests/check.js [screenshot folder] [only, e.g. phone-light]
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const { start } = require("../scripts/dev-server");
const catalog = require("../lib/catalog"), CARD = catalog.packs, ROTA = catalog.rota, EVERY = catalog.base.length + ROTA.length;
const out = process.argv[2] ? path.resolve(process.argv[2]) : null;
const only = process.argv[3] || "";
if (out) fs.mkdirSync(out, { recursive: true });
const PASSWORD = "open-sesame-123";
let url = "", expecting401 = false; // the wrong-password attempt is meant to be refused
const sizes = { phone: [390, 844], tablet: [820, 1180], desktop: [1366, 900] };

async function signIn(p, bad) {
  await p.goto(url); await p.waitForTimeout(300);
  if (!(await p.locator("#pw").count())) { bad("the app was shown without asking for the password"); return; }
  if (await p.locator("#view").count()) bad("the app's page was sent before sign-in");
  expecting401 = true;
  await p.fill("#pw", "wrong-guess"); await p.click('button[type="submit"]'); await p.waitForSelector("#err:not([hidden])");
  expecting401 = false;
  if (await p.locator("#view").count()) bad("a wrong password was accepted");
  await p.fill("#pw", PASSWORD); await p.click('button[type="submit"]'); await p.waitForSelector("#view .page");
}

function makeAudit(p, bad) {
  return async (view) => {
      const found = await p.evaluate(() => {
        const res = [];
        const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
        const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
        const solid = (c) => { const m = c.match(/[\d.]+/g); return m && (m.length < 4 || +m[3] === 1); };
        const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.backgroundImage !== "none") return null; if (solid(cs.backgroundColor) && cs.backgroundColor !== "rgba(0, 0, 0, 0)") return cs.backgroundColor; } return getComputedStyle(document.body).backgroundColor; };
        if (document.documentElement.scrollWidth > innerWidth + 1) res.push("sideways scrolling, page is " + document.documentElement.scrollWidth + "px wide");
        const scope = document.querySelector("dialog[open]") || document.querySelector(".app");
        for (const el of scope.querySelectorAll("*")) {
          const cs = getComputedStyle(el); if (cs.display === "none" || cs.visibility === "hidden" || el.closest(".sr") || el.closest("svg")) continue;
          const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
          const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
          if (!own) continue;
          const label = el.textContent.trim().slice(0, 24);
          if (parseFloat(cs.fontSize) < 13) res.push(`text under 13px (${cs.fontSize}): ${label}`);
          if (el.closest(".hero-art, .pk-art, .tile, .style-tile")) continue;
          const bg = bgOf(el); if (!bg) continue;
          const cr = ratio(cs.color, bg);
          if (cr < 4.5) res.push(`low text contrast ${cr.toFixed(2)}: ${label}`);
        }
        for (const el of scope.querySelectorAll("a,button,select,input,summary")) {
          const r = el.getBoundingClientRect(); if (!r.width || el.classList.contains("term")) continue;
          let hh = r.height, ww = r.width;
          if (el.type === "checkbox" || el.type === "radio") { const l = el.closest("label").getBoundingClientRect(); hh = l.height; ww = l.width; }
          if (hh < 43.5 || ww < 43.5) res.push(`tap target ${Math.round(ww)}x${Math.round(hh)}: ${el.tagName} ${el.textContent.trim().slice(0, 20)}`);
        }
        // nothing a person can tap may run off the side of the screen or have its words cut off,
        // including bars pinned to the screen, which never make the page itself scroll sideways
        const scrolls = (el) => { for (let e = el.parentElement; e; e = e.parentElement) { const o = getComputedStyle(e).overflowX; if ((o === "auto" || o === "scroll") && e.scrollWidth > e.clientWidth + 1) return true; } return false; };
        for (const el of scope.querySelectorAll("a,button,select,input,summary,label")) {
          const cs = getComputedStyle(el), r = el.getBoundingClientRect(); if (!r.width || !r.height || cs.visibility === "hidden" || el.closest(".sr") || scrolls(el)) continue;
          const what = el.tagName + " " + (el.textContent.trim() || el.getAttribute("aria-label") || el.id || "").slice(0, 24);
          if (r.right > innerWidth + 1 || r.left < -1) res.push(`runs off the side of the screen (${Math.round(r.left)} to ${Math.round(r.right)} of ${innerWidth}): ${what}`);
          if ((el.tagName === "BUTTON" || el.classList.contains("btn")) && el.scrollWidth > el.clientWidth + 1) res.push(`words cut off: ${what}`);
        }
        // every card must stand apart from the page behind it
        const pageBg = getComputedStyle(document.body).backgroundColor;
        for (const sel of [".pk", ".card", ".panel", ".hex .say"]) for (const el of scope.querySelectorAll(sel)) {
          const cs = getComputedStyle(el);
          if (el.closest("dialog")) continue;
          if (ratio(cs.backgroundColor, pageBg) < 1.15) { res.push(`${sel} blends into the page (${ratio(cs.backgroundColor, pageBg).toFixed(2)})`); break; }
          if (ratio(cs.borderTopColor, pageBg) < 1.5) { res.push(`${sel} border too faint (${ratio(cs.borderTopColor, pageBg).toFixed(2)})`); break; }
        }
        return res;
      });
      [...new Set(found)].forEach((x) => bad(`${view}: ${x}`));
    };
}

(async () => {
  const b = await chromium.launch();
  let server = await start({ pretend: true, password: PASSWORD, key: "" });
  url = server.url;
  const problems = [];
  // ---------- the front door, private: what a stranger sees before the password ----------
  for (const [tag, w, h, scheme] of [["door-phone-light", 390, 844, "light"], ["door-desktop-dark", 1366, 900, "dark"]]) {
    if (only && only !== tag) continue;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: 1, hasTouch: w < 500 });
    const p = await ctx.newPage(); const bad = (m) => problems.push(`${tag} ${m}`);
    p.on("console", (m) => { if (m.type() === "error" && !/401/.test(m.text())) bad("console: " + m.text()); });
    p.on("pageerror", (e) => bad("page error: " + e.message)); p.setDefaultTimeout(6000);
    const audit = makeAudit(p, bad), count = (sel) => p.locator(sel).count();
    try {
      await p.goto(url); await p.waitForSelector("#h-main"); await p.evaluate(async () => { const imgs = [...document.images]; imgs.forEach((i) => { i.loading = "eager"; }); await Promise.all(imgs.map((i) => i.decode().catch(() => {}))); });
      await audit("front door"); if (out) await p.screenshot({ path: `${out}/${tag}.png`, fullPage: true });
      if (await count(".warn") || /Hex's warning/.test(await p.textContent("main")) || !/Plant a turnip/.test(await p.textContent(".free .hexbox .say")) || /name every chicken/.test(await p.textContent(".free .hexbox .say")) || await count(".free .hexbox .say p") !== 2) bad("the front door still has a warning box, or Hex says more than one thing at a time");
      { const face = await p.evaluate(() => { const r = document.querySelector(".free .hexbox img").getBoundingClientRect(); return Math.round(r.width) + "x" + Math.round(r.height); });
        if (face !== "56x56") bad("the front door shows Hex's face at the wrong size beside her words: " + face); }
      if (await count("#view, .mod")) bad("the front door shows parts of the app before the password");
      // the terms and the privacy policy can be read from here, before any password
      for (const [file, title, words] of [["terms", "Terms of use", "State of Florida"], ["privacy", "Privacy policy", "do not sell"], ["rules", "Community rules", "Be kind"], ["help", "Help and contact", "real person"]]) {
        await p.click(`footer a[href="/${file}.html"]`); await p.waitForSelector("#doc-title");
        if ((await p.textContent("#doc-title")) !== title || !(await p.textContent("main")).includes(words)) bad(`the ${file} page does not show the ${title}`);
        if (await count("#view, #pw")) bad(`the ${file} page is not a plain page of its own`);
        if (file === "help" && (await p.getAttribute('main a[href^="tel:"]', "href").catch(() => null)) !== "tel:+18137032981") bad("the Help page does not give Lumina Art House's phone number as a link that dials it");
        await audit(file + " page");
        if (file === "terms") {
          const before = await p.evaluate(() => getComputedStyle(document.body).backgroundColor); await p.click("#theme-switch");
          if (before === await p.evaluate(() => getComputedStyle(document.body).backgroundColor)) bad("the light and dark switch on the legal pages does nothing");
          await audit("terms page, other theme"); if (out) await p.screenshot({ path: `${out}/${tag}-terms.png`, fullPage: true });
          await p.click("#theme-switch");
          await p.click('nav a[href="/privacy.html"]'); await p.waitForFunction(() => document.querySelector("#doc-title").textContent === "Privacy policy"); await p.goBack();
        }
        await p.click("a.back"); await p.waitForSelector("#h-main");
      }
      // the same words as inside the app, so the two can never say different things
      { const inApp = require("fs").readFileSync(path.join(__dirname, "../src/app.html"), "utf8"), onPage = require("fs").readFileSync(path.join(__dirname, "../web/terms.html"), "utf8");
        if (!inApp.includes("auto-renewing subscription at $3.99 a month or $24.99 a year") || !onPage.includes("auto-renewing subscription at $3.99 a month or $24.99 a year")) bad("the terms page and the app's terms have drifted apart"); }
      if (await count(".steps li") !== 3 || await count(".style") !== 7) bad("the front door is missing its three steps or seven playstyles");
      if (await p.evaluate(() => [...document.images].filter((i) => !i.naturalWidth).length)) bad("a front door picture did not load");
      const doorText = await p.textContent("main");
      // Hex is introduced before she is asked to pick anything: who she is, what she looks like, how she talks
      if (!(await count('#hex-pic img[alt*="troll"]')) || !/Meet Hex/.test(await p.textContent("#h-quiz")) || !/resident troll/.test(await p.textContent(".meet"))) bad("the front door asks Hex to pick without saying who Hex is");
      const firstLine = await p.textContent("#hex-say"); await p.click("#hex-pic");
      if ((await p.textContent("#hex-say")) === firstLine) bad("tapping Hex does nothing");
      for (const need of ["$24.99 a year", "$3.99 a month", "Lumina Art House, LLC", "not affiliated", "13 and up", "CurseForge"]) if (!doorText.includes(need)) bad("the front door does not mention: " + need);
      // Hex's three questions choose a playstyle
      if (!(await p.locator("#result").isHidden())) bad("the quiz shows a result before any question is answered");
      // one question at a time, and the Hex panel plus the question fit a phone screen without a long scroll
      if (await count(".quiz .q") !== 1) bad("the quiz shows more than one question at once");
      if (w < 500) { const tall = await p.locator(".quiz").evaluate((e) => e.getBoundingClientRect().height); if (tall > 440) bad(`the Hex area is ${Math.round(tall)}px tall on a phone, more than a screenful`); }
      await audit("front door quiz");
      // two of the three answers point at magic, so magic wins even though the first answer said exploring
      for (const [qi, ai] of [[0, 3], [1, 2], [2, 1]]) await p.click(`.opt[data-q="${qi}"][data-a="${ai}"]`);
      await p.waitForSelector("#result:not([hidden])"); await audit("front door quiz result");
      if (await count(".quiz .q")) bad("the questions stay on screen after Hex has given her verdict");
      await p.click("#again"); if (await count(".quiz .q") !== 1 || !(await p.locator("#result").isHidden())) bad("Ask me again does not restart the questions");
      for (const [qi, ai] of [[0, 3], [1, 2], [2, 1]]) await p.click(`.opt[data-q="${qi}"][data-a="${ai}"]`);
      if (!/Wizard school dropout/.test(await p.textContent("#result"))) bad("the quiz picked the wrong playstyle: " + (await p.textContent("#result")).slice(0, 60));
      // the password takes the visitor straight to the playstyle Hex picked
      await p.fill("#pw", "wrong-guess"); await p.click('#f button[type="submit"]'); await p.waitForSelector("#err:not([hidden])");
      await p.fill("#pw", PASSWORD); await p.click('#f button[type="submit"]'); await p.waitForSelector("#view .page");
      if (!/#pack-wizard-dropout$/.test(p.url())) bad("after the password the visitor was not taken to the playstyle Hex picked: " + p.url());
      await p.goto(url + "?door=1"); if (!(await count("#h-main")) || await count("#view")) bad("the owner cannot preview the front door once signed in");
      // a shared link, followed by someone who has never been here: a public page of its own,
      // then through the password and straight to that playpack
      const fresh = await b.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: 1, hasTouch: w < 500 }), q = await fresh.newPage(), auditQ = makeAudit(q, bad);
      q.on("pageerror", (e) => bad("page error: " + e.message)); q.setDefaultTimeout(6000);
      await q.goto(url + "p/cozy-farmer"); await q.waitForSelector("#pack-name");
      if ((await q.textContent("#pack-name")) !== "The cozy farmer" || !/^Plant a turnip/.test(await q.textContent("#hex-line"))) bad("the shared page does not show the playpack and Hex's line");
      // the yellow warning box is gone, and Hex says one thing, in her speech bubble, beside her face
      if (await q.locator(".warn").count() || /Hex's warning/.test(await q.textContent("main")) || /name every chicken/.test(await q.textContent(".hexbox .say")) || await q.locator(".hexbox .say p").count() !== 2 || !(await q.evaluate(() => { const i = document.querySelector(".hexbox img"), r = i.getBoundingClientRect(); return i.complete && i.naturalWidth > 0 && Math.round(r.width) === 56 && Math.round(r.height) === 56; }))) bad("the shared page still has a warning box, or Hex says more than one thing at a time");
      if (await q.evaluate(async () => { const i = document.querySelector("img.pic"); if (!i.complete) await new Promise((r) => { i.onload = i.onerror = r; }); return !i.naturalWidth; })) bad("the shared page picture did not load");
      await auditQ("shared playpack page"); if (out) await q.screenshot({ path: `${out}/${tag}-shared.png`, fullPage: true });
      await q.click("#theme-switch"); await auditQ("shared playpack page, other theme"); await q.click("#theme-switch");
      await q.click("#open-pack"); await q.waitForSelector("#pw");
      if (await q.locator("#view").count()) bad("a shared link lets a stranger into the app without the password");
      await q.fill("#pw", PASSWORD); await q.click('#f button[type="submit"]'); await q.waitForSelector("#view .page");
      if (!/#pack-cozy-farmer$/.test(q.url()) || !/The cozy farmer/.test(await q.textContent("#view h1"))) bad("after the password, a shared link does not land on its playpack: " + q.url());
      await fresh.close();
    } catch (e) { bad("stopped early, a step could not be done: " + e.message.split("\n").slice(0, 4).join(" ").replace(/\s+/g, " ").slice(0, 260)); }
    await ctx.close();
  }
  for (const scheme of ["light", "dark"]) for (const [name, [w, h]] of Object.entries(sizes)) {
    const tag = `${name}-${scheme}`;
    if (only && only !== tag) continue;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: 1, hasTouch: name !== "desktop" , permissions: ["clipboard-read", "clipboard-write"], acceptDownloads: true });
    const p = await ctx.newPage();
    const bad = (m) => problems.push(`${tag} ${m}`);
    p.on("console", (m) => { if (m.type() === "error" && !(expecting401 && /40[01]/.test(m.text())) && !/registered handler|curseforge:/i.test(m.text())) bad("console: " + m.text()); });
    p.on("pageerror", (e) => bad("page error: " + e.message));
    const go = async (hash) => { await p.goto(url + "#" + hash); await p.waitForTimeout(220); };
    const shot = async (n) => { if (out) await p.screenshot({ path: `${out}/${tag}-${n}.png`, fullPage: true }); };

    const audit = makeAudit(p, bad);
    const count = (sel) => p.locator(sel).count();
    p.setDefaultTimeout(6000);
    try {

    // sign in, then home
    await signIn(p, bad); await p.waitForTimeout(500);
    await audit("home"); await shot("home");
    // first-time welcome: shown once, gone for good after "Got it"
    if (!(await count("#welcome"))) bad("home: no welcome for a first-time visitor");
    await p.click('[data-action="welcome"]'); await p.reload(); await p.waitForSelector("#view .page"); await p.waitForTimeout(300);
    if (await count("#welcome")) bad("home: the welcome came back after it was dismissed");
    if (await count(".top .hex, .top .face")) bad("home: troll is in the top bar");
    if (!(await count('.hex .face img[src$="hex-face.jpg"]')) || await count(".hex .face svg")) bad("home: Hex is not shown with her portrait face");
    if (await p.evaluate(() => { const i = document.querySelector(".hex .face img"); return !i || !i.naturalWidth; })) bad("home: Hex's face did not load");
    // Hex says one thing at a time: her line first, and tapping her swaps to the playpack's caution and back
    { const said = () => p.locator(".hero .hex .line").allTextContents(), one = await said();
      if (one.length !== 1 || !/Plant a turnip/.test(one[0]) || /chicken/.test(one[0])) bad("home: Hex should say one thing, her line about the playpack. She says: " + one.join(" / "));
      await p.click(".hero .hex .face"); const two = await said();
      if (two.length !== 1 || !/name every chicken/.test(two[0]) || /turnip/.test(two[0])) bad("home: tapping Hex does not swap to the other thing she has to say: " + two.join(" / "));
      await p.click(".hero .hex .face"); if (!/Plant a turnip/.test((await said())[0])) bad("home: tapping Hex again does not bring her first line back");
      const tall = await p.locator(".hero .hex").evaluate((e) => Math.round(e.getBoundingClientRect().height)); if (name === "phone" && tall > 150) bad("home: Hex's speech bubble is " + tall + "px tall on a phone"); }
    if (await count("#view > .page > .hex")) bad("home: troll greeting is back at the top of the page");
    if (name === "phone") { const hgt = await p.locator(".pk").first().evaluate((e) => e.getBoundingClientRect().height); if (hgt > 190) bad(`home: playpack card is ${Math.round(hgt)}px tall on a phone`); }

    // two taps from home to playing
    await p.click('[data-action="play"]'); await p.click('[data-mode="here"]'); await p.click('[data-action="install"]'); await p.waitForTimeout(2200);
    if (!/All 6 mods are in/.test(await p.textContent("#play-out"))) bad("play: install did not finish");
    await audit("play sheet"); if (out) await p.screenshot({ path: `${out}/${tag}-play.png` });
    await p.click('[data-mode="send"]'); await audit("send sheet"); await p.keyboard.press("Escape");

    // artwork loads, and playstyle tiles filter the shelf
    const broken = await p.evaluate(async () => { const imgs = [...document.querySelectorAll("img.art")]; imgs.forEach((i) => { i.loading = "eager"; }); await Promise.all(imgs.map((i) => i.decode().catch(() => {}))); return imgs.filter((i) => !i.naturalWidth).length + (imgs.length < 10 ? 100 : 0); });
    if (broken) bad("home: artwork is missing or did not load (" + broken + ")");
    if (await count(".style-tile") !== 7) bad("home: expected 7 playstyle tiles");
    if (!(await count("#h-spot"))) bad("home: mod spotlight is missing");
    if (await count("#coming, #poll")) bad("home: a next playpack is promised, or voted on, after the weekly list has run out");
    if (await count("#home-save")) bad("home: saving, a member feature, is offered in the free view");
    if (await count(".warn") || /Hex's warning/.test(await p.textContent("#view"))) bad("home: the yellow warning box is still there");
    await p.click('[data-family="magic"]'); await p.waitForTimeout(220);
    const magic = await p.locator("#results .pk .pk-name").allTextContents();
    if (await p.inputValue("#fam") !== "magic" || magic.slice().sort().join(" | ") !== Object.values(CARD).filter((c) => c.family === "magic").map((c) => c.name).sort().join(" | ")) bad("playstyle tile did not filter to the magic packs, showed: " + magic.join(" | "));
    await p.selectOption("#fam", "all"); await p.waitForTimeout(150);
    const out22 = await p.locator("#results .shelf").first().locator(".pk").count();
    if (out22 !== EVERY) bad("explore: all " + EVERY + " playpacks should be out once the weekly list has run out, found " + out22);
    // newest first is how Explore opens, and the search box says only "Search"
    const firstUp = await p.locator("#results .pk .pk-name").allTextContents();
    if (await p.inputValue("#sort") !== "new" || firstUp[0] !== CARD[ROTA[ROTA.length - 1]].name || firstUp[1] !== CARD[ROTA[ROTA.length - 2]].name) bad("explore: does not open with the newest playpack first, opened with: " + firstUp.slice(0, 2).join(" | "));
    if (await count(".fam-group")) bad("explore: opens grouped by playstyle, not newest first");
    if ((await p.getAttribute("#q", "placeholder")) !== "Search") bad("explore: the search box says more than Search: " + await p.getAttribute("#q", "placeholder"));
    if (await count("#results .pk-new")) bad("explore: a playpack is called new after the weekly list has run out");
    if (name === "phone") { // the filters sit in two tidy rows under the search box, not four ragged ones
      const bar = await p.evaluate(() => { const t = document.querySelector(".toolbar.filters").getBoundingClientRect(), w = [...document.querySelectorAll(".toolbar.filters select, #surprise")].map((e) => Math.round(e.getBoundingClientRect().width)); return { h: Math.round(t.height), min: Math.min(...w), max: Math.max(...w) }; });
      if (bar.h > 190) bad("explore: the search and filters take up " + bar.h + "px on a phone");
      if (bar.max - bar.min > 2 || bar.min < 150) bad("explore: the filter boxes are ragged widths on a phone (" + bar.min + " to " + bar.max + "px)");
    }
    await p.selectOption("#fam", "magic"); await p.waitForTimeout(150);
    await go("home");
    // dare tiles filter the shelf
    await p.click('[data-dare="3"]'); await p.waitForTimeout(220);
    if (await p.inputValue("#filter") !== "3" || await count("#results .pk") !== 3) bad("dare tile did not filter to 3 packs");
    await p.selectOption("#filter", "all");

    // locked pack in the free view
    await go("pack-too-many-legs"); await audit("locked pack"); await shot("locked");
    await p.click(".hex .face");
    if (await count(".warn") || await count(".hex .line") !== 1 || !/Check your boots/.test(await p.textContent(".hex .line"))) bad("pack: tapping Hex does not bring up the playpack's caution, or the warning box is still there");
    if ((await p.textContent("#view h1")) !== "Creepy crawlies" || !/slimes, frogs/.test(await p.textContent(".lede"))) bad("Too many legs has not become Creepy crawlies");
    await p.click(".art-zoom"); await p.waitForSelector("#art-big");
    if (!(await p.evaluate(async () => { const i = document.querySelector("#art-big"); if (!i.complete) await new Promise((r) => { i.onload = i.onerror = r; }); return i.naturalWidth >= 1200 && /pack-crawlies\.jpg$/.test(i.src); }))) bad("the full size picture did not open");
    await audit("full size picture"); await p.keyboard.press("Escape");
    if (await count(".mod")) bad("locked pack shows its mods to free players");
    if (await count('.actions [data-action="share"], [data-action="share"]') !== 1) bad("a free player cannot share a playpack");

    // membership: disclosure, grown-up gate, then member view
    await p.click('.actions [data-action="join"]');
    const joinText = await p.textContent("#sheet");
    for (const need of ["$3.99", "$24.99", "renews automatically", "Apple Pay", "Terms of use", "Privacy policy"]) if (!joinText.includes(need)) bad("membership sheet is missing: " + need);
    await audit("membership sheet");
    await p.click('[data-action="gate"]'); await audit("gate");
    await p.fill("#gate-in", "1"); await p.click('#gate button[type="submit"]');
    if (await p.locator("#gate-err").isHidden()) bad("gate accepted a wrong answer");
    const nums = (await p.textContent('label[for="gate-in"]')).match(/\d+/g).map(Number);
    await p.fill("#gate-in", String(nums[0] * nums[1])); await p.click('#gate button[type="submit"]'); await p.waitForTimeout(200);
    if (!(await count(".mod"))) bad("member view hides the mods");
    if (!(await count("#g-spice[open] .group-about"))) bad("the spice group starts closed or does not say what it is");
    await audit("pack"); await shot("pack");

    // the free playpack on the home screen can be saved with a heart, by members
    await go("home"); await p.click("#home-save"); await p.waitForFunction(() => /^Saved$/.test(document.querySelector("#home-save").textContent.trim()) && document.querySelector("#home-save").getAttribute("aria-pressed") === "true");
    await audit("home, free playpack saved"); await go("saved");
    if (!(await p.textContent("#view")).includes("The cozy farmer")) bad("saving the free playpack from the home screen did not put it in Saved");
    await go("home"); await p.click("#home-save"); await p.waitForFunction(() => /^Save$/.test(document.querySelector("#home-save").textContent.trim()));
    await go("pack-too-many-legs");
    // save a playpack and a mod. Stamps are gone: nothing could show a playpack had really been played
    await p.click('[data-action="save"]'); await p.click('[data-action="savemod"]'); await p.waitForTimeout(300);
    if (await count('[data-action="stamp"], [data-action="stampdone"], .stamp, #h-stamp')) bad("pack: a stamp is still offered");
    if (await count(".brokenbtn, #badge-offer")) bad("pack: reporting a mod or the maker's badge is offered in the offline preview, where neither can work");
    // the bar of buttons under a playpack: every button fully on screen, each on one line,
    // at this size and, on a phone, on the smallest phones too (320px wide)
    for (const narrow of name === "phone" ? [0, 320] : [0]) {
      if (narrow) { await p.setViewportSize({ width: narrow, height: h }); await p.waitForTimeout(120); }
      const bar = await p.evaluate(() => [...document.querySelectorAll(".actions .btn")].map((e) => { const r = e.getBoundingClientRect(); return { t: e.textContent.trim(), l: Math.round(r.left), r: Math.round(r.right), h: Math.round(r.height), cut: e.scrollWidth > e.clientWidth + 1 }; }).concat([{ vw: innerWidth }]));
      const vw = bar.pop().vw;
      if (bar.map((x) => x.t).join("|") !== "Play this pack|Saved|Share") bad("pack: expected Play, Save and Share under a playpack, found " + bar.map((x) => x.t).join("|"));
      for (const x of bar) { if (x.l < 0 || x.r > vw) bad(`pack at ${vw}px: the ${x.t} button runs off the screen (${x.l} to ${x.r})`); if (x.h > 64 || x.cut) bad(`pack at ${vw}px: the ${x.t} button wraps or is cut off (${x.h}px tall)`); }
      if (narrow) { await audit("pack on a very small phone"); await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(120); }
    }
    // share: a picture card drawn in the browser, and a link
    await p.click('[data-action="share"]'); await p.waitForFunction(() => { const i = document.querySelector("#share-card"); return i && i.naturalWidth === 1080 && i.naturalHeight === 1080; });
    const cardInfo = (sel) => p.evaluate(async () => { const i = document.querySelector("#share-card"), c = document.createElement("canvas"); c.width = c.height = 1080; const x = c.getContext("2d"); x.drawImage(i, 0, 0);
      const seen = new Set(); for (let yy = 20; yy < 1080; yy += 40) for (let xx = 20; xx < 1080; xx += 40) { const d = x.getImageData(xx, yy, 1, 1).data; seen.add((d[0] >> 4) + "," + (d[1] >> 4) + "," + (d[2] >> 4)); }
      const pink = (x0, y0, x1, y1) => { let n = 0; const d = x.getImageData(x0, y0, x1 - x0, y1 - y0).data; for (let k = 0; k < d.length; k += 4) if (d[k] > 215 && d[k + 1] < 140 && d[k + 2] > 120 && d[k + 2] < 210) n++; return n; };
      const light = (x0, y0, x1, y1) => { let n = 0; const d = x.getImageData(x0, y0, x1 - x0, y1 - y0).data; for (let k = 0; k < d.length; k += 4) if (d[k] > 225 && d[k + 1] > 220 && d[k + 2] > 200) n++; return n; };
      return { colors: seen.size, stampInk: pink(660, 60, 1080, 330), nameInk: light(40, 440, 1040, 600), bubbleInk: light(230, 640, 1040, 960) }; });
    const withStamp = await cardInfo();
    if (withStamp.colors < 60) bad("the share card is blank or nearly blank (" + withStamp.colors + " colors)");
    if (withStamp.nameInk < 3000) bad("the share card does not show the playpack's name");
    if (withStamp.bubbleInk < 1500) bad("the share card does not show what Hex says");
    if (await count("#share-stamp") || withStamp.stampInk > 300) bad("the share card still carries a Survived stamp");
    await audit("share sheet"); await shot("share");
    const [download] = await Promise.all([p.waitForEvent("download"), p.click("#share-save")]);
    if (download.suggestedFilename() !== "hymeta-too-many-legs.jpg") bad("the saved picture has the wrong name: " + download.suggestedFilename());
    await p.click('[data-action="sharecopy"]'); await p.waitForFunction(() => /Link copied/.test(document.querySelector("#toast").textContent));
    const copied = await p.evaluate(() => navigator.clipboard.readText());
    if (copied !== "https://hymeta.vercel.app/p/too-many-legs" && copied !== url + "p/too-many-legs") bad("the copied link is wrong: " + copied);
    if ((await p.textContent("#share-link")) !== copied) bad("the link shown in the share sheet is not the one that is copied");
    await p.keyboard.press("Escape");
    await go("pack-potato-empire"); if (await count('[data-action="share"]')) bad("a playpack built by a member can be shared outside the site");
    await go("pack-too-many-legs");
    await go("saved"); await audit("saved playpacks"); await shot("saved-packs");
    if (await count("#view .pk") !== 1) bad("saved playpacks list is wrong");
    await p.click('[data-tab="mods"]'); await audit("saved mods"); await shot("saved-mods");
    if (await count("#view .mod") !== 1) bad("saved mods list is wrong");
    await p.click('[data-tab="packs"]'); await p.click(".pk-heart"); await p.waitForTimeout(150);
    if (await count("#view .pk") !== 0 || !(await count("#view .panel"))) bad("heart in Saved did not remove the playpack");

    // explore: grouped by playstyle, sortable, and a surprise button
    await go("explore"); await audit("explore"); await shot("explore");
    await p.selectOption("#sort", "style"); await audit("explore, by playstyle");
    if (await count(".fam-group") < 6) bad("explore: playpacks are not grouped under playstyle headings");
    // the chosen order is remembered on the next visit
    await p.reload(); await p.waitForSelector("#results .pk"); if (await p.inputValue("#sort") !== "style" || await count(".fam-group") < 6) bad("explore: the chosen sort order was forgotten after reloading");
    await p.selectOption("#sort", "az");
    const order = await p.locator("#results .shelf").first().locator(".pk-name").allTextContents();
    if (order.length < 10 || order.join("|") !== order.slice().sort((x, y) => x.localeCompare(y)).join("|")) bad("explore: A to Z sorting is wrong: " + order.slice(0, 4).join(", "));
    await p.selectOption("#sort", "wild"); if ((await p.locator("#results .pk .chip").first().textContent()).indexOf("Send help") < 0) bad("explore: wildest first does not start with a send help playpack");
    await p.selectOption("#sort", "new");
    await p.click("#surprise"); await p.waitForFunction(() => location.hash.indexOf("#pack-") === 0); await go("explore");
    await p.fill("#q", "spider"); if (await count("#results .pk") !== 1) bad("search for spider should find 1 playpack");
    await p.fill("#q", "zzzz"); if (!(await count("#results .panel"))) bad("no empty state for a search with no results");
    await p.click("#q-clear"); if (await p.inputValue("#q") !== "") bad("search clear button failed");

    // build: search, filter, picks survive searching, warnings
    await go("build"); await audit("build");
    await p.fill("#bq", "fishing"); if (await count(".pickrow") !== 1) bad("mod search for fishing should find 1 mod");
    await p.check('input[value="hook"]'); await p.click("#bq-clear");
    if (!(await p.isChecked('input[value="hook"]'))) bad("picked mod was lost after clearing the search");
    await p.selectOption("#bcat", "Magic"); if (await count(".pickrow") !== 3) bad("Magic category should show 3 mods");
    await p.check('input[value="spell"]'); await p.selectOption("#bcat", "all");
    if (!/2 picked/.test(await p.textContent("#b-status"))) bad("picked count is wrong: " + (await p.textContent("#b-status")).slice(0, 30));
    await p.check("#bonly"); if (await count(".pickrow") !== 2) bad("only show picked should list 2 mods");
    await p.uncheck("#bonly"); await shot("build");
    const capped = await p.evaluate(() => { const boxes = [...document.querySelectorAll('input[name="mods"]')]; boxes.forEach((b) => { if (!b.checked) b.click(); }); const n = boxes.filter((b) => b.checked).length; boxes.forEach((b) => { if (b.checked && b.value !== "hook" && b.value !== "spell") b.click(); }); return n; });
    if (capped !== 20) bad("a playpack should stop at 20 mods, it allowed " + capped);
    await p.fill("#b-name", "Swamp <b>wizard</b>");
    await p.click('.tabs a[href="#home"]'); await p.waitForTimeout(250);
    if (!(await count("dialog[open]"))) bad("no warning before losing an unsaved playpack");
    await audit("leave warning"); await p.click('dialog .btn[data-action="close"]');
    if (await p.inputValue("#b-name") !== "Swamp <b>wizard</b>") bad("draft was lost after choosing to keep building");
    await p.fill("#b-blurb", "call me on 5551234567"); await p.click('#build button[type="submit"]');
    if (!/links, emails and phone/.test(await p.textContent("#b-err"))) bad("personal details were allowed in a shared playpack");
    await p.fill("#b-blurb", "Swampy"); await p.click('#build button[type="submit"]');
    if (!/at least three mods/.test(await p.textContent("#b-err"))) bad("a playpack with only 2 mods was accepted");
    await p.check('input[value="wand"]'); await p.click('#build button[type="submit"]'); await p.waitForTimeout(300);
    if (!/pack-mine-/.test(p.url())) bad("sending for review did not open the new playpack");
    if (await count("#view b")) bad("typed text was treated as code");
    if (!(await count("#review-note"))) bad("new playpack is not marked as waiting for review");
    const mineUrl = p.url().split("#")[1];
    await go("explore"); if (await count(`a[href="#${mineUrl}"]`)) bad("a playpack still in review is shown to the community");
    await go(mineUrl); await audit("my playpack, in review"); await p.click('[data-action="approve"]');
    await go("explore"); if (!(await count(`a[href="#${mineUrl}"]`))) bad("an approved playpack is not shown to the community");
    await go(mineUrl);
    await p.click('[data-action="del"]'); await p.click('[data-action="del"]'); await p.waitForTimeout(250);
    if (!/explore/.test(p.url())) bad("two-tap delete failed");

    // community safety: report and block
    await go("pack-potato-empire"); await audit("community pack");
    await p.click('[data-action="report"]'); await audit("report sheet"); await p.click('#report button[type="submit"]'); await p.waitForTimeout(250);
    if (await count('a[href="#pack-potato-empire"]')) bad("reported playpack is still shown");
    await go("pack-fish-and-nothing-else"); await p.click('[data-action="block"]'); await p.click('[data-action="block"]'); await p.waitForTimeout(250);
    if (await count('a[href="#pack-fish-and-nothing-else"]')) bad("blocked member's playpack is still shown");

    // you: settings, legal, account deletion, theme switch
    await go("you"); await audit("you"); await shot("you");
    await p.click('#f-acct > summary'); await p.click('[data-action="signin"]');
    if (!/ages 13 and up/.test(await p.textContent("#sheet"))) bad("sign-in does not state the 13 and up rule");
    await p.keyboard.press("Escape"); await p.click('#f-acct > summary');
    for (const id of ["f-look", "f-acct", "f-mem", "f-legal", "f-reset"]) await p.click(`#${id} > summary`);
    await audit("you, everything open");
    if (!(await count('[data-action="unblock"]'))) bad("blocked member is not listed");
    if (!(await count('[data-action="delacct"]'))) bad("no way to delete the account");
    for (const d of ["support", "privacy", "terms", "rules", "credits"]) {
      await p.click(`[data-doc="${d}"]`); await audit("doc " + d);
      const docText = await p.textContent("#sheet");
      if (d !== "support" && d !== "rules" && !/Lumina Art House, LLC/.test(docText)) bad(`${d} does not name Lumina Art House, LLC`);
      if (d === "terms" && !/State of Florida/.test(docText)) bad("terms do not name Florida law");
      if (/Riot/.test(docText)) bad(`${d} mentions Riot Games`);
      await p.keyboard.press("Escape");
    }
    if (!/Lumina Art House, LLC/.test(await p.textContent(".foot"))) bad("footer copyright missing");
    await p.selectOption("#theme", scheme === "light" ? "dark" : "light");
    const bg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
    if ((scheme === "light") !== (bg === "rgb(14, 18, 35)")) bad("theme switch did not change the page: " + bg);
    await audit("you, switched theme"); await p.selectOption("#theme", "device");
    await p.click('[data-action="reset"]'); await p.click('[data-action="reset"]'); await p.waitForTimeout(200);
    await p.click("#tier-free"); await go("saved"); await audit("saved, free view"); await go("build"); await audit("build, free view");
    } catch (e) { bad("stopped early, a step could not be done: " + e.message.split("\n").slice(0, 4).join(" ").replace(/\s+/g, " ").slice(0, 260)); }
    await ctx.close();
  }
  server.close();

  // ---------- live mods: the same server with a key set, still talking to the pretend CurseForge ----------
  server = await start({ pretend: true, password: PASSWORD, key: "pretend-key", accounts: true });
  url = server.url;
  for (const [tag, w, h, scheme] of [["live-phone-light", 390, 844, "light"], ["live-desktop-dark", 1366, 900, "dark"]]) {
    if (only && only !== tag) continue;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: 1, hasTouch: w < 500, permissions: ["clipboard-read", "clipboard-write"] });
    const p = await ctx.newPage();
    const bad = (m) => problems.push(`${tag} ${m}`);
    await p.route("https://media.forgecdn.net/**", (r) => r.fulfill({ status: 200, contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#888"/></svg>' }));
    p.on("console", (m) => { if (m.type() === "error" && !(expecting401 && /40[01]/.test(m.text())) && !/registered handler|curseforge:/i.test(m.text())) bad("console: " + m.text()); });
    p.on("pageerror", (e) => bad("page error: " + e.message));
    const leaked = new Set();
    p.on("response", async (r) => { if (!r.url().startsWith(url)) return; try { if ((await r.text()).includes("pretend-key")) leaked.add(new URL(r.url()).pathname); } catch (e) {} });
    p.setDefaultTimeout(6000);
    const audit = makeAudit(p, bad), count = (sel) => p.locator(sel).count();
    const go = async (hash) => { await p.goto(url + "#" + hash); await p.waitForTimeout(350); };
    try {
      // data routes refuse visitors who have not signed in
      const locked = await ctx.request.get(url + "api/pack?id=cozy-farmer");
      if (locked.status() !== 401) bad("mod data was served without signing in (status " + locked.status() + ")");
      await signIn(p, bad);
      await p.waitForSelector(".notice:has-text('live mods')");
      await p.waitForSelector("#h-spot"); await p.waitForTimeout(400);
      await audit("live home"); if (out) await p.screenshot({ path: `${out}/${tag}-home.png`, fullPage: true });
      if (await count(".tag-sample")) bad("live home still shows sample mods");
      if (!(await count('section[aria-labelledby="h-spot"] img.tile-img'))) bad("spotlight mod has no logo");
      // the free playpack: real-style mods, logos, authors, links and helper mods
      await p.waitForSelector('.hero-side .chip:has-text("mods")'); // the free playpack has finished loading
      await p.click('[data-action="play"]'); await p.click('[data-mode="here"]'); await p.waitForSelector("#inst-list li");
      const inPack = await count("#inst-list li"); if (inPack < 6) bad("free playpack has too few mods: " + inPack);
      // real installing: each tap hands one mod to the CurseForge app and moves on to the next
      await audit("install sheet"); if (out) await p.screenshot({ path: `${out}/${tag}-install.png` });
      const first = await p.getAttribute("#inst-next", "href"), firstName = await p.textContent("#inst-next");
      if (!/^curseforge:\/\/install\?addonId=\d+$/.test(first)) bad("the install button does not hand the mod to the CurseForge app: " + first);
      await p.click("#inst-next"); await p.waitForFunction(() => /^1 of /.test(document.querySelector("#inst-count").textContent));
      if ((await p.textContent("#inst-next")) === firstName) bad("after installing a mod the button did not move on to the next one");
      if (await count("#inst-list input:checked") !== 1) bad("the installed mod was not ticked off");
      while (await count("#inst-list input:not(:checked)")) { await p.locator("#inst-list input:not(:checked)").first().click(); await p.waitForTimeout(80); }
      await p.waitForSelector("#inst-done");
      const lastStep = await p.textContent("#inst-done");
      if (!/switch these mods on/.test(lastStep) || !/Right-click/.test(lastStep) || !/Save World Settings/.test(lastStep)) bad("the last step, switching the mods on in each world, is not explained");
      await audit("install finished");
      await p.keyboard.press("Escape"); await p.reload(); await p.waitForSelector('.hero-side .chip:has-text("mods")');
      await p.click('[data-action="play"]'); await p.click('[data-mode="here"]'); if (!(await count("#inst-done"))) bad("install progress was forgotten after reloading");
      // send to my computer: a real code that opens the same playpack
      await p.click('[data-mode="send"]'); await p.waitForFunction(() => /^[B-DF-HJ-NP-TV-XZ]{4}-\d{4}$/.test(document.querySelector("#code").textContent));
      const handCode = await p.textContent("#code"); await audit("send sheet with a code");
      await p.keyboard.press("Escape");
      // the code is typed in on the computer, so a phone never offers "I have a code from my phone"
      if (w < 500) { if (await count("#have-code")) bad("a phone offers I have a code from my phone"); await p.evaluate(() => { const t = document.createElement("button"); t.dataset.action = "code"; document.body.appendChild(t); t.click(); t.remove(); }); }
      else await p.click("#have-code");
      await audit("code entry");
      expecting401 = true; await p.fill("#code-in", "ZZZZ-0000"); await p.click('#codeform button[type="submit"]'); await p.waitForSelector("#code-err:not([hidden])"); expecting401 = false;
      await p.fill("#code-in", handCode.toLowerCase()); await p.click('#codeform button[type="submit"]'); await p.waitForSelector("#inst-list");
      if (!/pack-cozy-farmer/.test(p.url())) bad("the code did not open its playpack");
      await p.keyboard.press("Escape");
      await go("pack-cozy-farmer"); await p.waitForSelector(".mod");
      await audit("live pack"); if (out) await p.screenshot({ path: `${out}/${tag}-pack.png`, fullPage: true });
      const text = await p.textContent("#view");
      if (/Sexy/.test(text)) bad("a mod with a blocked word was shown");
      if (!/Sneaky/.test(text)) bad("expected mod is missing from the playpack");
      if (await p.evaluate(() => window.__hacked) || await count("#view img[onerror]")) bad("a mod name was treated as code");
      if (!(await count("#g-help"))) bad("helper mods were not found for a mod that needs one");
      if (!(await count("#g-extra .mod"))) bad("the everyday extras group is missing");
      for (const g of ["g-core", "g-spice", "g-extra", "g-help"]) {
        if (!(await count(`#${g}[open]`))) bad(`the group ${g} starts closed, which makes its mods look optional`);
        if (!(await count(`#${g} .group-about`))) bad(`the group ${g} does not say what it is`);
      }
      if (/Pretend Helper Lib/.test(await p.textContent("#g-core"))) bad("a helper mod was listed as a main pick");
      if (!/By pretend_author/.test(text)) bad("mod author is missing");
      if (!/Picked for:\s*Crops and gardens/.test(text)) bad("mods do not say which job they were picked for");
      // mods are compact rows: the closed row shows the name and the job, and a tap opens the rest
      { const rows = await p.evaluate(() => [...document.querySelectorAll("#g-core .mod")].map((e) => Math.round(e.getBoundingClientRect().height)));
        if (rows.some((x) => x > 72)) bad("closed mod rows are too tall: " + rows.join(", ") + "px");
        if (await p.locator("#g-core .mod .mod-more").first().isVisible() || await p.locator("#g-core .mod a.linkbtn").first().isVisible()) bad("a mod row starts open");
        if (!(await p.locator("#g-core .mod h4").first().isVisible()) || !(await p.locator("#g-core .mod .mod-sub").first().isVisible())) bad("a closed mod row does not show its name and job");
        await p.click("#g-core .mod summary >> nth=0");
        for (const sel of [".mod-more p", ".meta", "a.linkbtn"]) if (!(await p.locator("#g-core .mod " + sel).first().isVisible())) bad("opening a mod row does not show " + sel);
        await audit("live pack, one mod open"); if (out) await p.screenshot({ path: `${out}/${tag}-mod-open.png`, fullPage: true });
        await p.keyboard.press("Tab"); await p.focus("#g-core .mod summary >> nth=1"); await p.keyboard.press("Enter");
        if (!(await p.locator("#g-core .mod .mod-more").nth(1).isVisible())) bad("a mod row cannot be opened from the keyboard");
        await p.click("#g-core .mod summary >> nth=1"); await p.click("#g-core .mod summary >> nth=0"); }
      if (!/Chosen for Hytale 0\.7/.test(text) || !/Hytale 0\.7/.test(await p.textContent(".mod .meta"))) bad("game version is not shown");
      const href = await p.getAttribute(".mod a.linkbtn", "href"); if (!/^https:\/\/www\.curseforge\.com\/hytale\/mods\//.test(href)) bad("mod link does not go to its CurseForge page: " + href);
      // a mod that may not work with the current game says so on its card
      await p.click("#tier-member"); await go("pack-wizard-dropout"); await p.waitForSelector(".mod");
      if (!(await count(".mod .caution")) || !(await p.locator(".mod:has(.caution) summary .mflag-old").first().isVisible()) || !/Older/.test(await p.locator(".mod:has(.caution) summary").first().textContent())) bad("an out-of-date mod carries no warning, or the closed row does not say so in words");
      await audit("live pack with a warning"); await p.click("#tier-free");
      // locked playpacks never fetch their mods in the free view
      const before = server.calls.length; await go("pack-dungeon-gremlin"); await p.waitForTimeout(300);
      if (server.calls.length !== before || await count(".mod")) bad("a locked playpack fetched its mods for a free player");
      // member: save a mod, reload, it is fetched again by id
      await p.click("#tier-member"); await p.waitForSelector(".mod"); await p.click('[data-action="savemod"]');
      await p.reload(); await p.waitForSelector("#view .page"); await go("saved"); await p.click('[data-tab="mods"]'); await p.waitForSelector("#view .mod");
      await audit("live saved mods");
      // building needs a signed-in member once accounts exist
      await go("build"); await p.waitForSelector('#view [data-action="signup"]');
      if (await count(".pickrow")) bad("the builder is open to visitors who have not signed in");
      // ---------- accounts ----------
      const email = tag + "@example.test", pass = "correct-horse-9";
      // the owner's account exists first: the first account ever made is the one that reviews playpacks
      const bossCtx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: scheme });
      const boss = await bossCtx.newPage(); boss.setDefaultTimeout(6000);
      await boss.route("https://media.forgecdn.net/**", (r) => r.fulfill({ status: 200, contentType: "image/svg+xml", body: "<svg xmlns='http://www.w3.org/2000/svg'/>" }));
      await boss.goto(url); await boss.fill("#pw", PASSWORD); await boss.click('button[type="submit"]'); await boss.waitForSelector("#view .page");
      const made = await bossCtx.request.post(url + "api/account", { data: { op: "signup", email: "owner@example.test", password: pass, name: "The Owner", over13: true } });
      if (!made.ok()) await bossCtx.request.post(url + "api/account", { data: { op: "login", email: "owner@example.test", password: pass } });
      const refused = await ctx.request.post(url + "api/account", { data: { op: "keep", list: "saved", id: "cozy-farmer", on: true } });
      if (refused.status() !== 401) bad("an item was saved to an account without signing in (status " + refused.status() + ")");
      await go("you"); await p.waitForSelector("#f-acct");
      await p.click("#f-acct > summary"); await p.click('[data-action="signup"]');
      await audit("make an account");
      await p.fill("#a-name", "Test Player"); await p.fill("#a-email", email); await p.fill("#a-pass", pass);
      expecting401 = true; // refused sign-ups and sign-ins are meant to be refused
      await p.click('#acct button[type="submit"]'); await p.waitForSelector("#a-err:not([hidden])");
      if (!/13 and up/.test(await p.textContent("#a-err"))) bad("an account was allowed without confirming age 13 or older");
      await p.check("#a-age"); await p.fill("#a-pass", "short"); await p.click('#acct button[type="submit"]'); await p.waitForFunction(() => /8 characters/.test(document.querySelector("#a-err").textContent));
      await p.fill("#a-name", "call 5551234567"); await p.fill("#a-pass", pass); await p.click('#acct button[type="submit"]'); await p.waitForFunction(() => /friendlier/.test(document.querySelector("#a-err").textContent));
      expecting401 = false;
      await p.fill("#a-name", "Test Player"); await p.click('#acct button[type="submit"]'); await p.waitForSelector("#acct-who");
      if (!/Test Player/.test(await p.textContent("#acct-who"))) bad("signed-in name is not shown");
      await audit("signed in");
      // "It did not work": on every mod of the playpack, with a reason, and it can be taken back
      await go("pack-cozy-farmer"); await p.waitForSelector(".mod summary");
      if (await count(".mod .brokenbtn") !== await count(".mod")) bad("not every mod in the playpack can be reported as not working");
      const firstMod = (await p.locator(".mod h4").first().textContent()).trim();
      await p.click(".mod summary >> nth=0"); await p.click(".mod .brokenbtn >> nth=0"); await p.waitForSelector(".whys");
      if (await count(".whys .btn") !== 4 || !(await p.textContent("#sheet")).includes(firstMod)) bad("the report sheet does not name the mod or offer four reasons");
      await audit("what went wrong"); if (out) await p.screenshot({ path: `${out}/${tag}-broken.png` });
      await p.click('.whys [data-why="1"]'); await p.waitForFunction(() => /Thank you/.test(document.querySelector("#toast").textContent));
      await p.waitForSelector('.mod .brokenbtn[aria-pressed="true"]');
      if (await count('.brokenbtn[aria-pressed="true"]') !== 1 || !/You said this did not work/.test(await p.textContent('.brokenbtn[aria-pressed="true"]'))) bad("a reported mod is not marked, in words, as reported");
      await audit("pack with a reported mod"); if (out) await p.screenshot({ path: `${out}/${tag}-pack-reported.png`, fullPage: true });
      await p.reload(); await p.waitForSelector(".mod .mflag:has-text('Reported')"); // remembered on the account, and marked on the closed row
      if (await p.locator(".mod-more").first().isVisible()) bad("mod rows do not start closed after reloading");
      // the owner sees the report: which mod, how many, in which playpack and why, and can clear it
      { await boss.goto(url + "#you"); await boss.reload(); await boss.waitForSelector("#h-broken"); await boss.waitForFunction((n) => document.querySelector(".brow").textContent.includes(n), firstMod);
        const row = await boss.textContent(".brow"), auditBoss = makeAudit(boss, bad);
        if (!/1 of 3 reports/.test(row) || !/The cozy farmer/.test(row) || !/crashed/.test(row) || /Benched/.test(row) || /Test Player/.test(row)) bad("the owner's list of reported mods is wrong: " + row.slice(0, 160));
        await auditBoss("owner: reported mods"); if (out) await boss.locator("#f-queue").screenshot({ path: `${out}/${tag}-owner-broken.png` });
        await boss.click('[data-action="brokenclear"]'); await boss.waitForFunction(() => !document.querySelector(".brow"));
        await p.reload(); await p.waitForSelector(".mod summary"); if (await count('.brokenbtn[aria-pressed="true"]')) bad("the owner cleared the reports but the player still sees theirs");
        await p.click(".mod summary >> nth=0"); await p.click(".mod .brokenbtn >> nth=0"); await p.click('.whys [data-why="0"]'); await p.waitForSelector('.mod .brokenbtn[aria-pressed="true"]'); }
      await p.click('.mod .brokenbtn[aria-pressed="true"]'); await p.waitForFunction(() => /taken back/.test(document.querySelector("#toast").textContent));
      if (await count('.brokenbtn[aria-pressed="true"]')) bad("a report could not be taken back");
      // the badge for mod makers: a picture, a code to paste, and a link to this playpack
      await p.click("#badge-offer button"); await p.waitForSelector("#badge-code");
      const badgeCode = await p.inputValue("#badge-code");
      if (!badgeCode.includes('href="' + url + 'p/cozy-farmer"') || !badgeCode.includes('src="https://hymeta.vercel.app/picked-by-hex.png"') || !/alt="Picked by Hex on HyMeta"/.test(badgeCode)) bad("the badge code does not link to this playpack or show the badge: " + badgeCode);
      if (!(await p.evaluate(async () => { const i = document.querySelector(".badge-pic"); if (!i.complete) await new Promise((r) => { i.onload = i.onerror = r; }); return i.naturalWidth === 480 && i.naturalHeight === 150; }))) bad("the badge picture did not load");
      await audit("badge for mod makers"); if (out) await p.screenshot({ path: `${out}/${tag}-badge.png` });
      await p.click('[data-copy="code"]'); await p.waitForFunction(() => /Badge code copied/.test(document.querySelector("#toast").textContent));
      if ((await p.evaluate(() => navigator.clipboard.readText())) !== badgeCode) bad("Copy the badge code copied something else");
      await p.click('[data-copy="link"]'); await p.waitForFunction(() => /Link copied/.test(document.querySelector("#toast").textContent));
      if ((await p.evaluate(() => navigator.clipboard.readText())) !== url + "p/cozy-farmer") bad("Copy just the link copied something else");
      await p.keyboard.press("Escape"); await go("you"); await p.waitForSelector("#acct-who, #f-acct");
      // what was saved on this device before signing up is now in the account, on any device
      const other = await b.newContext({ viewport: { width: w, height: h }, colorScheme: scheme });
      const q = await other.newPage(); await q.route("https://media.forgecdn.net/**", (r) => r.fulfill({ status: 200, contentType: "image/svg+xml", body: "<svg xmlns='http://www.w3.org/2000/svg'/>" }));
      q.setDefaultTimeout(6000);
      await q.goto(url); await q.fill("#pw", PASSWORD); await q.click('button[type="submit"]'); await q.waitForSelector("#view .page");
      await q.goto(url + "#you"); await q.waitForSelector("#f-acct"); await q.click("#f-acct > summary"); await q.click('[data-action="signin"]');
      if (await q.locator('[data-action="forgot"], #a-news, #news-on').count()) bad("password reset or the weekly email is offered with no email service connected");
      await q.fill("#a-email", email); await q.fill("#a-pass", "not-the-password"); await q.click('#acct button[type="submit"]'); await q.waitForSelector("#a-err:not([hidden])");
      if (await q.locator("#acct-who").count()) bad("a wrong account password was accepted");
      await q.fill("#a-pass", pass); await q.click('#acct button[type="submit"]'); await q.waitForSelector("#acct-who");
      await q.click("#tier-member"); await q.goto(url + "#saved"); await q.click('[data-tab="mods"]');
      try { await q.waitForSelector("#view .mod"); } catch (e) { bad("a mod saved before signing up did not follow the account to a second device"); }
      // a playpack sent from one signed-in device is waiting on the other
      await p.goto(url + "#home"); await p.waitForSelector('.hero-side [data-action="play"]'); await p.click('.hero-side [data-action="play"]'); await p.click('[data-mode="send"]'); await p.waitForSelector("#code-also"); await p.waitForTimeout(400); await p.keyboard.press("Escape");
      await q.goto(url + "#home"); await q.reload(); await q.waitForSelector("#view .page");
      try { await q.waitForSelector("#upnext .pk"); } catch (e) { bad("a playpack sent from one device is not waiting on the other"); }
      // a playpack saved on the second device shows on the first
      await q.goto(url + "#pack-the-wanderer"); await q.waitForSelector('.actions [data-action="save"]'); await q.click('.actions [data-action="save"]'); await q.waitForTimeout(400);
      await p.reload(); await p.waitForSelector("#view .page"); await go("saved"); await p.waitForSelector("#view .pk");
      if (!(await p.textContent("#view")).includes("The wanderer")) bad("a playpack saved on one device did not show on the other");
      await go("you"); if (await count(".stamp, #h-card")) bad("you: the stamp card is still shown");
      // ---------- community playpacks ----------
      await go("build"); await p.waitForSelector(".pickrow"); await audit("live build, signed in");
      await p.fill("#bq", "fishing"); await p.waitForFunction(() => document.querySelectorAll(".pickrow").length === 7);
      await p.check(".pickrow input"); await p.click("#bq-clear"); await p.waitForFunction(() => document.querySelectorAll(".pickrow").length > 7);
      if (!/1 picked/.test(await p.textContent("#b-status"))) bad("live build lost the picked mod");
      if (out) await p.screenshot({ path: `${out}/${tag}-build.png`, fullPage: true });
      await p.fill("#b-name", "Swamp <i>wizard</i>"); await p.fill("#b-blurb", "Mud and magic.");
      for (const box of await p.locator(".pickrow input").all()) { if (!(await box.isChecked())) await box.check(); if ((await p.locator(".pickrow input:checked").count()) >= 3) break; }
      await p.click('#build button[type="submit"]'); await p.waitForSelector("#review-note");
      const mine = p.url().split("#")[1];
      if (await count('[data-action="approve"], #owner-review')) bad("a member can approve their own playpack");
      const sneak = await ctx.request.post(url + "api/community", { data: { op: "review", id: mine.replace("pack-", ""), approve: true } });
      if (sneak.status() !== 403) bad("a member who is not the owner could review a playpack (status " + sneak.status() + ")");
      // the owner sees it in the review queue, nobody else sees it anywhere
      await boss.reload(); await boss.waitForSelector("#view .page"); await boss.click("#tier-member");
      await boss.goto(url + "#explore"); await boss.waitForTimeout(400);
      if (await boss.locator(`a[href="#${mine}"]`).count()) bad("a playpack still waiting for review is listed for other members");
      await boss.goto(url + "#you"); await boss.waitForSelector("#f-queue .qrow");
      if (!/Swamp <i>wizard<\/i>/.test(await boss.textContent("#f-queue")) || await boss.locator("#f-queue i").count()) bad("the review queue does not show the waiting playpack as plain text");
      const bossAudit = makeAudit(boss, bad); await bossAudit("owner review queue");
      await boss.click('#f-queue [data-action="review"][data-ok="1"]'); await boss.waitForSelector("#queue-empty");
      await boss.goto(url + "#explore"); await boss.waitForSelector(`a[href="#${mine}"]`);
      await boss.click(`a[href="#${mine}"]`); await boss.waitForSelector(".mod");
      if (!/Shared by Test Player/.test(await boss.textContent("#view"))) bad("a shared playpack does not name its builder");
      await bossAudit("shared playpack");
      await p.reload(); await p.waitForSelector("#view .page"); await p.waitForFunction(() => /Approved\. Other members/.test(document.querySelector("#view").textContent));
      // a report hides it for the reporter and lands in the owner's queue, where it can be removed
      await boss.click('[data-action="report"]'); await boss.click('#report button[type="submit"]'); await boss.waitForFunction(() => location.hash === "#explore"); await boss.waitForTimeout(400);
      if (await boss.locator(`a[href="#${mine}"]`).count()) bad("a reported playpack is still listed for the member who reported it");
      await boss.goto(url + "#you"); await boss.waitForSelector("#f-queue .qrow");
      await boss.click('#f-queue [data-action="review"][data-ok="0"]'); await boss.waitForSelector("#queue-empty");
      await p.reload(); await p.waitForSelector("#view .page"); await p.waitForFunction(() => /Not approved/.test(document.querySelector("#view").textContent));
      await bossCtx.close();
      // deleting the account signs out every device and the login stops working
      await go("you"); await p.waitForSelector("#f-acct"); await p.click("#f-acct > summary"); await p.click('[data-action="delacct"]'); await p.click('[data-action="delacct"]'); await p.waitForSelector('[data-action="signup"]');
      const after = await (await other.request.get(url + "api/account")).json();
      if (after.user) bad("the account was deleted but another device is still signed in");
      const again = await other.request.post(url + "api/account", { data: { op: "login", email, password: pass } });
      if (again.status() !== 400) bad("a deleted account can still sign in (status " + again.status() + ")");
      await other.close();
      if (leaked.size) bad("the CurseForge key was sent to the browser by " + [...leaked].join(", "));
    } catch (e) { if (process.env.HYMETA_DEBUG) console.log("DEBUG", p.url(), (await p.textContent("#view").catch(() => "")).slice(0, 300)); bad("stopped early, a step could not be done: " + e.message.split("\n").slice(0, 4).join(" ").replace(/\s+/g, " ").slice(0, 260)); }
    await ctx.close();
  }
  server.close();

  // ---------- the front door, open: the switch that takes the password away ----------
  server = await start({ pretend: true, password: PASSWORD, key: "pretend-key", open: true });
  url = server.url;
  if (!only || only === "open-phone-dark") {
    const tag = "open-phone-dark", ctx = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark", deviceScaleFactor: 1, hasTouch: true });
    const p = await ctx.newPage(); const bad = (m) => problems.push(`${tag} ${m}`);
    await p.route("https://media.forgecdn.net/**", (r) => r.fulfill({ status: 200, contentType: "image/svg+xml", body: "<svg xmlns='http://www.w3.org/2000/svg'/>" }));
    p.on("console", (m) => { if (m.type() === "error") bad("console: " + m.text()); }); p.on("pageerror", (e) => bad("page error: " + e.message)); p.setDefaultTimeout(6000);
    const audit = makeAudit(p, bad), count = (sel) => p.locator(sel).count();
    try {
      await p.goto(url); await p.waitForSelector("#come-in"); await audit("open front door");
      if (await count("#pw")) bad("the open front door still asks for a password");
      for (let i = 0; i < 3; i++) await p.click(`.opt[data-q="${i}"][data-a="0"]`);
      await p.click("#take-me"); await p.waitForSelector("#view .page");
      if (!/#pack-cozy-farmer$/.test(p.url())) bad("Take me there did not open the playstyle Hex picked: " + p.url());
      await p.waitForSelector(".mod"); // live mods load for a visitor who never typed a password
      await p.goto(url); await p.waitForSelector("#view .page"); if (await count("#come-in")) bad("a returning visitor is shown the front door again");
      await p.goto(url + "?door=1"); await p.waitForSelector("#come-in");
    } catch (e) { bad("stopped early, a step could not be done: " + e.message.split("\n").slice(0, 4).join(" ").replace(/\s+/g, " ").slice(0, 260)); }
    await ctx.close();
  }
  server.close();

  // ---------- a new week: week 1, the first one settled by a weekly run ----------
  // Everything expected here is read from the app's own list, so it stays right as playpacks are added.
  // The browser's own clock says a different week, so passing also proves the server's week wins.
  server = await start({ pretend: true, password: PASSWORD, key: "pretend-key", accounts: true, week: 1 });
  url = server.url;
  const now = CARD[ROTA[1]], before = CARD[ROTA[0]], next = CARD[ROTA[2]], later = CARD[ROTA[3]], voting = !!catalog.poll && catalog.poll.week === 2;
  for (const [tag, w, h, scheme] of [["week-phone-light", 390, 844, "light"], ["week-tablet-dark", 820, 1180, "dark"], ["week-desktop-light", 1366, 900, "light"]]) {
    if (only && only !== tag) continue;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: 1, hasTouch: w < 500 });
    const p = await ctx.newPage(); const bad = (m) => problems.push(`${tag} ${m}`);
    await p.route("https://media.forgecdn.net/**", (r) => r.fulfill({ status: 200, contentType: "image/svg+xml", body: "<svg xmlns='http://www.w3.org/2000/svg'/>" }));
    p.on("console", (m) => { if (m.type() === "error" && !/40[014]/.test(m.text())) bad("console: " + m.text()); }); p.on("pageerror", (e) => bad("page error: " + e.message)); p.setDefaultTimeout(6000);
    const audit = makeAudit(p, bad), count = (sel) => p.locator(sel).count();
    const loaded = () => p.evaluate(async () => { const imgs = [...document.querySelectorAll("img.art, .free img")]; imgs.forEach((i) => { i.loading = "eager"; }); await Promise.all(imgs.map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))); return imgs.filter((i) => !i.naturalWidth).map((i) => i.getAttribute("src")); });
    try {
      await p.goto(url); await p.waitForSelector("#free-name");
      if ((await p.textContent("#free-name")) !== now.name || (await p.textContent("#h-free")) !== "New and free this week") bad("the front door does not show this week's new playpack");
      if ((await loaded()).length) bad("the front door picture for this week's playpack did not load"); await audit("front door, new week");
      await signIn(p, bad); await p.waitForFunction((n) => document.querySelector("#h-week").textContent.includes(n), now.name);
      if (!/New and free this week/.test(await p.textContent(".hero-top"))) bad("home: the new playpack is not marked as new and free");
      await p.waitForSelector(".hero-side .chip:has-text('mods')"); // its mods arrive from the live recipe
      if ((await p.textContent("#view")).includes(next.name)) bad("home: next week's playpack is named before its week");
      if (voting) { if (await count("#coming")) bad("home: a hint is given about next week while next week is still being voted on"); }
      else if (!(await p.textContent("#coming")).includes(next.hint)) bad("home: Hex's hint about next week is missing");
      const teasers = await p.locator("section[aria-labelledby='h-shelf'] .pk-name").allTextContents();
      if (teasers.length !== 3 || teasers.includes(now.name)) bad("home: Also this week should show three other playpacks, showed: " + teasers.join(" | "));
      const missing = await loaded(); if (missing.length) bad("home: pictures did not load: " + missing.join(", "));
      await audit("home, new week"); if (out) await p.screenshot({ path: `${out}/${tag}-home.png`, fullPage: true });
      // the vote: it needs an account, and counts one vote each
      if (catalog.poll && catalog.poll.week > 1) {
        const ideas = catalog.poll.ideas, email = tag + "-voter@example.test";
        if ((await p.textContent("#h-poll")) !== (voting ? "Vote for next week's playpack" : "Vote for the playpack after next")) bad("home: the vote is headed wrongly: " + await p.textContent("#h-poll"));
        if (await count("#poll .vote") !== 3 || !(await p.textContent("#poll")).includes(ideas[0].name) || !(await p.textContent("#poll")).includes(ideas[2].line)) bad("home: the vote does not show its three ideas");
        await p.click(`.vote[data-id="${ideas[0].id}"]`); await p.waitForSelector("#acct"); // signed out: asked to make an account first
        if ((await ctx.request.post(url + "api/account", { data: { op: "vote", idea: ideas[0].id } })).status() !== 401) bad("a vote was counted without an account");
        await p.fill("#a-name", "Keen Voter"); await p.fill("#a-email", email); await p.fill("#a-pass", "correct-horse-9"); await p.check("#a-age"); await p.click('#acct button[type="submit"]'); await p.waitForSelector("#poll");
        const before = (await (await b.newContext()).request.get(url + "api/mail?poll=1").then((r) => r.json())).ideas.reduce((a, i) => a + i.votes, 0), had = before + 1;
        // voting: Hex says thank you, once, and the vote goes away until the next one opens
        await p.click(`.vote[data-id="${ideas[0].id}"]`); await p.waitForSelector("#poll-thanks");
        if (await count("#poll, .vote")) bad("home: the vote is still on screen after voting");
        const thanks = await p.textContent("#poll-thanks");
        if (!/thank you/i.test(await p.textContent("#poll-thanks .hex .line")) || !thanks.includes(ideas[0].name) || !/Thursday/.test(thanks)) bad("home: Hex does not say thank you, or does not say what was voted for: " + thanks.slice(0, 120));
        await audit("vote, after voting"); if (out) await p.screenshot({ path: `${out}/${tag}-vote.png` });
        await p.goto(url + "#explore"); await p.waitForSelector("#results .pk"); await p.goto(url + "#home"); await p.waitForSelector("#h-week");
        if (await count("#poll, #poll-thanks, .vote")) bad("home: the vote or the thank-you came back after looking at another page");
        await p.reload(); await p.waitForSelector("#h-week"); await p.waitForTimeout(500);
        if (await count("#poll, #poll-thanks, .vote")) bad("home: the vote came back after reloading, for a player who has already voted");
        if ((await (await ctx.request.get(url + "api/account")).json()).poll.mine !== ideas[0].id) bad("the vote was not kept on the account");
        const open = await (await b.newContext()).request.get(url + "api/mail?poll=1"), tally = await open.json();
        if (open.status() !== 200 || tally.poll !== catalog.poll.id || tally.ideas.reduce((a, i) => a + i.votes, 0) !== had || /voter|example\.test/i.test(JSON.stringify(tally))) bad("the weekly run cannot read the vote totals, or they say who voted: " + JSON.stringify(tally).slice(0, 160));
      } else if (await count("#poll")) bad("home: a vote is shown that has already been decided");
      await p.goto(url + "#explore"); await p.waitForSelector("#results .pk");
      const names = await p.locator("#results .pk .pk-name").allTextContents();
      for (const n of [before.name, now.name, "The cozy farmer"]) if (!names.includes(n)) bad("explore: " + n + " should be on the shelf in week 1");
      for (const n of [next.name, later.name]) if (names.includes(n)) bad("explore: " + n + " is on the shelf before its week");
      if (names.length !== catalog.base.length + 2) bad("explore: expected " + (catalog.base.length + 2) + " playpacks in week 1, found " + names.length);
      if (await count("#results .pk-new") !== 1 || !(await p.textContent("#results .pk:has(.pk-new)")).includes(now.name)) bad("explore: only this week's playpack should be marked new");
      if (await p.inputValue("#sort") !== "new") bad("explore: newest first is not the order it opens in"); await p.waitForTimeout(150);
      const newest = await p.locator("#results .pk .pk-name").allTextContents();
      if (newest.slice(0, 2).join(" | ") !== now.name + " | " + before.name) bad("explore: Newest first is in the wrong order: " + newest.slice(0, 4).join(" | "));
      const lost = await loaded(); if (lost.length) bad("explore: pictures did not load: " + lost.join(", "));
      await audit("explore, newest first"); if (out) await p.screenshot({ path: `${out}/${tag}-explore.png`, fullPage: true });
      await p.goto(url + "#pack-" + ROTA[2]); await p.waitForSelector("#view h1");
      if (!/not on the shelf/.test(await p.textContent("#view h1")) || await count(".mod")) bad("next week's playpack opens when its address is typed in");
      if ((await ctx.request.get(url + "api/pack?id=" + ROTA[2])).status() !== 404) bad("the server hands out next week's playpack");
      // this week's playpack: a mod published in the last two months is marked as a new arrival, in words
      await p.goto(url + "#pack-" + ROTA[1]); await p.waitForSelector(".mod");
      if (ROTA[1] === "scenic-route" && !(await p.locator(".mod:has(.newmod) summary .mflag:has-text('New')").isVisible())) bad("a new arrival is not marked on its closed row");
      if (ROTA[1] === "scenic-route" && (await count(".mod .newmod") !== 1 || !/New arrival/.test(await p.textContent(".mod:has(.newmod)")) || !/Waterfall Newcomer/.test(await p.textContent(".mod:has(.newmod)")))) bad("the new mod in this week's playpack is not marked as a new arrival");
      await audit("this week's playpack, with a new arrival"); if (out) await p.screenshot({ path: `${out}/${tag}-pack.png`, fullPage: true });
      await p.goto(url + "#pack-" + ROTA[0]); await p.waitForSelector('.actions [data-action="join"]'); await audit("a past week's playpack"); // members only now
      if (await count(".pk-new, .badge:has-text('New')")) bad("a past week's playpack is still marked new");
    } catch (e) { bad("stopped early, a step could not be done: " + e.message.split("\n").slice(0, 4).join(" ").replace(/\s+/g, " ").slice(0, 260)); }
    await ctx.close();
  }
  server.close();

  // ---------- email: password reset and the weekly email, with a pretend email service ----------
  server = await start({ pretend: true, password: PASSWORD, key: "pretend-key", accounts: true, mail: true });
  url = server.url; process.env.SITE_URL = url.replace(/\/$/, "");
  for (const [tag, w, h, scheme] of [["mail-phone-light", 390, 844, "light"], ["mail-desktop-dark", 1366, 900, "dark"]]) {
    if (only && only !== tag) continue;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: 1, hasTouch: w < 500 });
    const p = await ctx.newPage(); const bad = (m) => problems.push(`${tag} ${m}`);
    await p.route("https://media.forgecdn.net/**", (r) => r.fulfill({ status: 200, contentType: "image/svg+xml", body: "<svg xmlns='http://www.w3.org/2000/svg'/>" }));
    p.on("console", (m) => { if (m.type() === "error" && !/40[01]/.test(m.text())) bad("console: " + m.text()); }); p.on("pageerror", (e) => bad("page error: " + e.message)); p.setDefaultTimeout(6000);
    const audit = makeAudit(p, bad), count = (sel) => p.locator(sel).count();
    const email = tag + "@example.test", linkTo = (kind) => { const m = [...server.outbox].reverse().find((x) => x.to === email && x.text.includes("?" + kind + "=")); return m ? m.text.match(new RegExp("http://localhost:\\d+/api/mail\\?" + kind + "=[a-f0-9]+"))[0] : ""; };
    try {
      await signIn(p, bad);
      await p.goto(url + "#you"); await p.waitForSelector("#f-acct"); await p.click("#f-acct > summary"); await p.click('[data-action="signup"]');
      await p.fill("#a-name", "Mail Tester"); await p.fill("#a-email", email); await p.fill("#a-pass", "first-password-1"); await p.check("#a-age");
      if (await p.isChecked("#a-news")) bad("the weekly email box is ticked before the member chooses it");
      await p.check("#a-news"); await audit("sign up with weekly email"); await p.click('#acct button[type="submit"]'); await p.waitForSelector("#acct-who");
      if (!(await p.isChecked("#news-on"))) bad("the weekly email choice made at sign-up is not shown under Account");
      await audit("account with weekly email");
      // the weekly email arrives, and its link stops it
      await ctx.request.get(url + "api/mail");
      const stop = linkTo("unsub"); if (!stop) bad("no weekly email arrived for a member who asked for it");
      await p.goto(stop); await p.waitForSelector("#go"); await audit("stop the weekly email page"); if (out) await p.screenshot({ path: `${out}/${tag}-unsub.png` });
      await p.click("#go"); await p.waitForSelector("#done:not([hidden])"); await audit("weekly email stopped");
      await p.click("#done a.btn"); await p.waitForSelector("#view .page"); await p.goto(url + "#you"); await p.waitForSelector("#f-acct"); await p.click("#f-acct > summary"); await p.waitForSelector("#news-on");
      if (await p.isChecked("#news-on")) bad("the weekly email still shows as on after stopping it");
      await p.check("#news-on"); await p.waitForFunction(() => /Weekly email is on/.test(document.querySelector("#toast").textContent));
      await p.reload(); await p.waitForSelector("#f-acct"); await p.click("#f-acct > summary"); await p.waitForSelector("#news-on");
      if (!(await p.isChecked("#news-on"))) bad("switching the weekly email back on under Account did not save");
      // forgotten password, start to finish
      await p.click('[data-action="signout"]'); await p.waitForSelector('#f-acct [data-action="signin"]'); await p.click('#f-acct [data-action="signin"]');
      await p.click('[data-action="forgot"]'); await p.waitForSelector("#forgot"); await audit("forgot password");
      await p.click('#forgot button[type="submit"]'); await p.waitForSelector("#fg-err:not([hidden])");
      await p.fill("#fg-email", email); await p.click('#forgot button[type="submit"]'); await p.waitForSelector("#fg-sent"); await audit("reset link sent");
      const reset = linkTo("reset"); if (!reset) bad("no reset email arrived");
      await p.goto(reset); await p.waitForSelector("#pw"); await audit("choose a new password page"); if (out) await p.screenshot({ path: `${out}/${tag}-reset.png` });
      await p.fill("#pw", "short"); await p.click('#f button[type="submit"]'); await p.waitForSelector("#err:not([hidden])"); await audit("new password refused");
      await p.check("#show"); if ((await p.getAttribute("#pw", "type")) !== "text") bad("Show the password does not show it");
      await p.fill("#pw", "second-password-2"); await p.click('#f button[type="submit"]'); await p.waitForSelector("#done:not([hidden])"); await audit("password changed");
      await p.click("#done a.btn"); await p.waitForSelector("#view .page"); await p.goto(url + "#you"); await p.waitForSelector("#f-acct"); await p.click("#f-acct > summary"); await p.click('#f-acct [data-action="signin"]');
      await p.fill("#a-email", email); await p.fill("#a-pass", "first-password-1"); await p.click('#acct button[type="submit"]'); await p.waitForSelector("#a-err:not([hidden])");
      await p.fill("#a-pass", "second-password-2"); await p.click('#acct button[type="submit"]'); await p.waitForSelector("#acct-who");
      await p.goto(reset); await p.waitForSelector("#pw"); await p.fill("#pw", "third-password-3"); await p.click('#f button[type="submit"]'); await p.waitForSelector("#err:not([hidden])");
      if (!/already used/.test(await p.textContent("#err"))) bad("a used reset link does not say it was already used");
    } catch (e) { bad("stopped early, a step could not be done: " + e.message.split("\n").slice(0, 4).join(" ").replace(/\s+/g, " ").slice(0, 260)); }
    await ctx.close();
  }
  server.close(); delete process.env.SITE_URL;

  // ---------- payments: the same site with a pretend Stripe ----------
  server = await start({ pretend: true, password: PASSWORD, key: "pretend-key", accounts: true, payments: true });
  url = server.url;
  for (const [tag, w, h, scheme] of [["pay-phone-dark", 390, 844, "dark"], ["pay-desktop-light", 1366, 900, "light"]]) {
    if (only && only !== tag) continue;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: 1, hasTouch: w < 500 });
    const p = await ctx.newPage(); const bad = (m) => problems.push(`${tag} ${m}`);
    for (const host of ["https://media.forgecdn.net/**", "https://checkout.stripe.test/**", "https://billing.stripe.test/**"]) await p.route(host, (r) => r.fulfill({ status: 200, contentType: host.includes("forgecdn") ? "image/svg+xml" : "text/html", body: host.includes("forgecdn") ? "<svg xmlns='http://www.w3.org/2000/svg'/>" : "<h1>Pretend Stripe page</h1>" }));
    p.on("console", (m) => { if (m.type() === "error" && !/40[013]/.test(m.text())) bad("console: " + m.text()); });
    p.on("pageerror", (e) => bad("page error: " + e.message));
    p.setDefaultTimeout(6000);
    const audit = makeAudit(p, bad), count = (sel) => p.locator(sel).count();
    try {
      await signIn(p, bad);
      const post = (data) => ctx.request.post(url + "api/account", { data });
      if (!(await post({ op: "signup", email: "owner@example.test", password: "correct-horse-9", name: "The Owner", over13: true })).ok()) {} // the first account is the owner
      await post({ op: "logout" });
      const email = tag + "@example.test"; await post({ op: "signup", email, password: "correct-horse-9", name: "Paying Player", over13: true });
      await p.reload(); await p.waitForSelector(".notice:has-text('live mods')"); await p.waitForFunction(() => document.querySelector(".viewas").hidden);
      // free: other playpacks are locked, and there is no preview switch to flip
      await p.goto(url + "#pack-dungeon-gremlin"); await p.waitForSelector('.actions [data-action="join"]');
      if (await count(".mod")) bad("a free account sees a members-only playpack");
      await p.click('.actions [data-action="join"]'); await audit("membership sheet, payments on");
      const sheetText = await p.textContent("#sheet");
      for (const need of ["$3.99", "$24.99", "renews automatically", "Apple Pay", "secure Stripe page"]) if (!sheetText.includes(need)) bad("membership sheet is missing: " + need);
      if (/Preview only/.test(sheetText)) bad("the membership sheet still says no payment is taken");
      // pay: grown-up question, then off to Stripe's page
      await p.click('[data-action="pay"]');
      const nums = (await p.textContent('label[for="gate-in"]')).match(/\d+/g).map(Number);
      await p.fill("#gate-in", String(nums[0] * nums[1])); await p.click('#gate button[type="submit"]');
      await p.waitForURL("https://checkout.stripe.test/**");
      const sessionId = p.url().split("/").pop();
      if (server.stripe.state.sessions[sessionId].price !== server.stripe.state.prices.find((x) => x.lookup_key === "hymeta_yearly").id) bad("the yearly plan was chosen but a different price was charged");
      // Stripe confirms the payment, the member comes back, and everything is open
      await ctx.request.post(url + "api/billing", { data: server.stripe.pay(sessionId) });
      await p.goto(url + "?paid=1#pack-dungeon-gremlin"); await p.waitForSelector(".mod");
      if (/paid=1/.test(p.url())) bad("the address still carries the payment marker after returning");
      await p.goto(url + "#you"); await p.waitForSelector("#f-mem"); await p.click("#f-mem > summary"); await p.waitForSelector("#mem-on"); await audit("member, payments on");
      await p.click('[data-action="portal"]'); await p.waitForURL("https://billing.stripe.test/**");
      // the membership ends: locked again
      const customer = server.stripe.state.sessions[sessionId].customer;
      await ctx.request.post(url + "api/billing", { data: server.stripe.end(customer) });
      await p.goto(url + "#pack-dungeon-gremlin"); await p.waitForSelector('.actions [data-action="join"]');
      if (await count(".mod")) bad("a cancelled membership still opens members-only playpacks");
    } catch (e) { bad("stopped early, a step could not be done: " + e.message.split("\n").slice(0, 4).join(" ").replace(/\s+/g, " ").slice(0, 260)); }
    await ctx.close();
  }
  server.close();
  await b.close();
  console.log(problems.length ? problems.join("\n") : "NO PROBLEMS");
  process.exit(problems.length ? 1 : 0);
})();
