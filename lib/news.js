// The weekly email: one short note from Hex about the playpack that is free right now.
// It says only HyMeta's own words. No mod names or details from CurseForge go into it.
// It needs a postal address for Lumina Art House (MAIL_ADDRESS in the host's settings),
// because United States law (CAN-SPAM) requires one on every newsletter.
const db = require("./db"), mail = require("./mail");
const { FREE_PACK } = require("./recipes");

const ISSUES = {
  "cozy-farmer": ["The cozy farmer", "Plant things. Pet things. Watch the rain. Nothing bad happens.", "Plant a turnip. Just one. You can stop any time. That is what the last farmer said."],
  "dungeon-gremlin": ["Dungeon gremlin", "Go down. Hit things. Carry out more than you can hold.", "The loot is at the bottom. The stairs back up are your problem."],
  "master-builder": ["Master builder", "More blocks, more furniture, more reasons to move one window.", "One more window, you said. See you in six hours."],
  "the-wanderer": ["The wanderer", "New places past every hill, and a map that never quite ends.", "It is just over that hill. So is the next thing."],
  "beast-friend": ["Beast friend", "Creatures to find, feed and accidentally adopt.", "It followed you home. So did the other nine."],
  "wizard-dropout": ["Wizard school dropout", "Spells, staffs and consequences.", "Point the wand away from your face. The other end."],
  "factory-goblin": ["Factory goblin", "Machines that do the work, and machines that feed those machines.", "It starts with one conveyor belt. It ends with a flowchart."],
  "hard-mode-hermit": ["Hard mode hermit", "Everything is harder. You asked for this.", "One life. Use it wisely. Or in the first four minutes."],
  "too-many-legs": ["Too many legs", "Spiders. Then more spiders.", "I counted them for you. Then I stopped counting."],
};
const address = () => String(process.env.MAIL_ADDRESS || "").trim().replace(/\s+/g, " ");
function enabled() { return mail.enabled() && address().length > 8; }
function issue() {
  const known = ISSUES[FREE_PACK] || ["A new playpack", "A fresh set of mods, picked to work together.", "I picked this one myself. You are welcome."];
  return { key: FREE_PACK, name: known[0], blurb: known[1], hex: known[2] };
}
function compose(user, site) {
  const it = issue(), unsub = site + "/api/mail?unsub=" + user.news_token;
  const { text, html } = mail.layout({
    heading: "Free this week: " + it.name,
    lines: [it.blurb, "Hex says: " + it.hex, "It is about eight mods, picked to work together. One tap each to install."],
    button: ["See this week's playpack", site + "/#pack-" + it.key],
    footer: ["You get this because you asked for HyMeta's weekly email.", "Stop these emails: " + unsub, "Lumina Art House, LLC, " + address()],
  });
  return { to: user.email, subject: "Free this week on HyMeta: " + it.name, text, html, headers: { "List-Unsubscribe": "<" + unsub + ">", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } };
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
module.exports = { enabled, issue, compose, sendBatch, ISSUES };
