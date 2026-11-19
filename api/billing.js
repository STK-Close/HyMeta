// Membership payments. POST { op: "checkout", plan } and { op: "portal" } return a Stripe page to go to.
// POST { op: "sync" } refreshes the signed-in member's status. Stripe's own messages also arrive here.
const { authed, json } = require("../lib/gate");
const db = require("../lib/db");
const accounts = require("../lib/accounts");
const billing = require("../lib/billing");

module.exports = async (req, res) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  try {
    if (!billing.enabled() || !db.enabled()) return json(res, 200, { enabled: false });
    // Stripe cannot sign in to the site, so its messages are let through and checked against Stripe itself
    if (req.method === "POST" && body.object === "event") { await billing.handleEvent(body); return json(res, 200, { received: true }); }
    if (!authed(req)) return json(res, 401, { error: "locked" });
    if (req.method !== "POST" || !/application\/json/i.test(String(req.headers["content-type"] || ""))) return json(res, 405, { error: "method" });
    const user = await accounts.currentUser(req);
    if (!user) return json(res, 401, { error: "signedout", message: "Sign in first." });
    const host = String(req.headers.host || ""), origin = (/^(localhost|127\.)/.test(host) ? "http://" : "https://") + host;
    if (body.op === "checkout") return json(res, 200, { url: await billing.checkout(user, body.plan, origin) });
    if (body.op === "portal") return json(res, 200, { url: await billing.portal(user, origin) });
    if (body.op === "sync") { await billing.sync(user); const fresh = await accounts.currentUser(req); return json(res, 200, { tier: (await accounts.isMember(fresh)) ? "member" : "free" }); }
    return json(res, 400, { error: "unknown" });
  } catch (e) {
    if (e.code === "invalid") return json(res, 400, { error: "invalid", message: e.message });
    console.error("billing error", e && e.message);
    return json(res, 502, { error: "payments", message: "The payment service did not answer. Try again in a moment." });
  }
};
