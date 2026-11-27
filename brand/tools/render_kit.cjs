// Renders the HyMeta logo kit's pictures from the SVGs made by make_kit.py.
// Run from the site's top folder: node brand/tools/render_kit.cjs   (Playwright with Chromium; nothing is fetched)
// Hex appears only in an approved pose (promo/hex/hex-wave.png, approved by Ligia on November 21, 2026).
const path = require("path"), fs = require("fs");
const { chromium } = require("playwright");
const ROOT = path.join(__dirname, "..", ".."), KIT = path.join(ROOT, "brand", "hymeta");
const SVG = (n) => fs.readFileSync(path.join(KIT, "svg", n + ".svg"), "utf8");
const data = (f, type) => `data:${type};base64,` + fs.readFileSync(path.join(ROOT, f)).toString("base64");
const NAVY = "#0e1223", INK = "#eef1fb", MUTED = "#b9c1de", GOLD = "#f2b94b";
const FINE = "An unofficial fan site";
const FACES = `@font-face{font-family:Atkinson;src:url(${data("brand/tools/fonts/AtkinsonHyperlegible-Bold.ttf", "font/ttf")}) format("truetype");font-weight:700}`;
const HEX = data("promo/hex/hex-wave.png", "image/png");

async function shot(browser, file, w, h, body, ground) {
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  p.on("request", (r) => { if (!/^(data:|about:)/.test(r.url())) throw new Error("tried to fetch " + r.url()); });
  await p.setContent(`<!doctype html><html><head><style>${FACES}
    html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:${ground || "transparent"}}
    body{display:grid;place-items:center;font-family:Atkinson,sans-serif;color:${INK}} svg{display:block}</style></head><body>${body}</body></html>`);
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(100);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await p.screenshot({ path: file, omitBackground: !ground }); await p.close();
}
const sized = (svg, w) => svg.replace(/width="[^"]+" height="[^"]+"/, `width="${w}"`);
const vb = (n) => SVG(n).match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).slice(1).map(Number);

(async () => {
  const b = await chromium.launch(); const png = (n) => path.join(KIT, "png", n);
  for (const n of ["hymeta-logo-color-on-dark", "hymeta-logo-color-on-light", "hymeta-logo-black", "hymeta-logo-white"]) {
    const [w, h] = vb(n), inner = 2304, m = 48; await shot(b, png("logo/" + n + ".png"), inner + 2 * m, Math.round(inner * h / w) + 2 * m, sized(SVG(n), inner));
  }
  for (const n of ["hymeta-mark-color", "hymeta-mark-black", "hymeta-mark-white"]) {
    const [w, h] = vb(n), inner = 944; await shot(b, png("mark/" + n + ".png"), Math.round(inner * w / h) + 80, 1024, sized(SVG(n), Math.round(inner * w / h)));
  }
  // Profile picture: Hex waving, head and shoulders, on HyMeta's gold; hand, ear and hair stay inside the circle.
  await shot(b, png("social/profile-1024.png"), 1024, 1024,
    `<div style="width:1024px;height:1024px;overflow:hidden;position:relative">
       <img src="${HEX}" alt="" style="position:absolute;width:920px;left:70px;top:90px"></div>`, GOLD);
  // Banners and share image: Hex beside the logo, one plain line, and the fan-site line.
  // Hex stands on the right, so X's round profile photo (lower left) never covers him.
  const scene = (lw, hexH, px) => `<div style="display:flex;flex-direction:row-reverse;align-items:center;gap:${Math.round(px * 1.4)}px">
      <img src="${HEX}" alt="" style="height:${hexH}px;display:block">
      <div>${sized(SVG("hymeta-logo-color-on-dark"), lw)}
        <p style="margin:${Math.round(px * 0.9)}px 0 0;font-size:${px}px;font-weight:700;color:${MUTED}">Playpacks for Hytale</p>
        <p style="margin:${Math.round(px * 0.5)}px 0 0;font-size:${Math.round(px * 0.66)}px;font-weight:700;color:${MUTED}">${FINE}</p></div></div>`;
  await shot(b, png("social/banner-kofi-x-1500x500.png"), 1500, 500, scene(600, 400, 36), NAVY);
  await shot(b, png("social/banner-youtube-2560x1440.png"), 2560, 1440, scene(760, 400, 42), NAVY);   // all inside the middle 1546 by 423
  await shot(b, png("social/share-preview-1200x630.png"), 1200, 630, scene(440, 430, 32), NAVY);
  await b.close(); console.log("rendered the kit's pictures into", path.relative(ROOT, path.join(KIT, "png")));
})().catch((e) => { console.error(e.message); process.exit(1); });
