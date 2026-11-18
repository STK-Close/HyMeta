// Live mod search for the playpack builder. With no search word it returns the most popular mods.
const { guard, json, query } = require("../lib/gate");
const { search, shape, fail } = require("../lib/cf");
module.exports = async (req, res) => {
  if (!guard(req, res)) return;
  try {
    const q = String(query(req).get("q") || "").trim().slice(0, 60);
    json(res, 200, { mods: (await search({ q: q.length >= 2 ? q : "", size: 24 })).slice(0, 20).map(shape) });
  } catch (e) { fail(res, json, e); }
};
