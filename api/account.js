// Everything about a member's account. GET returns who is signed in and what they have kept.
// POST takes { op: "signup" | "login" | "logout" | "delete" | "keep", ... }.
const { guard, json } = require("../lib/gate");
const db = require("../lib/db");
const accounts = require("../lib/accounts");
const billing = require("../lib/billing");

const publicUser = (u) => ({ name: u.name, email: u.email, tier: u.tier });

module.exports = async (req, res) => {
  if (!guard(req, res)) return;
  if (!db.enabled()) return json(res, 200, { enabled: false, user: null });
  try {
    if (req.method === "GET") {
      const user = await accounts.currentUser(req);
      const paid = billing.enabled(); // once payments are on, membership is real and comes from the account
      return json(res, 200, user ? { enabled: true, billing: paid, user: { ...publicUser(user), tier: (await accounts.isMember(user)) ? "member" : "free", owner: await accounts.isOwner(user) }, ...(await accounts.lists(user)) } : { enabled: true, billing: paid, user: null });
    }
    if (req.method !== "POST" || !/application\/json/i.test(String(req.headers["content-type"] || ""))) return json(res, 405, { error: "method" });
    const body = req.body && typeof req.body === "object" ? req.body : {};
    if (body.op === "signup" || body.op === "login") {
      let cookie;
      try { cookie = await (body.op === "signup" ? accounts.signUp(body) : accounts.signIn(body)); }
      catch (e) { if (e.code === "invalid" && body.op === "login") await new Promise((r) => setTimeout(r, 500)); throw e; }
      res.setHeader("Set-Cookie", cookie);
      return json(res, 200, { ok: true });
    }
    if (body.op === "logout") { res.setHeader("Set-Cookie", await accounts.signOut(req)); return json(res, 200, { ok: true }); }
    const user = await accounts.currentUser(req);
    if (!user) return json(res, 401, { error: "signedout", message: "Sign in first." });
    if (body.op === "delete") { res.setHeader("Set-Cookie", await accounts.deleteAccount(user)); return json(res, 200, { ok: true }); }
    if (body.op === "keep") { await accounts.keep(user, body); return json(res, 200, { ok: true }); }
    return json(res, 400, { error: "unknown" });
  } catch (e) {
    if (e.code === "invalid") return json(res, 400, { error: "invalid", message: e.message });
    console.error("account error", e && e.message);
    return json(res, 500, { error: "server", message: "Something went wrong on our side. Try again in a moment." });
  }
};
