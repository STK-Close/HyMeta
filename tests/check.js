// Starts HyMeta's own server with a pretend CurseForge, then opens the app in a real browser at
// phone, tablet and desktop sizes, in light and dark, clicks through every main flow and reports
// anything broken. First with sample mods (no key), then with live-style mods (key set).
// Run: node tests/check.js [screenshot folder] [only, e.g. phone-light]
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const { start } = require("../scripts/dev-server");
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
      if (await count("#view, .mod")) bad("the front door shows parts of the app before the password");
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
    } catch (e) { bad("stopped early, a step could not be done: " + e.message.split("\n").slice(0, 4).join(" ").replace(/\s+/g, " ").slice(0, 260)); }
    await ctx.close();
  }
  for (const scheme of ["light", "dark"]) for (const [name, [w, h]] of Object.entries(sizes)) {
    const tag = `${name}-${scheme}`;
    if (only && only !== tag) continue;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: 1, hasTouch: name !== "desktop" });
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
    await p.click(".hex .face"); if (!/^Hex: /.test(await p.textContent("#toast"))) bad("home: tapping Hex's face does nothing");
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
    await p.click('[data-family="magic"]'); await p.waitForTimeout(220);
    if (await p.inputValue("#fam") !== "magic" || await count("#results .pk") !== 1) bad("playstyle tile did not filter to the 1 magic pack");
    await go("home");
    // dare tiles filter the shelf
    await p.click('[data-dare="3"]'); await p.waitForTimeout(220);
    if (await p.inputValue("#filter") !== "3" || await count("#results .pk") !== 3) bad("dare tile did not filter to 3 packs");
    await p.selectOption("#filter", "all");

    // locked pack in the free view
    await go("pack-too-many-legs"); await audit("locked pack"); await shot("locked");
    if (await count(".mod")) bad("locked pack shows its mods to free players");

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

    // save a playpack and a mod, collect a stamp
    await p.click('[data-action="save"]'); await p.click('[data-action="savemod"]'); await p.click('[data-action="stamp"]'); await p.waitForTimeout(550);
    await go("saved"); await audit("saved playpacks"); await shot("saved-packs");
    if (await count("#view .pk") !== 1) bad("saved playpacks list is wrong");
    await p.click('[data-tab="mods"]'); await audit("saved mods"); await shot("saved-mods");
    if (await count("#view .mod") !== 1) bad("saved mods list is wrong");
    await p.click('[data-tab="packs"]'); await p.click(".pk-heart"); await p.waitForTimeout(150);
    if (await count("#view .pk") !== 0 || !(await count("#view .panel"))) bad("heart in Saved did not remove the playpack");

    // explore: grouped by playstyle, sortable, and a surprise button
    await go("explore"); await audit("explore"); await shot("explore");
    if (await count(".fam-group") < 6) bad("explore: playpacks are not grouped under playstyle headings");
    await p.selectOption("#sort", "az");
    const order = await p.locator("#results .shelf").first().locator(".pk-name").allTextContents();
    if (order.length < 10 || order.join("|") !== order.slice().sort((x, y) => x.localeCompare(y)).join("|")) bad("explore: A to Z sorting is wrong: " + order.slice(0, 4).join(", "));
    await p.selectOption("#sort", "wild"); if ((await p.locator("#results .pk .chip").first().textContent()).indexOf("Send help") < 0) bad("explore: wildest first does not start with a send help playpack");
    await p.selectOption("#sort", "style");
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
    const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: 1, hasTouch: w < 500 });
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
      await audit("install finished"); await p.click('[data-action="stampdone"]'); await p.waitForFunction(() => /Stamp collected/.test(document.querySelector("#inst-done").textContent));
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
      if (!/Chosen for Hytale 0\.7/.test(text) || !/Hytale 0\.7/.test(await p.textContent(".mod .meta"))) bad("game version is not shown");
      const href = await p.getAttribute(".mod a.linkbtn", "href"); if (!/^https:\/\/www\.curseforge\.com\/hytale\/mods\//.test(href)) bad("mod link does not go to its CurseForge page: " + href);
      // a mod that may not work with the current game says so on its card
      await p.click("#tier-member"); await go("pack-wizard-dropout"); await p.waitForSelector(".mod");
      if (!(await count(".mod .caution"))) bad("an out-of-date mod carries no warning");
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
      // what was saved on this device before signing up is now in the account, on any device
      const other = await b.newContext({ viewport: { width: w, height: h }, colorScheme: scheme });
      const q = await other.newPage(); await q.route("https://media.forgecdn.net/**", (r) => r.fulfill({ status: 200, contentType: "image/svg+xml", body: "<svg xmlns='http://www.w3.org/2000/svg'/>" }));
      q.setDefaultTimeout(6000);
      await q.goto(url); await q.fill("#pw", PASSWORD); await q.click('button[type="submit"]'); await q.waitForSelector("#view .page");
      await q.goto(url + "#you"); await q.waitForSelector("#f-acct"); await q.click("#f-acct > summary"); await q.click('[data-action="signin"]');
      await q.fill("#a-email", email); await q.fill("#a-pass", "not-the-password"); await q.click('#acct button[type="submit"]'); await q.waitForSelector("#a-err:not([hidden])");
      if (await q.locator("#acct-who").count()) bad("a wrong account password was accepted");
      await q.fill("#a-pass", pass); await q.click('#acct button[type="submit"]'); await q.waitForSelector("#acct-who");
      await q.click("#tier-member"); await q.goto(url + "#saved"); await q.click('[data-tab="mods"]');
      try { await q.waitForSelector("#view .mod"); } catch (e) { bad("a mod saved before signing up did not follow the account to a second device"); }
      // a playpack sent from one signed-in device is waiting on the other
      await p.goto(url + "#home"); await p.waitForSelector('.hero-side [data-action="play"]'); await p.click('.hero-side [data-action="play"]'); await p.click('[data-mode="send"]'); await p.waitForSelector("#code-also"); await p.waitForTimeout(400); await p.keyboard.press("Escape");
      await q.goto(url + "#home"); await q.reload(); await q.waitForSelector("#view .page");
      try { await q.waitForSelector("#upnext .pk"); } catch (e) { bad("a playpack sent from one device is not waiting on the other"); }
      // a stamp collected on the second device shows on the first
      await q.goto(url + "#pack-the-wanderer"); await q.waitForSelector('[data-action="stamp"]'); await q.click('[data-action="stamp"]'); await q.waitForTimeout(400);
      await p.reload(); await p.waitForSelector("#view .page"); await go("you"); await p.waitForSelector("#acct-who, #f-acct");
      if ((await count(".stamp")) < 2) bad("a stamp collected on one device did not show on the other");
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
