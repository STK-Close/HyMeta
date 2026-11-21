// Draws HyMeta's advert kit. The work is done by the shared promo maker in promo/tool (a copy of
// github.com/STK-Close/promo-maker: never edit it here) using HyMeta's settings in promo/promo.config.js.
//   node scripts/make-promo.js                 every playpack and every general advert, in every shape
//   node scripts/make-promo.js cat-cafe hello  only these (playpack ids, or general advert ids)
//   node scripts/make-promo.js --shapes wide   only this shape (wide, square, tall)
//   node scripts/make-promo.js --files         the list of pictures the kit page shows
// Pictures land in promo/out/<shape>/<id>.jpg. promo/index.html shows them all, and promo/kit-page.html is
// the page behind Ligia's private link. Nothing is sent anywhere and nothing costs money.
const path = require("path");
const kit = require("../promo/tool/promo").load(path.join(__dirname, "..", "promo", "promo.config.js"));
module.exports = kit;
if (require.main === module) kit.main(process.argv.slice(2)).catch((e) => { console.error(String(e.message || e)); process.exit(1); });
