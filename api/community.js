// Playpacks built by members. GET returns what the signed-in member may see.
// POST takes { op: "submit" | "delete" | "report" | "block" | "unblock" | "review" | "dismiss" | "broken" | "brokenclear", ... }.
const { guard, json } = require("../lib/gate");
const db = require("../lib/db");
const accounts = require("../lib/accounts");
const community = require("../lib/community"), broken = require("../lib/broken");

// A note to the owner: a playpack is waiting for review (at most one an hour), or a mod has just been benched.
async function tellOwner(req, what) {
  const mail = require("../lib/mail"), site = mail.siteUrl(req);
  if (!mail.enabled() || !site) return;
  const to = await accounts.ownerEmail(); if (!to) return;
  if (what === "bench") {
    const { text, html } = mail.layout({ heading: "Players say a mod is not working", lines: ["Three players have reported the same mod as broken, so Hex has left it out of the playpacks and picked the next best one instead.", "Nothing is needed from you. The reports fade after 30 days and the mod gets another chance. You can also clear them yourself."],
      button: ["See the reports", site + "/#you"], footer: ["Sent to the owner of HyMeta only."] });
    return mail.send({ to, subject: "HyMeta: a mod has been benched", text, html });
  }
  const fresh = await db.query("insert into settings (key, value) values ('review-note', now()::text) on conflict (key) do update set value = now()::text where settings.value::timestamptz < now() - interval '1 hour' returning value");
  if (!fresh.length) return;
  const { text, html } = mail.layout({ heading: "A playpack is waiting for review", lines: ["A member has sent a playpack to be shared. Nobody else can see it until you approve it.", "You will get at most one of these notes an hour, however many arrive."],
    button: ["Open the review queue", site + "/#you"], footer: ["Sent to the owner of HyMeta only."] });
  await mail.send({ to, subject: "HyMeta: a playpack is waiting for review", text, html });
}

module.exports = async (req, res) => {
  if (!guard(req, res)) return;
  if (!db.enabled()) return json(res, 200, { enabled: false });
  try {
    const user = await accounts.currentUser(req);
    if (!user) return json(res, 401, { error: "signedout", message: "Sign in first." });
    const owner = await accounts.isOwner(user);
    if (req.method === "GET") return json(res, 200, { enabled: true, ...(await community.view(user)), broken: await broken.mine(user), ...(owner ? { queue: { ...(await community.queue()), broken: await broken.queue() } } : {}) });
    if (req.method !== "POST" || !/application\/json/i.test(String(req.headers["content-type"] || ""))) return json(res, 405, { error: "method" });
    const body = req.body && typeof req.body === "object" ? req.body : {};
    if (body.op === "submit") {
      const id = await community.submit(user, body);
      await tellOwner(req).catch((e) => console.error("review note not sent", e && e.message)); // never blocks the member
      return json(res, 200, { ok: true, id });
    }
    if (body.op === "broken") {
      const benchedNow = await broken.report(user, body);
      if (benchedNow) await tellOwner(req, "bench").catch((e) => console.error("bench note not sent", e && e.message));
      return json(res, 200, { ok: true, broken: await broken.mine(user) });
    }
    if (body.op === "brokenclear") {
      if (!owner) return json(res, 403, { error: "notowner", message: "Only the owner can clear reports." });
      await broken.clear(body); return json(res, 200, { ok: true });
    }
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
