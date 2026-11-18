// This week's lesser-known mod for the home screen.
const { guard, json } = require("../lib/gate");
const { fail } = require("../lib/cf");
const { spotlight } = require("../lib/recipes");
module.exports = async (req, res) => {
  if (!guard(req, res)) return;
  try { json(res, 200, { mod: await spotlight() }); } catch (e) { fail(res, json, e); }
};
