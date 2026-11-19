// Playpacks built by members. A playpack waits for the owner's approval before anyone else sees it.
// Only its name, one line of description and the ids of the chosen mods are kept.
const crypto = require("crypto");
const { query } = require("./db");
const { problem, RUDE, CONTACT } = require("./accounts");

const MAX_WAITING = 5, MAX_TOTAL = 30;
const REASONS = ["Rude or hurtful", "Shares personal information", "Spam or a scam", "Something else"];
const NOT_APPROVED = "It does not follow the community rules.";

function cleanText(text, label, min, max) {
  const t = String(text || "").trim().replace(/\s+/g, " ");
  if (t.length < min || t.length > max) throw problem(`${label} needs ${min ? "between " + min + " and " : "at most "}${max} characters.`);
  if (CONTACT.test(t)) throw problem("Leave out links, emails and phone numbers.");
  if (RUDE.some((w) => t.toLowerCase().includes(w))) throw problem("Keep it friendly. Try different words.");
  return t;
}
const shape = (r, viewerId) => ({ id: r.id, name: r.name, blurb: r.blurb, mods: r.mods, by: r.author, authorId: "u" + r.user_id, status: r.status, reason: r.reason, mine: String(r.user_id) === String(viewerId) });
const SELECT = "select p.id, p.user_id, p.name, p.blurb, p.mods, p.status, p.reason, u.name as author from shared_packs p join users u on u.id = p.user_id";

async function submit(user, { name, blurb, mods }) {
  const n = cleanText(name, "The name", 2, 40), b = cleanText(blurb, "The description", 0, 90) || "A playpack built by a member.";
  const ids = [...new Set(Array.isArray(mods) ? mods : [])];
  if (ids.length < 3) throw problem("Pick at least three mods.");
  if (ids.length > 20 || !ids.every((i) => typeof i === "string" && /^cf\d{1,12}$/.test(i))) throw problem("A playpack holds up to 20 mods.");
  const counts = (await query("select count(*)::int as total, count(*) filter (where status = 'pending')::int as waiting from shared_packs where user_id = $1", [user.id]))[0];
  if (counts.waiting >= MAX_WAITING) throw problem("You already have " + MAX_WAITING + " playpacks waiting for review. Give us a moment to catch up.");
  if (counts.total >= MAX_TOTAL) throw problem("You have reached the limit of " + MAX_TOTAL + " playpacks. Delete one to make room.");
  const id = "c" + crypto.randomBytes(6).toString("hex");
  await query("insert into shared_packs (id, user_id, name, blurb, mods) values ($1, $2, $3, $4, $5::jsonb)", [id, user.id, n, b, JSON.stringify(ids)]);
  return id;
}
async function remove(user, { id }) { await query("delete from shared_packs where id = $1 and user_id = $2", [String(id), user.id]); }

// What one member sees: approved playpacks from others (minus anything they reported or anyone they blocked), and all of their own.
async function view(user) {
  const hidden = (await query("select list, item from kept where user_id = $1 and list in ('hidden', 'blocked')", [user.id]));
  const hide = new Set(hidden.filter((h) => h.list === "hidden").map((h) => h.item)), blockedIds = hidden.filter((h) => h.list === "blocked").map((h) => h.item);
  const rows = await query(SELECT + " where p.status = 'approved' or p.user_id = $1 order by p.created_at desc", [user.id]);
  const names = blockedIds.length ? await query("select id, name from users where id = any($1::bigint[])", [blockedIds.map((b) => b.slice(1))]) : [];
  return {
    packs: rows.filter((r) => String(r.user_id) !== String(user.id) && !hide.has(r.id) && !blockedIds.includes("u" + r.user_id)).map((r) => shape(r, user.id)),
    mine: rows.filter((r) => String(r.user_id) === String(user.id)).map((r) => shape(r, user.id)),
    blocked: blockedIds.map((b) => ({ id: b, name: (names.find((n) => "u" + n.id === b) || { name: "A deleted member" }).name })),
  };
}
async function report(user, { id, why }) {
  const reason = REASONS[Number(why)] || REASONS[3];
  const rows = await query("select user_id from shared_packs where id = $1 and status = 'approved'", [String(id)]);
  if (!rows.length || String(rows[0].user_id) === String(user.id)) throw problem("That playpack cannot be reported.");
  await query("insert into reports (pack_id, user_id, why) values ($1, $2, $3) on conflict (pack_id, user_id) do update set why = excluded.why", [String(id), user.id, reason]);
  await query("insert into kept (user_id, list, item) values ($1, 'hidden', $2) on conflict do nothing", [user.id, String(id)]);
}
async function block(user, { id }) {
  const rows = await query("select user_id from shared_packs where id = $1", [String(id)]);
  if (!rows.length || String(rows[0].user_id) === String(user.id)) throw problem("That member cannot be blocked.");
  await query("insert into kept (user_id, list, item) values ($1, 'blocked', $2) on conflict do nothing", [user.id, "u" + rows[0].user_id]);
}
async function unblock(user, { author }) { await query("delete from kept where user_id = $1 and list = 'blocked' and item = $2", [user.id, String(author)]); }

// ---- the owner's side ----
async function queue() {
  const waiting = await query(SELECT + " where p.status = 'pending' order by p.created_at");
  const reported = await query("select p.id, p.name, u.name as author, count(*)::int as count, string_agg(distinct r.why, ', ') as reasons from reports r join shared_packs p on p.id = r.pack_id join users u on u.id = p.user_id where p.status = 'approved' group by p.id, p.name, u.name order by count(*) desc");
  return { waiting: waiting.map((r) => shape(r, 0)), reported: reported.map((r) => ({ id: r.id, name: r.name, by: r.author, count: r.count, reasons: r.reasons })) };
}
async function review({ id, approve }) {
  const rows = await query("update shared_packs set status = $2, reason = $3, reviewed_at = now() where id = $1 returning id", [String(id), approve ? "approved" : "rejected", approve ? "" : NOT_APPROVED]);
  if (!rows.length) throw problem("That playpack is gone.");
  if (!approve) await query("delete from reports where pack_id = $1", [String(id)]);
}
async function dismiss({ id }) { await query("delete from reports where pack_id = $1", [String(id)]); }
// The owner may open any playpack, including one still waiting.
async function one(id) { const rows = await query(SELECT + " where p.id = $1", [String(id)]); return rows[0] ? shape(rows[0], 0) : null; }

module.exports = { submit, remove, view, report, block, unblock, queue, review, dismiss, one };
