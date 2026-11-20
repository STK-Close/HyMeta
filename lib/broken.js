// "It did not work": players tell HyMeta when a mod in a playpack is broken.
// A mod that three different players report within 30 days is benched: the recipes leave it out
// and pick the next best one instead. Reports fade after 30 days, so a mod that gets fixed
// earns its place back without anyone lifting a finger. Only the mod's id is kept, never its details.
const { query } = require("./db");
const { problem } = require("./accounts");
const catalog = require("./catalog");

const REASONS = ["It would not install", "It crashed the game", "It needs something that is missing", "It did not do what it says"];
const NEEDED = 3, DAYS = 30, MAX_PER_MEMBER = 40;
const recent = "created_at > now() - interval '" + DAYS + " days'";
let cache = { at: 0, set: new Set() };

// Returns true when this report is the one that benches the mod.
async function report(user, { mod, pack, why, on }) {
  if (typeof mod !== "string" || !/^cf\d{1,12}$/.test(mod) || !catalog.packs[String(pack)]) throw problem("That mod cannot be reported.");
  cache.at = 0;
  if (on === false) { await query("delete from broken where mod = $1 and user_id = $2", [mod, user.id]); return false; }
  const mine = await query("select count(*)::int as n from broken where user_id = $1 and " + recent, [user.id]);
  if (mine[0].n >= MAX_PER_MEMBER) throw problem("You have reported a lot of mods lately. Give us time to look at those first.");
  const before = await count(mod);
  await query("insert into broken (mod, user_id, pack, why) values ($1, $2, $3, $4) on conflict (mod, user_id) do update set why = excluded.why, pack = excluded.pack, created_at = now()", [mod, user.id, String(pack), REASONS[Number(why)] || REASONS[3]]);
  return before < NEEDED && (await count(mod)) >= NEEDED;
}
async function count(mod) { return (await query("select count(*)::int as n from broken where mod = $1 and " + recent, [mod]))[0].n; }
async function mine(user) { return (await query("select mod from broken where user_id = $1 and " + recent + " order by created_at", [user.id])).map((r) => r.mod); }
// The mods left out of every playpack right now. Looked up at most once a minute.
async function benched(now = Date.now()) {
  if (now - cache.at < 60000) return cache.set;
  const rows = await query("select mod from broken where " + recent + " group by mod having count(*) >= $1", [NEEDED]);
  cache = { at: now, set: new Set(rows.map((r) => r.mod)) };
  return cache.set;
}
// For the owner: every mod with a live report, most reported first.
async function queue() {
  await query("delete from broken where created_at < now() - interval '" + DAYS * 3 + " days'");
  const rows = await query("select mod, count(*)::int as count, string_agg(distinct why, ', ') as reasons, string_agg(distinct pack, ',') as packs from broken where " + recent + " group by mod order by count(*) desc, mod limit 40");
  return rows.map((r) => ({ mod: r.mod, count: r.count, needed: NEEDED, benched: r.count >= NEEDED, reasons: r.reasons, packs: r.packs.split(",").map((p) => (catalog.packs[p] || { name: p }).name).join(", ") }));
}
// The owner disagrees, or the mod has been fixed: forget the reports and let it back in.
async function clear({ mod }) { cache.at = 0; await query("delete from broken where mod = $1", [String(mod)]); }
module.exports = { report, mine, benched, queue, clear, REASONS, NEEDED, DAYS };
