// Playpacks built by members. GET returns what the signed-in member may see.
// POST takes { op: "submit" | "delete" | "report" | "block" | "unblock" | "review" | "dismiss", ... }.
const { guard, json } = require("../lib/gate");
const db = require("../lib/db");
const accounts = require("../lib/accounts");
const community = require("../lib/community");

module.exports = async (req, res) => {
  if (!guard(req, res)) return;
  if (!db.enabled()) return json(res, 200, { enabled: false });
  try {
    const user = await accounts.currentUser(req);
    if (!user) return json(res, 401, { error: "signedout", message: "Sign in first." });
    const owner = await accounts.isOwner(user);
    if (req.method === "GET") return json(res, 200, { enabled: true, ...(await community.view(user)), ...(owner ? { queue: await community.queue() } : {}) });
    if (req.method !== "POST" || !/application\/json/i.test(String(req.headers["content-type"] || ""))) return json(res, 405, { error: "method" });
    const body = req.body && typeof req.body === "object" ? req.body : {};
    if (body.op === "submit") return json(res, 200, { ok: true, id: await community.submit(user, body) });
    if (body.op === "delete") { await community.remove(user, body); return json(res, 200, { ok: true }); }
    if (body.op === "report") { await community.report(user, body); return json(res, 200, { ok: true }); }
    if (body.op === "block") { await community.block(user, body); return json(res, 200, { ok: true }); }
    if (body.op === "unblock") { await community.unblock(user, body); return json(res, 200, { ok: true }); }
    if (body.op === "review" || body.op === "dismiss") {
      if (!owner) return json(res, 403, { error: "notowner", message: "Only the owner can review playpacks." });
      await (body.op === "review" ? community.review(body) : community.dismiss(body));
      return json(res, 200, { ok: true });
    }
    return json(res, 400, { error: "unknown" });
  } catch (e) {
    if (e.code === "invalid") return json(res, 400, { error: "invalid", message: e.message });
    console.error("community error", e && e.message);
    return json(res, 500, { error: "server", message: "Something went wrong on our side. Try again in a moment." });
  }
};
