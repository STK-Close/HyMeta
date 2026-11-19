// Accounts: sign up, sign in, sign out, delete, and the lists a member keeps.
// Passwords are never stored. Only a salted scrypt hash is.
const crypto = require("crypto");
const { query } = require("./db");

const COOKIE = "hymeta_session", THIRTY_DAYS = 30 * 24 * 3600;
const LISTS = ["saved", "savedMods", "stamps"], MAX_ITEMS = 500;
const RUDE = ["fuck", "shit", "bitch", "bastard", "asshole", "dick", "cock", "pussy", "slut", "whore", "nazi", "hitler", "sexy", "porn", "nude", "rape"];
const CONTACT = /(https?:|www\.|@|\.(com|net|org|gg)\b|\d{7,})/i;

const scrypt = (password, salt) => new Promise((ok, no) => crypto.scrypt(password, salt, 64, (e, key) => (e ? no(e) : ok(key))));
async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  return "scrypt$" + salt.toString("hex") + "$" + (await scrypt(password, salt)).toString("hex");
}
async function passwordMatches(password, stored) {
  const [kind, salt, hash] = String(stored).split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const want = Buffer.from(hash, "hex"), got = await scrypt(String(password), Buffer.from(salt, "hex"));
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}
const digest = (token) => crypto.createHash("sha256").update(token).digest("hex");

function problem(message) { return Object.assign(new Error(message), { code: "invalid" }); }
function cleanEmail(email) {
  const e = String(email || "").trim().toLowerCase();
  if (e.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw problem("Enter a real email address.");
  return e;
}
function cleanName(name) {
  const n = String(name || "").trim().replace(/\s+/g, " ");
  if (n.length < 2 || n.length > 24) throw problem("Pick a display name between 2 and 24 characters.");
  if (!/^[\p{L}\p{N} _.'-]+$/u.test(n)) throw problem("Display names can use letters, numbers and spaces.");
  if (CONTACT.test(n) || RUDE.some((w) => n.toLowerCase().includes(w))) throw problem("Pick a friendlier display name, with nothing personal in it.");
  return n;
}
function checkPassword(password) {
  if (typeof password !== "string" || password.length < 8 || password.length > 200) throw problem("Use a password of at least 8 characters.");
  return password;
}

async function startSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  await query("insert into sessions (token_hash, user_id, expires_at) values ($1, $2, now() + interval '30 days')", [digest(token), userId]);
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${THIRTY_DAYS}`;
}
const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
function tokenFrom(req) {
  const m = String((req.headers && req.headers.cookie) || "").match(new RegExp("(?:^|;\\s*)" + COOKIE + "=([a-f0-9]{64})"));
  return m ? m[1] : "";
}
async function currentUser(req) {
  const token = tokenFrom(req);
  if (!token) return null;
  const rows = await query("select u.id, u.email, u.name, u.tier from sessions s join users u on u.id = s.user_id where s.token_hash = $1 and s.expires_at > now()", [digest(token)]);
  return rows[0] || null;
}

async function signUp({ email, password, name, over13 }) {
  if (over13 !== true) throw problem("Accounts are for ages 13 and up. Tick the box to confirm.");
  const e = cleanEmail(email), n = cleanName(name), hash = await hashPassword(checkPassword(password));
  const rows = await query("insert into users (email, name, pass_hash) values ($1, $2, $3) on conflict (email) do nothing returning id", [e, n, hash]);
  if (!rows.length) throw problem("That email already has an account. Sign in instead.");
  return startSession(rows[0].id);
}
async function signIn({ email, password }) {
  const rows = await query("select id, pass_hash from users where email = $1", [String(email || "").trim().toLowerCase()]);
  // hash even when the email is unknown, so the reply takes the same time either way
  const ok = await passwordMatches(password, rows[0] ? rows[0].pass_hash : "scrypt$00$00");
  if (!rows[0] || !ok) throw problem("That email and password do not match.");
  return startSession(rows[0].id);
}
async function signOut(req) {
  const token = tokenFrom(req);
  if (token) await query("delete from sessions where token_hash = $1", [digest(token)]);
  return clearCookie();
}
// Deleting the account removes everything tied to it: sessions and kept items go with it.
async function deleteAccount(user) {
  await query("delete from users where id = $1", [user.id]);
  return clearCookie();
}

async function lists(user) {
  const rows = await query("select list, item from kept where user_id = $1 order by created_at, item", [user.id]);
  const out = { saved: [], savedMods: [], stamps: [] };
  rows.forEach((r) => { if (out[r.list]) out[r.list].push(r.item); });
  return out;
}
async function keep(user, { list, id, on }) {
  if (!LISTS.includes(list) || typeof id !== "string" || !/^[a-z0-9-]{1,80}$/.test(id)) throw problem("That item cannot be saved.");
  if (on === false) { await query("delete from kept where user_id = $1 and list = $2 and item = $3", [user.id, list, id]); return; }
  const count = await query("select count(*)::int as n from kept where user_id = $1 and list = $2", [user.id, list]);
  if (count[0].n >= MAX_ITEMS) throw problem("That list is full.");
  await query("insert into kept (user_id, list, item) values ($1, $2, $3) on conflict do nothing", [user.id, list, id]);
}
module.exports = { currentUser, signUp, signIn, signOut, deleteAccount, lists, keep };
