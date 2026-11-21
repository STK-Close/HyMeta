// HyMeta's advert settings, read by promo/tool/promo.js (the shared promo maker: github.com/STK-Close/promo-maker).
// Everything an advert says or shows comes from here and from the playpack list (lib/catalog.js).
// Wording rules: sentence case, plain words, no em dashes, child safe. "Hytale" is only ever used to say
// what the site is for, never as if HyMeta were official. No mod names, mod logos or numbers.
const path = require("path");
const catalog = require("../lib/catalog"), weeks = require("../lib/weeks");
const POSES = ["present", "wave", "peek", "point", "smug", "parcels"]; // promo/hex/hex-<pose>.png, made from promo/poses.json
const PASSWORD = "promo-local-only";                                   // only ever used by the copy of the site started on this computer

// The general adverts. `title` then `gold` make the headline. `say` is Hex, in her voice.
const GENERAL = [
  { id: "hello", kind: "mosaic", pose: "wave", eyebrow: "Playpacks for Hytale", title: "Hytale mods, sorted by", gold: "how you play.", say: "I tried every mod so you do not have to. You are welcome. Mostly." },
  { id: "pick", kind: "browser", shot: "home-desktop", pose: "present", eyebrow: "How it works", title: "Pick a playstyle.", gold: "Get the whole pack.", say: "Farming, dungeons, cats. Pick one. I did the hard part." },
  { id: "monday", kind: "fan", pose: "parcels", eyebrow: "New every week", title: "A new playpack", gold: "every Monday.", say: "Fresh every Monday. I carry them myself. Nobody helps." },
  { id: "everyone", kind: "wall", pose: "smug", eyebrow: "Playpacks for Hytale", title: "A playpack for", gold: "every way you play.", say: "Cozy, spooky, or far too many legs. I do not judge. Much." },
  { id: "phone", kind: "phone", shot: "home-phone", pose: "peek", eyebrow: "On every screen", title: "Browse on your phone.", gold: "Play on your computer.", say: "Find it on the bus. Play it at home. Do not play it on the bus." },
  { id: "vote", kind: "vote", pose: "point", eyebrow: "Players choose", title: "You vote.", gold: "Hex builds it.", say: "You pick the idea. I do the work. This seems unfair. Vote anyway." },
];

function adverts({ now = Date.now() } = {}) {
  const all = catalog.base.concat(catalog.rota), released = weeks.schedule(weeks.weekIndex(now)).released;
  const tile = (id) => ({ name: catalog.packs[id].name, art: "web/images/" + catalog.packs[id].art + ".jpg", thumb: "web/images/thumb-" + catalog.packs[id].art + ".jpg" });
  const tiles = released.slice().reverse().map(tile); // newest first, so adverts that show several playpacks lead with the latest
  const day = (i) => new Date(weeks.LAUNCH + i * weeks.WEEK_MS).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  const when = (id) => { const i = catalog.rota.indexOf(id); return i < 0 ? "Out from the start" : (weeks.LAUNCH + i * weeks.WEEK_MS <= now ? "Out since " : "Not out until Monday, ") + day(i); };
  return GENERAL.map((g) => ({ ...g, group: "general", note: "General advert", tiles, ideas: (catalog.poll && catalog.poll.ideas) || [] }))
    .concat(all.map((id, i) => { const p = catalog.packs[id]; return { id, group: "playpacks", kind: "feature", note: when(id), eyebrow: "A playpack for Hytale", title: p.name, sub: p.blurb, say: p.hex, art: tile(id).art, pose: POSES[i % POSES.length] }; }));
}

module.exports = {
  brand: {
    name: "HyMeta",
    site: "hymeta.vercel.app",                 // shown on every advert: change it here when the address changes
    fine: "An unofficial fan site",
    pill: "Picked by Hex",
    icon: "web/icon.svg",
    fonts: { display: "Grandstander", body: "Atkinson Hyperlegible",
      css: "https://fonts.googleapis.com/css2?family=Grandstander:wght@500;700;900&family=Atkinson+Hyperlegible:wght@400;700&display=swap" },
    colors: { navy: "#0e1223", navy2: "#1a2143", navy3: "#252d5a", line: "#6672b8", gold: "#f2b94b", goldInk: "#1d1503", ink: "#fffdf2", muted: "#b9c1de", teal: "#4fe3d4", pink: "#ff5aa5", edge: "#06080f" },
    shapes: { wide: [1600, 900], square: [1080, 1080], tall: [1080, 1350] },   // wide: Discord, Reddit, X. square and tall: Instagram, Pinterest
    mascot: { name: "Hex", label: "Hex says", dir: "promo/hex", prefix: "hex-", describe: "Hex, a small green troll with bright pink hair" },
    kit: { title: "HyMeta advert kit", intro: "No mod names, logos or numbers appear in any of them.",
      groups: [{ id: "general", title: "General adverts", note: "About HyMeta as a whole. Good for a launch post or a profile banner." }, { id: "playpacks", title: "One for each playpack", note: "Newest last. Post a playpack's advert in the week it comes out." }],
      light: { bg: "#d9e3ef", card: "#ffffff", fg: "#121930", muted: "#3a4461", line: "#74869f", focus: "#0b5cad" }, dark: { bg: "#0e1223", card: "#1a2143", fg: "#eef1fb", muted: "#b9c1de", line: "#6672b8", focus: "#4fe3d4" },
      legal: "© " + new Date().getUTCFullYear() + " Lumina Art House, LLC. HyMeta is an unofficial fan site. It is not affiliated with Hytale, Hypixel Studios, CurseForge or Overwolf." },
  },
  banned: /curseforge|overwolf|hypixel|sample|pretend|download/i,
  adverts, GENERAL, POSES,
  // Screenshots of the real site, running on this computer in its sample mode (no CurseForge key), dark theme.
  // Hidden for the picture: the private-preview notice, the welcome card, the Free and Member preview switch
  // and pop-up messages. The crop stops above the list of mods, so no mod row can be inside a picture.
  shots: {
    scheme: "dark",
    pages: [{ name: "home-desktop", w: 1120, h: 700, scale: 2 }, { name: "home-phone", w: 390, h: 800, scale: 3 }],
    hide: ".notice,#welcome,.viewas,#toast",
    never: ".mod, .mrow, [data-mod], .tag-sample",
    async start() {
      const keep = {}; ["HYMETA_WEEK", "SITE_PASSWORD", "CURSEFORGE_API_KEY", "SITE_OPEN", "HYMETA_LOCAL_DB"].forEach((k) => { keep[k] = process.env[k]; });
      const server = await require(path.join(__dirname, "..", "scripts", "dev-server")).start({ pretend: true, password: PASSWORD, key: "", week: null });
      return { url: server.url, calls: server.calls, close() { server.close(); Object.keys(keep).forEach((k) => { if (keep[k] === undefined) delete process.env[k]; else process.env[k] = keep[k]; }); } };
    },
    async enter(p, url) { await p.goto(url); await p.fill("#pw", PASSWORD); await p.click('button[type="submit"]'); await p.waitForSelector("#view .page"); },
    // a page that does hold mod rows, used only to prove that the check and the crop both work
    async leak(p) { await p.evaluate((x) => { location.hash = x; }, "#pack-" + weeks.schedule().free); await p.waitForSelector("#view h1"); },
  },
};
