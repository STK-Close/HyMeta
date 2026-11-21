// The one place that says what HyMeta's adverts look like and say. To reuse the promo maker for
// another app, copy scripts/promo, change this file and point make-promo.js at that app's pictures.
// Wording rules: sentence case, plain words, no em dashes, child safe. "Hytale" is only ever used to
// say what the site is for, never as if HyMeta were official. No mod names, mod logos or numbers.
module.exports = {
  name: "HyMeta",
  site: "hymeta.vercel.app",                 // shown on every advert: change it here when the address changes
  fine: "An unofficial fan site",
  icon: "web/icon.svg",
  fonts: { display: "Grandstander", body: "Atkinson Hyperlegible",
    css: "https://fonts.googleapis.com/css2?family=Grandstander:wght@500;700;900&family=Atkinson+Hyperlegible:wght@400;700&display=swap" },
  colors: { navy: "#0e1223", navy2: "#1a2143", navy3: "#252d5a", line: "#6672b8", gold: "#f2b94b", goldInk: "#1d1503", ink: "#fffdf2", muted: "#b9c1de", teal: "#4fe3d4", pink: "#ff5aa5", edge: "#06080f" },
  shapes: { wide: [1600, 900], square: [1080, 1080], tall: [1080, 1350] },   // wide: Discord, Reddit, X. square and tall: Instagram, Pinterest
  poses: ["present", "wave", "peek", "point", "smug", "parcels"],           // promo/hex/hex-<pose>.png, made by scripts/make-hex.py
  packEyebrow: "A playpack for Hytale",
  // The general adverts. `title` then `gold` make the headline. `say` is Hex, in her voice.
  general: [
    { id: "hello", kind: "mosaic", pose: "wave", eyebrow: "Playpacks for Hytale", title: "Hytale mods, sorted by", gold: "how you play.", say: "I tried every mod so you do not have to. You are welcome. Mostly." },
    { id: "pick", kind: "browser", pose: "present", eyebrow: "How it works", title: "Pick a playstyle.", gold: "Get the whole pack.", say: "Farming, dungeons, cats. Pick one. I did the hard part." },
    { id: "monday", kind: "fan", pose: "parcels", eyebrow: "New every week", title: "A new playpack", gold: "every Monday.", say: "Fresh every Monday. I carry them myself. Nobody helps." },
    { id: "everyone", kind: "wall", pose: "smug", eyebrow: "Playpacks for Hytale", title: "A playpack for", gold: "every way you play.", say: "Cozy, spooky, or far too many legs. I do not judge. Much." },
    { id: "phone", kind: "phone", pose: "peek", eyebrow: "On every screen", title: "Browse on your phone.", gold: "Play on your computer.", say: "Find it on the bus. Play it at home. Do not play it on the bus." },
    { id: "vote", kind: "vote", pose: "point", eyebrow: "Players choose", title: "You vote.", gold: "Hex builds it.", say: "You pick the idea. I do the work. This seems unfair. Vote anyway." },
  ],
};
