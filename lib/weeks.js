// The weekly switch. Week 0 began Monday 16 November 2026 at 09:00 UTC (early morning in the
// United States). Each week one playpack is free to everyone: a brand-new one while the weekly
// list lasts, and after that every playpack takes a turn. A weekly playpack cannot be opened
// before its week, and stays for good afterwards.
// Nothing is stored: the week is worked out from the date, and the mods are still fetched live.
const catalog = require("./catalog");
const WEEK_MS = 7 * 24 * 3600 * 1000, LAUNCH = Date.UTC(2026, 10, 16, 9);

// HYMETA_WEEK pins the week, for tests. "after" means the first week after the weekly list has
// run out, whatever its length: the week The cozy farmer is free, which most tests rely on.
function weekIndex(now = Date.now()) {
  const pinned = process.env.HYMETA_WEEK;
  if (pinned === "after") return catalog.rota.length;
  if (pinned !== undefined && pinned !== "") return Math.max(0, parseInt(pinned, 10) || 0);
  return Math.max(0, Math.floor((now - LAUNCH) / WEEK_MS));
}
function schedule(index = weekIndex()) {
  const { base, rota } = catalog, i = Math.max(0, Math.floor(index) || 0), fresh = i < rota.length, cycle = base.concat(rota);
  const free = fresh ? rota[i] : cycle[(i - rota.length) % cycle.length];
  const released = base.concat(rota.slice(0, Math.min(i + 1, rota.length)));
  const others = released.filter((id) => id !== free);
  return { index: i, free, fresh, released, nextAt: LAUNCH + (i + 1) * WEEK_MS, teasers: [0, 1, 2].map((k) => others[(i * 3 + k) % others.length]) };
}
const card = (id) => catalog.packs[id];
module.exports = { weekIndex, schedule, card, LAUNCH, WEEK_MS };
