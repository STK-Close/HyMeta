// Opens the built app in a real browser at phone, tablet and desktop sizes, in light and dark,
// clicks through every main flow and reports anything broken.
// Run: node tests/check.js [page] [screenshot folder] [only, e.g. phone-light]
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const page = path.resolve(process.argv[2] || path.join(__dirname, "../web/index.html"));
const out = process.argv[3] ? path.resolve(process.argv[3]) : null;
const only = process.argv[4] || "";
if (out) fs.mkdirSync(out, { recursive: true });
const url = "file://" + page;
const sizes = { phone: [390, 844], tablet: [820, 1180], desktop: [1366, 900] };

(async () => {
  const b = await chromium.launch();
  const problems = [];
  for (const scheme of ["light", "dark"]) for (const [name, [w, h]] of Object.entries(sizes)) {
    const tag = `${name}-${scheme}`;
    if (only && only !== tag) continue;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: 1, hasTouch: name !== "desktop" });
    const p = await ctx.newPage();
    const bad = (m) => problems.push(`${tag} ${m}`);
    p.on("console", (m) => { if (m.type() === "error") bad("console: " + m.text()); });
    p.on("pageerror", (e) => bad("page error: " + e.message));
    const go = async (hash) => { await p.goto(url + "#" + hash); await p.waitForTimeout(220); };
    const shot = async (n) => { if (out) await p.screenshot({ path: `${out}/${tag}-${n}.png`, fullPage: true }); };

    const audit = async (view) => {
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
          if (el.closest(".hero-art, .pk-art, .tile")) continue;
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
    const count = (sel) => p.locator(sel).count();
    p.setDefaultTimeout(6000);
    try {

    // home
    await p.goto(url); await p.waitForTimeout(700);
    await audit("home"); await shot("home");
    if (await count(".top .hex, .top .face")) bad("home: troll is in the top bar");
    if (await count("#view > .page > .hex")) bad("home: troll greeting is back at the top of the page");
    if (name === "phone") { const hgt = await p.locator(".pk").first().evaluate((e) => e.getBoundingClientRect().height); if (hgt > 190) bad(`home: playpack card is ${Math.round(hgt)}px tall on a phone`); }

    // two taps from home to playing
    await p.click('[data-action="play"]'); await p.click('[data-mode="here"]'); await p.click('[data-action="install"]'); await p.waitForTimeout(2200);
    if (!/All 6 mods are in/.test(await p.textContent("#play-out"))) bad("play: install did not finish");
    await audit("play sheet"); if (out) await p.screenshot({ path: `${out}/${tag}-play.png` });
    await p.click('[data-mode="send"]'); await audit("send sheet"); await p.keyboard.press("Escape");

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
    for (const need of ["$3.99", "$24.99", "renews automatically", "Restore purchases", "Terms of use", "Privacy policy"]) if (!joinText.includes(need)) bad("membership sheet is missing: " + need);
    await audit("membership sheet");
    await p.click('[data-action="gate"]'); await audit("gate");
    await p.fill("#gate-in", "1"); await p.click('#gate button[type="submit"]');
    if (await p.locator("#gate-err").isHidden()) bad("gate accepted a wrong answer");
    const nums = (await p.textContent('label[for="gate-in"]')).match(/\d+/g).map(Number);
    await p.fill("#gate-in", String(nums[0] * nums[1])); await p.click('#gate button[type="submit"]'); await p.waitForTimeout(200);
    if (!(await count(".mod"))) bad("member view hides the mods");
    await audit("pack"); await shot("pack");

    // save a playpack and a mod, collect a stamp
    await p.click('[data-action="save"]'); await p.click('[data-action="savemod"]'); await p.click('[data-action="stamp"]'); await p.waitForTimeout(550);
    await go("saved"); await audit("saved playpacks"); await shot("saved-packs");
    if (await count("#view .pk") !== 1) bad("saved playpacks list is wrong");
    await p.click('[data-tab="mods"]'); await audit("saved mods"); await shot("saved-mods");
    if (await count("#view .mod") !== 1) bad("saved mods list is wrong");
    await p.click('[data-tab="packs"]'); await p.click(".pk-heart"); await p.waitForTimeout(150);
    if (await count("#view .pk") !== 0 || !(await count("#view .panel"))) bad("heart in Saved did not remove the playpack");

    // explore search
    await go("explore"); await audit("explore"); await shot("explore");
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
    await p.fill("#b-name", "Swamp <b>wizard</b>");
    await p.click('.tabs a[href="#home"]'); await p.waitForTimeout(250);
    if (!(await count("dialog[open]"))) bad("no warning before losing an unsaved playpack");
    await audit("leave warning"); await p.click('dialog .btn[data-action="close"]');
    if (await p.inputValue("#b-name") !== "Swamp <b>wizard</b>") bad("draft was lost after choosing to keep building");
    await p.fill("#b-blurb", "call me on 5551234567"); await p.click('#build button[type="submit"]');
    if (!/links, emails and phone/.test(await p.textContent("#b-err"))) bad("personal details were allowed in a shared playpack");
    await p.fill("#b-blurb", "Swampy"); await p.click('#build button[type="submit"]'); await p.waitForTimeout(300);
    if (!/pack-mine-/.test(p.url())) bad("sharing did not open the new playpack");
    if (await count("#view b")) bad("typed text was treated as code");
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
    for (const id of ["f-look", "f-acct", "f-mem", "f-legal", "f-reset"]) await p.click(`#${id} > summary`);
    await audit("you, everything open");
    if (!(await count('[data-action="unblock"]'))) bad("blocked member is not listed");
    if (!(await count('[data-action="delacct"]'))) bad("no way to delete the account");
    for (const d of ["support", "privacy", "terms", "rules", "credits"]) {
      await p.click(`[data-doc="${d}"]`); await audit("doc " + d);
      if (d !== "support" && d !== "rules" && !/Lumina Art House, LLC/.test(await p.textContent("#sheet"))) bad(`${d} does not name Lumina Art House, LLC`);
      await p.keyboard.press("Escape");
    }
    if (!/Lumina Art House, LLC/.test(await p.textContent(".foot"))) bad("footer copyright missing");
    await p.selectOption("#theme", scheme === "light" ? "dark" : "light");
    const bg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
    if ((scheme === "light") !== (bg === "rgb(14, 18, 35)")) bad("theme switch did not change the page: " + bg);
    await audit("you, switched theme"); await p.selectOption("#theme", "device");
    await p.click('[data-action="reset"]'); await p.click('[data-action="reset"]'); await p.waitForTimeout(200);
    await p.click("#tier-free"); await go("saved"); await audit("saved, free view"); await go("build"); await audit("build, free view");
    } catch (e) { bad("stopped early, a step could not be done: " + e.message.split("\n")[0]); }
    await ctx.close();
  }
  await b.close();
  console.log(problems.length ? problems.join("\n") : "NO PROBLEMS");
  process.exit(problems.length ? 1 : 0);
})();
