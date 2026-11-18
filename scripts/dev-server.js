// Runs HyMeta on this computer the way the host runs it: the same routes, gate and CurseForge code.
//   node scripts/dev-server.js            real CurseForge (needs CURSEFORGE_API_KEY and SITE_PASSWORD)
// Tests start it with a pretend CurseForge instead, so they never depend on the real service.
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json", ".txt": "text/plain" };

// A pretend CurseForge with an invented catalog. No real mod data lives in this repository.
function pretendCurseForge() {
  const calls = [];
  const cats = [[9288, "Food\\Farming"], [9283, "Mobs\\Characters"], [9211, "Furniture"], [9285, "Blocks"], [9212, "Gameplay"], [9213, "Quality of Life"], [9286, "World Gen"], [9287, "Prefab"], [9289, "Utility"]];
  const words = ["farm", "animal", "decor", "dungeon", "combat", "boss", "weapon", "map", "waypoint", "biome", "spider", "magic", "spell", "wand", "staff", "pet", "tame", "mount", "automation", "storage", "pipe", "machine", "hardcore", "hunger", "temperature", "survival", "fishing"];
  const mods = [];
  const add = (o) => { const id = 1000 + mods.length; mods.push({ id, gameId: 70216, classId: 9137, isAvailable: true, allowModDistribution: true, mainFileId: id * 10, primaryCategoryId: o.cat || 9212,
    name: o.name, summary: o.summary || "Pretend mod about " + (o.word || "things") + ".", authors: [{ name: "pretend_author" }], downloadCount: 900000 - mods.length * 4000, dateModified: "2026-11-01T10:00:00Z",
    categories: [{ name: (cats.find((c) => c[0] === (o.cat || 9212)) || [0, "Gameplay"])[1] }], logo: { thumbnailUrl: "https://media.forgecdn.net/pretend/" + id + ".png" }, links: { websiteUrl: "https://www.curseforge.com/hytale/mods/pretend-" + id },
    latestFiles: [{ id: id * 10, dependencies: o.needs ? o.needs.map((modId) => ({ modId, relationType: 3 })) : [] }], word: o.word || "" }); return id; };
  const helper = add({ name: "Pretend Helper Lib", cat: 9297, word: "farm", summary: "A helper other mods need." });
  add({ name: "<img src=x onerror=window.__hacked=1> Sneaky", cat: 9288, word: "farm" });
  add({ name: "Sexy Farm Outfits", cat: 9288, word: "farm" });
  add({ name: "Pretend Coops", cat: 9288, word: "farm", needs: [helper] });
  cats.forEach(([cat, label]) => { for (let i = 1; i <= 8; i++) add({ name: `Pretend ${label.split("\\")[0]} ${i}`, cat }); });
  words.forEach((word) => { for (let i = 1; i <= 7; i++) add({ name: `Pretend ${word} mod ${i}`, word, summary: `All about ${word}, number ${i}.` }); });
  const real = global.fetch;
  global.fetch = async (url, init) => {
    const u = new URL(String(url));
    if (u.hostname !== "api.curseforge.com") return real(url, init);
    calls.push(((init && init.method) || "GET") + " " + u.pathname + u.search);
    const send = (o) => new Response(JSON.stringify(o), { status: 200, headers: { "Content-Type": "application/json" } });
    if (!init || !init.headers || init.headers["x-api-key"] !== process.env.CURSEFORGE_API_KEY) return new Response("{}", { status: 403 });
    if (u.pathname === "/v1/mods/search") {
      const q = (u.searchParams.get("searchFilter") || "").toLowerCase(), cat = +u.searchParams.get("categoryId") || 0;
      const index = +u.searchParams.get("index") || 0, size = +u.searchParams.get("pageSize") || 50;
      const hits = mods.filter((m) => (!cat || m.primaryCategoryId === cat) && (!q || m.word === q || m.name.toLowerCase().includes(q)));
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
module.exports = { start };
if (require.main === module) start({ port: +process.env.PORT || 3000 }).then((s) => console.log("HyMeta is running at " + s.url));
