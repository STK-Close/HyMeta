// Tells the app whether live CurseForge data is available, and which week it is.
const { guard, json } = require("../lib/gate");
const { hasKey } = require("../lib/cf");
const { schedule } = require("../lib/weeks");
module.exports = (req, res) => { if (guard(req, res)) json(res, 200, { ok: true, live: hasKey(), week: schedule() }); };
