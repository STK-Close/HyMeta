// POST { pack } makes a code on the phone. GET ?code=BCDF-1234 opens it on the computer.
const { guard, json, query } = require("../lib/gate");
const db = require("../lib/db");
const handoff = require("../lib/handoff");
module.exports = async (req, res) => {
  if (!guard(req, res)) return;
  if (!db.enabled()) return json(res, 200, { enabled: false });
  try {
    if (req.method === "GET") return json(res, 200, { enabled: true, pack: await handoff.open(query(req).get("code")) });
    if (req.method !== "POST" || !/application\/json/i.test(String(req.headers["content-type"] || ""))) return json(res, 405, { error: "method" });
    const body = req.body && typeof req.body === "object" ? req.body : {};
    return json(res, 200, { enabled: true, code: await handoff.create(body.pack) });
  } catch (e) {
    if (e.code === "invalid") return json(res, 400, { error: "invalid", message: e.message });
    console.error("handoff error", e && e.message);
    return json(res, 500, { error: "server", message: "Something went wrong on our side. Try again in a moment." });
  }
};
