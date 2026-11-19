// Checks the public page a shared playpack link opens: what link previews read from it,
// that it gives nothing away early, and that it carries no mod data.
// Run: node tests/share.test.js
const fs = require("fs"), path = require("path");
const { start } = require("../scripts/dev-server");
(async () => {
  const problems = [], bad = (m) => problems.push(m);
  const server = await start({ pretend: true, password: "gate-pass-1", key: "pretend-key", week: 0 });
  process.env.SITE_URL = "https://hymeta.test";
  const get = async (p) => { const r = await fetch(server.url + p, { redirect: "manual" }); return { status: r.status, html: await r.text(), robots: r.headers.get("x-robots-tag") || "" }; };
  const meta = (html, name) => (html.match(new RegExp('<meta (?:property|name)="' + name + '" content="([^"]*)"')) || [])[1];

  const before = server.calls.length;
  const page = await get("p/gone-fishing"); // no password, no cookies: exactly what a link preview robot sends
  if (page.status !== 200) bad("a shared link does not open without the password (status " + page.status + ")");
  if (meta(page.html, "og:title") !== "Gone fishing") bad("the preview title is wrong: " + meta(page.html, "og:title"));
  if (meta(page.html, "og:image") !== "https://hymeta.test/images/pack-fishing.jpg" || meta(page.html, "twitter:image") !== meta(page.html, "og:image")) bad("the preview picture is not this playpack's own picture at a full address: " + meta(page.html, "og:image"));
  if (!fs.existsSync(path.join(__dirname, "../web/images/pack-fishing.jpg"))) bad("the preview picture file is missing");
  if (!/^Hex says: Sit in a boat/.test(meta(page.html, "og:description") || "")) bad("the preview text is not Hex's line: " + meta(page.html, "og:description"));
  if (meta(page.html, "twitter:card") !== "summary_large_image" || meta(page.html, "og:url") !== "https://hymeta.test/p/gone-fishing") bad("the preview is missing its large-picture setting or its own address");
  if (!page.html.includes('href="/#pack-gone-fishing"')) bad("the page does not lead to the playpack");
  if (!page.html.includes("New and free this week")) bad("the page does not say this playpack is new and free this week");
  if (!/noindex/.test(page.robots) || !/name="robots" content="noindex/.test(page.html)) bad("the shared page is not hidden from search engines");
  if (/pretend/i.test(page.html) || server.calls.length !== before) bad("the shared page carries mod data or asked CurseForge for some");
  if (/id="pw"|id="view"/.test(page.html)) bad("the shared page is the front door or the app, not a page of its own");

  const older = await get("p/cozy-farmer");
  if (older.status !== 200 || meta(older.html, "og:title") !== "The cozy farmer" || older.html.includes('id="free-tag"')) bad("a playpack that is not free this week should open, without the free flag");
  const next = require("../lib/catalog"), nextId = next.rota[1], nextCard = next.packs[nextId];
  const early = await get("p/" + nextId);
  if (early.status !== 404 || early.html.includes(nextCard.name) || early.html.includes(nextCard.art)) bad("next week's playpack can be seen through a shared link");
  for (const odd of ["p/no-such-pack", "p/potato-empire", "p/%3Cscript%3Ealert(1)%3C%2Fscript%3E", "p/..%2F..%2Fapi%2Fhealth", "p/" + "a".repeat(300)]) {
    const r = await get(odd);
    if (r.status !== 404 || /<script>alert|og:image/.test(r.html)) bad("an odd shared link was not turned away cleanly: " + odd.slice(0, 40) + " (status " + r.status + ")");
  }
  // the address in a preview never comes from what the visitor claims the site is called
  delete process.env.SITE_URL; process.env.VERCEL_PROJECT_PRODUCTION_URL = "hymeta.example";
  const out = require("../lib/sharepage").page({ headers: { host: "evil.example" }, url: "/api/app?p=gone-fishing" }, "gone-fishing");
  if (meta(out.html, "og:image") !== "https://hymeta.example/images/pack-fishing.jpg" || /evil\.example/.test(out.html)) bad("the preview address was taken from the visitor's request: " + meta(out.html, "og:image"));
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  // every playpack's words survive being put into the page
  process.env.HYMETA_WEEK = "40"; process.env.SITE_URL = "https://hymeta.test";
  const catalog = require("../lib/catalog");
  for (const id of Object.keys(catalog.packs)) {
    const r = await get("p/" + id), c = catalog.packs[id];
    if (r.status !== 200 || meta(r.html, "og:title") !== c.name.replace(/&/g, "&amp;") || !meta(r.html, "og:image").endsWith("/images/" + c.art + ".jpg")) bad(id + ": its shared page is wrong");
  }
  // the host sends /p/<playpack> to the same place this test server does
  const rewrites = JSON.parse(fs.readFileSync(path.join(__dirname, "../vercel.json"), "utf8")).rewrites;
  if (!rewrites.some((r) => r.source === "/p/:id" && r.destination === "/api/app?p=:id")) bad("the host is not told where shared links go");
  server.close();
  console.log(problems.length ? problems.join("\n") : "SHARE OK");
  process.exit(problems.length ? 1 : 0);
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
