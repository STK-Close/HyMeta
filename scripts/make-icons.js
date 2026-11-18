// Draws the HyMeta app icon (a pixel backpack, for "playpack") and saves every size the web and Apple need.
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const MARK = ["...####...","..#....#..",".########.","##########","##########","##oooooo##","##o####o##","##oooooo##","##########",".########."];
const cells = (x0, y0, s) => MARK.map((row, y) => [...row].map((c, x) => c === "." ? "" :
  `<rect x="${x0 + x * s}" y="${y0 + y * s}" width="${s + 0.5}" height="${s + 0.5}" fill="${c === "o" ? "#7a5200" : "#1d1503"}"/>`).join("")).join("");
const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" shape-rendering="crispEdges">
<rect width="1024" height="1024" fill="#f2b94b"/><rect y="860" width="1024" height="164" fill="#e0a431"/>${cells(232, 212, 56)}</svg>`;
fs.writeFileSync(path.join(root, "web/icon.svg"), icon);
(async () => {
  const b = await chromium.launch();
  const png = async (file, w, h, html) => {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await p.setContent(`<body style="margin:0;background:#f2b94b">${html}</body>`); await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(root, file), omitBackground: false }); await p.close();
  };
  const sq = (n) => `<div style="width:${n}px;height:${n}px">${icon.replace("<svg ", `<svg width="${n}" height="${n}" `)}</div>`;
  await png("store/app-icon-1024.png", 1024, 1024, sq(1024));
  await png("web/icon-512.png", 512, 512, sq(512));
  await png("web/icon-192.png", 192, 192, sq(192));
  await png("web/apple-touch-icon.png", 180, 180, sq(180));
  await png("web/favicon-32.png", 32, 32, sq(32));
  await png("web/og.png", 1200, 630, `<div style="width:1200px;height:630px;background:#0e1223;color:#eef1fb;display:flex;align-items:center;gap:56px;padding:0 96px;box-sizing:border-box;font-family:'Trebuchet MS',system-ui,sans-serif">
    <div style="width:260px;height:260px;border-radius:48px;overflow:hidden;flex:none">${icon.replace("<svg ", '<svg width="260" height="260" ')}</div>
    <div><div style="font-size:112px;font-weight:900;line-height:1">HyMeta</div><div style="font-size:40px;margin-top:20px;color:#b9c1de">Playpacks for every way you play</div></div></div>`);
  await b.close(); console.log("Icons saved");
})();
