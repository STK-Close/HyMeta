// The page a shared playpack link opens (/p/<playpack>). Anyone may see it, so that link
// previews work in Discord, Messages and the rest. It carries only HyMeta's own words and
// picture: no mods, nothing from CurseForge, and never a playpack before its week.
const weeks = require("./weeks"), mail = require("./mail");
const { shell, esc } = require("./shell");

function page(req, id) {
  const week = weeks.schedule(), c = /^[a-z0-9-]{1,60}$/.test(id) && week.released.includes(id) ? weeks.card(id) : null;
  if (!c) return { status: 404, html: shell("Not on the shelf", '<h1>That playpack is not on the shelf</h1><p>The link may be old, or mistyped.</p><a class="btn" href="/">See what is on HyMeta</a>') };
  const site = mail.siteUrl(req), picture = site + "/images/" + c.art + ".jpg", free = week.free === id;
  const head = `<meta name="description" content="${esc(c.blurb)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="HyMeta"><meta property="og:url" content="${esc(site + "/p/" + id)}">
<meta property="og:title" content="${esc(c.name)}"><meta property="og:description" content="${esc("Hex says: " + c.hex)}">
<meta property="og:image" content="${esc(picture)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="789"><meta property="og:image:alt" content="${esc("The picture for " + c.name)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(c.name)}"><meta name="twitter:description" content="${esc("Hex says: " + c.hex)}"><meta name="twitter:image" content="${esc(picture)}">`;
  const body = `<img class="pic" src="/images/${c.art}.jpg" alt="" width="1200" height="789">
  ${free ? `<span class="tag" id="free-tag">${week.fresh ? "New and free this week" : "Free this week"}</span>` : ""}
  <h1 id="pack-name">${esc(c.name)}</h1><p>${esc(c.blurb)}</p>
  <p class="hexline" id="hex-line">Hex says: ${esc(c.hex)}</p>
  <p class="warn"><strong>Hex's warning.</strong> ${esc(c.warning)}</p>
  <a class="btn" id="open-pack" href="/#pack-${id}">See this playpack</a>
  <p class="small muted">HyMeta picks about eight Hytale mods that work together, for every way you like to play. The mods are free and come from CurseForge.</p>`;
  return { status: 200, html: shell(c.name, body, "", head) };
}
module.exports = { page };
