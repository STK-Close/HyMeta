// Runs HyMeta on this computer the way the host runs it: the same routes, gate and CurseForge code.
//   node scripts/dev-server.js            real CurseForge (needs CURSEFORGE_API_KEY and SITE_PASSWORD)
// Tests start it with a pretend CurseForge instead, so they never depend on the real service.
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json", ".txt": "text/plain" };

// A pretend CurseForge with an invented catalog. No real mod data lives in this repository.
// Besides ordinary mods for every word the recipes search for, it holds "traps": mods that would
// win a place on downloads alone and must be turned away by one specific rule.
function pretendCurseForge() {
  const calls = [], DAY = 24 * 3600 * 1000, HUGE = 9e9;
  const CAT = { farming: [9288, "Food\\Farming", "Crop Patch"], mobs: [9283, "Mobs\\Characters", "Mob Pack"], furniture: [9211, "Furniture", "Furniture Set"], blocks: [9285, "Blocks", "Block Set"],
    gameplay: [9212, "Gameplay", "Gameplay Tweak"], qol: [9213, "Quality of Life", "Inventory Sorter"], worldgen: [9286, "World Gen", "World Gen Biome"], prefab: [9287, "Prefab", "Ruin Structure"], utility: [9289, "Utility", "Utility"] };
  const mods = [];
  const add = (o) => {
    const id = 1000 + mods.length, cat = o.cat || 9212, label = (Object.values(CAT).find((c) => c[0] === cat) || [0, "Library"])[1];
    mods.push({ id, gameId: 70216, classId: 9137, isAvailable: true, allowModDistribution: true, mainFileId: id * 10, primaryCategoryId: cat,
      name: o.name, summary: o.summary || "Pretend mod about " + ((o.words || [])[0] || "things") + ".", authors: [{ name: o.author || "pretend_author_" + id }],
      downloadCount: o.dl || Math.max(600, 900000 - mods.length * 1400), dateModified: new Date(Date.now() - (o.age || 5) * DAY).toISOString(),
      categories: [{ id: cat, name: label }], logo: { thumbnailUrl: "https://media.forgecdn.net/pretend/" + id + ".png" }, links: { websiteUrl: "https://www.curseforge.com/hytale/mods/pretend-" + id },
      latestFiles: [{ id: id * 10, gameVersions: o.versions || ["0.7", "Early Access"], dependencies: (o.needs || []).map((modId) => ({ modId, relationType: 3 })).concat((o.clashes || []).map((modId) => ({ modId, relationType: 5 }))) }],
      words: o.words || [] });
    return id;
  };
  const helper = add({ name: "Pretend Helper Lib", cat: 9297, words: ["farm"], summary: "A helper other mods need." });
  const libs = [1, 2, 3, 4].map((n) => add({ name: "Pretend Lib " + n, cat: 9297, summary: "Another helper." }));
  add({ name: "<img src=x onerror=self.__hacked=1> Sneaky Crops", cat: 9288, words: ["farm", "crop"], dl: HUGE });            // must be shown as plain text
  add({ name: "Sexy Farm Outfits", cat: 9288, words: ["farm"], dl: HUGE });                                                    // blocked word
  add({ name: "Pretend Coops", words: ["animal"], needs: [helper], dl: HUGE });                                                // needs one helper mod
  add({ name: "PretendBetterMap", words: ["map"], dl: HUGE });                                                                 // a run-together name still counts as a map mod
  add({ name: "Pretend Carpets", words: ["pet"], dl: HUGE });                                                                  // "pet" inside "carpets" is not a match
  add({ name: "Pretend Spider Skin Pack", words: ["spider"], dl: HUGE });                                                      // the spider playpack avoids skins
  add({ name: "Pretend Spiders Begone", words: ["spider"], dl: HUGE });                                                        // removes spiders: on that playpack's own avoid list
  add({ name: "Pretend Chicken Coop Helper Lib", cat: 9297, words: ["animal"], dl: HUGE * 100, summary: "A helper for chicken coop mods." }); // a helper mod is never a main pick
  add({ name: "Pretend spider textures", cat: 10425, words: ["spider"], dl: HUGE });                                           // resource packs are left out
  add({ name: "Pretend dungeon integration", words: ["dungeon"], dl: HUGE });                                                  // add-ons for other mods are left out
  add({ name: "Pretend map ancient", words: ["map"], dl: HUGE, age: 300, versions: ["0.5"] });                                 // old game version, long untouched
  add({ name: "Pretend Taming Pets Mounts and Combat Animals", words: ["combat", "pet", "tame"], dl: HUGE });                  // belongs to the pets playpack, not combat
  ["dungeon A", "dungeon B", "combat C", "boss D"].forEach((n) => add({ name: "Flood " + n, words: [n.split(" ")[0]], author: "flooder", dl: HUGE })); // one author, four mods
  const hardcore = add({ name: "Pretend hardcore star", words: ["hardcore"], dl: HUGE });
  add({ name: "Pretend hunger rival", words: ["hunger"], dl: HUGE * 10, clashes: [hardcore] });                                // clashes with a mod already chosen
  add({ name: "Pretend hunger star", words: ["hunger"], dl: HUGE });
  add({ name: "Pretend hunger season mega", words: ["season", "temperature"], dl: HUGE / 2 });                                 // would double up on the hunger job
  add({ name: "Pretend machine factory heavy", words: ["machine"], dl: HUGE * 1000, needs: [helper].concat(libs) });           // needs five helper mods
  add({ name: "Pretend cozy decor superstar", words: ["decor", "cozy"], dl: HUGE });                                           // too famous to be a lesser-known pick
  Object.values(CAT).forEach(([cat, , noun]) => { for (let i = 1; i <= 8; i++) add({ name: `Pretend ${noun} ${i}`, cat }); });
  const stale = ["staff", "wand"]; // every mod for these words is old, so that job has to fall back and warn
  require("../lib/recipes").searchWords().concat(["fishing"]).filter((w, i, all) => all.indexOf(w) === i).forEach((word) => {
    for (let i = 1; i <= 7; i++) add({ name: `Pretend ${word} mod ${i}`, words: [word], summary: `All about ${word}, number ${i}.`, ...(stale.includes(word) ? { age: 300, versions: ["Early Access"] } : {}) });
  });
  const real = global.__realFetch || (global.__realFetch = global.fetch);
  global.fetch = async (url, init) => {
    const u = new URL(String(url));
    if (u.hostname !== "api.curseforge.com") return real(url, init);
    calls.push(((init && init.method) || "GET") + " " + u.pathname + u.search);
    const send = (o) => new Response(JSON.stringify(o), { status: 200, headers: { "Content-Type": "application/json" } });
    if (!init || !init.headers || init.headers["x-api-key"] !== process.env.CURSEFORGE_API_KEY) return new Response("{}", { status: 403 });
    if (u.pathname === "/v1/mods/search") {
      const q = (u.searchParams.get("searchFilter") || "").toLowerCase(), cat = +u.searchParams.get("categoryId") || 0;
      const index = +u.searchParams.get("index") || 0, size = +u.searchParams.get("pageSize") || 50;
      const hits = mods.filter((m) => (!cat || m.primaryCategoryId === cat) && (!q || m.words.includes(q) || m.name.toLowerCase().includes(q))).sort((x, y) => y.downloadCount - x.downloadCount);
      return send({ data: hits.slice(index, index + size), pagination: { totalCount: hits.length } });
    }
    if (u.pathname === "/v1/mods" && init.method === "POST") { const ids = JSON.parse(init.body).modIds; return send({ data: mods.filter((m) => ids.includes(m.id)) }); }
    return new Response("{}", { status: 404 });
  };
  return calls;
}

function start({ port = 0, pretend = false, password, key } = {}) {
  if (password !== undefined) { if (password) process.env.SITE_PASSWORD = password; else delete process.env.SITE_PASSWORD; }
  if (key !== undefined) { if (key) process.env.CURSEFORGE_API_KEY = key; else delete process.env.CURSEFORGE_API_KEY; }
  const calls = pretend ? pretendCurseForge() : [];
  const server = http.createServer(async (req, res) => {
    try {
      const u = new URL(req.url, "http://localhost");
      const name = u.pathname === "/" ? "app" : (u.pathname.match(/^\/api\/([a-z]+)$/) || [])[1];
      if (name && fs.existsSync(path.join(root, "api", name + ".js"))) {
        if (req.method === "POST") { let raw = ""; for await (const c of req) raw += c; try { req.body = JSON.parse(raw); } catch (e) { req.body = {}; } }
        return await require(path.join(root, "api", name + ".js"))(req, res);
      }
      const file = path.join(root, "web", path.normalize(u.pathname));
      if (!file.startsWith(path.join(root, "web") + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; return res.end("Not found"); }
      res.setHeader("Content-Type", TYPES[path.extname(file)] || "application/octet-stream"); res.end(fs.readFileSync(file));
    } catch (e) { res.statusCode = 500; res.end("Server error"); console.error(e); }
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve({ url: "http://localhost:" + server.address().port + "/", close: () => server.close(), calls })));
}
module.exports = { start, pretendCurseForge };
if (require.main === module) start({ port: +process.env.PORT || 3000 }).then((s) => console.log("HyMeta is running at " + s.url));
