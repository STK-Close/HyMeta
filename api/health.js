// Tells the app whether live CurseForge data is available.
const { guard, json } = require("../lib/gate");
const { hasKey } = require("../lib/cf");
module.exports = (req, res) => { if (guard(req, res)) json(res, 200, { ok: true, live: hasKey() }); };
