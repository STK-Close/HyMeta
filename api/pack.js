// The mods in one playpack, fetched live from CurseForge.
const { guard, json, query } = require("../lib/gate");
const { fail } = require("../lib/cf");
const { resolve, FREE_PACK } = require("../lib/recipes");
const db = require("../lib/db"), accounts = require("../lib/accounts"), billing = require("../lib/billing");
module.exports = async (req, res) => {
  if (!guard(req, res)) return;
  try {
    const id = String(query(req).get("id") || "");
    // once payments are on, every other playpack is for members only, checked here on the server
    if (billing.enabled() && db.enabled() && id !== FREE_PACK) {
      const user = await accounts.currentUser(req);
      if (!user || !(await accounts.isMember(user))) return json(res, 403, { error: "members" });
    }
    const pack = await resolve(id);
    if (!pack) return json(res, 404, { error: "unknown" });
    json(res, 200, pack);
  } catch (e) { fail(res, json, e); }
};
