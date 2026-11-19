// The weekly email: one short note from Hex about the playpack that is free this week.
// It says only HyMeta's own words. No mod names or details from CurseForge go into it.
// It needs a postal address for Lumina Art House (MAIL_ADDRESS in the host's settings),
// because United States law (CAN-SPAM) requires one on every newsletter.
const db = require("./db"), mail = require("./mail");
const weeks = require("./weeks");

const address = () => String(process.env.MAIL_ADDRESS || "").trim().replace(/\s+/g, " ");
function enabled() { return mail.enabled() && address().length > 8; }
function issue() {
  const week = weeks.schedule(), c = weeks.card(week.free);
  return { key: week.index + ":" + week.free, id: week.free, fresh: week.fresh, name: c.name, blurb: c.blurb, hex: c.hex };
}
function compose(user, site) {
  const it = issue(), unsub = site + "/api/mail?unsub=" + user.news_token;
  const { text, html } = mail.layout({
    heading: (it.fresh ? "New and free this week: " : "Free this week: ") + it.name,
    lines: [it.blurb, "Hex says: " + it.hex, "It is about eight mods, picked to work together. One tap each to install."],
    button: ["See this week's playpack", site + "/#pack-" + it.id],
    footer: ["You get this because you asked for HyMeta's weekly email.", "Stop these emails: " + unsub, "Lumina Art House, LLC, " + address()],
  });
  return { to: user.email, subject: (it.fresh ? "New this week on HyMeta: " : "Free this week on HyMeta: ") + it.name, text, html, headers: { "List-Unsubscribe": "<" + unsub + ">", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } };
}
// Sends the current issue to everyone who asked for it and has not had it yet. Safe to run as
// often as you like: nobody gets the same issue twice. Stops at the day's allowance and carries
// on the next day.
async function sendBatch(site, budgetMs) {
  if (!enabled() || !site) return { sent: 0, left: 0, on: false };
  const key = issue().key, until = Date.now() + (budgetMs || 40000);
  const rows = await db.query("select id, email, news_token from users where news and news_token is not null and coalesce(news_issue, '') <> $1 order by id limit 400", [key]);
  let sent = 0, stopped = false;
  for (let i = 0; i < rows.length && !stopped && Date.now() < until; i += 5) {
    await Promise.all(rows.slice(i, i + 5).map(async (u) => {
      try { await mail.send({ ...compose(u, site), reserve: 20 }); await db.query("update users set news_issue = $1 where id = $2", [key, u.id]); sent++; }
      catch (e) { if (e.code === "cap") stopped = true; }
    }));
  }
  return { sent, left: rows.length - sent, on: true };
}
module.exports = { enabled, issue, compose, sendBatch };
