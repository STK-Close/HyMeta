// The mods in one playpack, fetched live from CurseForge.
const { guard, json, query } = require("../lib/gate");
const { fail } = require("../lib/cf");
const { resolve } = require("../lib/recipes");
module.exports = async (req, res) => {
  if (!guard(req, res)) return;
  try {
    const pack = await resolve(String(query(req).get("id") || ""));
    if (!pack) return json(res, 404, { error: "unknown" });
    json(res, 200, pack);
  } catch (e) { fail(res, json, e); }
};
