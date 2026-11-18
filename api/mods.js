// Details for specific mods, used for saved mods and for playpacks a member built.
const { guard, json, query } = require("../lib/gate");
const { byIds, shape, fail } = require("../lib/cf");
module.exports = async (req, res) => {
  if (!guard(req, res)) return;
  try {
    const ids = String(query(req).get("ids") || "").split(",").map((s) => s.replace(/^cf/, ""));
    json(res, 200, { mods: (await byIds(ids)).map(shape) });
  } catch (e) { fail(res, json, e); }
};
