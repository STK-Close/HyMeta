// Checks the weekly switch: which playpack is free each week, that next week's stays hidden,
// that the app and the server agree, and that the weekly email follows the week.
// Run: node tests/weeks.test.js
const fs = require("fs"), path = require("path");
const { start } = require("../scripts/dev-server");
const weeks = require("../lib/weeks"), catalog = require("../lib/catalog"), { PACKS } = require("../lib/recipes"), { query } = require("../lib/db");
(async () => {
  const problems = [], bad = (m) => problems.push(m);
  const { base, rota } = catalog, all = base.concat(rota);

  // ----- the calendar -----
  delete process.env.HYMETA_WEEK;
  const at = (iso) => weeks.weekIndex(Date.parse(iso));
  if (at("2026-11-16T09:00:00Z") !== 0 || at("2026-11-19T12:00:00Z") !== 0) bad("launch week should be week 0");
  if (at("2026-11-23T08:59:59Z") !== 0) bad("the week changed before Monday 09:00 UTC");
  if (at("2026-11-23T09:00:00Z") !== 1) bad("the week did not change on Monday at 09:00 UTC");
  if (at("2027-02-08T09:00:00Z") !== 12) bad("week 12 does not start twelve Mondays after launch");
  if (at("2026-01-01T00:00:00Z") !== 0) bad("a date before launch should count as week 0");
  if (new Date(weeks.schedule(0).nextAt).toISOString() !== "2026-11-23T09:00:00.000Z") bad("the countdown does not point at next Monday 09:00 UTC");

  { const now = Date.now(), left = weeks.schedule(weeks.weekIndex(now)).nextAt - now; if (left <= 0 || left > weeks.WEEK_MS) bad("right now, the countdown to the next playpack is not between 0 and 7 days"); }

  // ----- who is free, what is out, what is teased -----
  const seenFree = [];
  for (let i = 0; i <= 70; i++) {
    const w = weeks.schedule(i), prev = i ? weeks.schedule(i - 1) : null;
    if (!w.released.includes(w.free)) bad(`week ${i}: the free playpack (${w.free}) has not been released`);
    if (new Set(w.teasers).size !== 3 || w.teasers.includes(w.free) || w.teasers.some((t) => !w.released.includes(t))) bad(`week ${i}: the three teasers are wrong: ${w.teasers}`);
    if (prev && prev.released.some((id) => !w.released.includes(id))) bad(`week ${i}: a playpack that was out last week has vanished`);
    if (prev && prev.free === w.free) bad(`week ${i}: the same playpack is free two weeks running`);
    if (prev && w.teasers.join() === prev.teasers.join()) bad(`week ${i}: the teasers did not change from last week`);
    if (i < rota.length) {
      if (w.free !== rota[i] || !w.fresh) bad(`week ${i}: the free playpack should be the brand-new one, ${rota[i]}`);
      if (w.released.length !== base.length + i + 1) bad(`week ${i}: ${w.released.length} playpacks are out, expected ${base.length + i + 1}`);
      if (w.released.includes(rota[i + 1])) bad(`week ${i}: next week's playpack is already out`);
    } else {
      if (w.fresh) bad(`week ${i}: called brand-new after the weekly list ran out`);
      if (w.released.length !== all.length) bad(`week ${i}: not every playpack is out`);
    }
    seenFree.push(w.free);
  }
  const lap = seenFree.slice(rota.length, rota.length + all.length);
  if (new Set(lap).size !== all.length) bad("after the weekly list runs out, not every playpack takes a turn at being free");
  if (weeks.schedule(rota.length).free !== "cozy-farmer") bad("the first week after the weekly list, which the other tests rely on, should make The cozy farmer free");
  process.env.HYMETA_WEEK = "after"; if (weeks.weekIndex() !== rota.length) bad("pinning the week to \"after\" does not land on the first week after the weekly list"); delete process.env.HYMETA_WEEK;
  // settled weeks never move: the ledger is the record of what has already been promised
  const ledger = require("../lib/ledger.json");
  if (!ledger.length || ledger.join() !== rota.slice(0, ledger.length).join()) bad("a playpack whose week is settled has been moved or removed: the ledger says " + ledger.join(", "));
  if (ledger.length < weeks.weekIndex(Date.now())) bad("the ledger is behind the calendar"); // a reminder, see docs/weekly-run.md

  // ----- one list of playpacks, shared by the app, the recipes and the pictures -----
  if (all.join() !== Object.keys(catalog.packs).join() || new Set(all).size !== all.length || base.length !== 10 || rota.length < 13) bad("the catalog is not every playpack, each once");
  all.forEach((id) => { if (!PACKS[id]) bad(`${id} has no recipe`); });
  Object.keys(PACKS).forEach((id) => { if (!catalog.packs[id]) bad(`the recipe ${id} is not in the app's list`); });
  for (const [id, c] of Object.entries(catalog.packs)) {
    if (!c.name || !c.blurb || !c.warning || !c.hex) bad(`${id} is missing its name, description, warning or Hex's line`);
    for (const f of [c.art + ".jpg", "thumb-" + c.art + ".jpg"]) if (!fs.existsSync(path.join(__dirname, "../web/images", f))) bad(`${id}: picture ${f} is missing`);
    if (/—/.test(JSON.stringify(c))) bad(`${id}: a long dash in the app's words`);
  }
  // the app works the week out the same way the server does (it does so alone in the preview)
  const src = fs.readFileSync(path.join(__dirname, "../src/app.html"), "utf8"), from = src.indexOf("var LAUNCH = Date.UTC"), to = src.indexOf("var WEEK, FEATURED");
  const appSchedule = new Function("PACKS", "WEEKLY", src.slice(from, to) + "; return scheduleFor;")(base.map((id) => ({ id })), rota.map((id) => ({ id })));
  for (let i = 0; i <= 70; i++) if (JSON.stringify(appSchedule(i)) !== JSON.stringify(weeks.schedule(i))) { bad(`week ${i}: the app and the server disagree about the week`); break; }

  // ----- the server keeps next week's playpack shut, and moves the free one each week -----
  const pw = "gate-pass-1";
  const visit = async (week, fn) => {
    const server = await start({ pretend: true, password: pw, key: "pretend-key", accounts: true, payments: true, mail: true, week });
    process.env.SITE_URL = "https://hymeta.test";
    const jar = {}, call = async (p, body) => { const r = await fetch(server.url + p, { method: body ? "POST" : "GET", headers: { ...(body ? { "Content-Type": "application/json" } : {}), Cookie: Object.entries(jar).map(([k, v]) => k + "=" + v).join("; ") }, body: body ? JSON.stringify(body) : undefined });
      (r.headers.getSetCookie ? r.headers.getSetCookie() : []).forEach((c) => { const [k, v] = c.split(";")[0].split("="); jar[k] = v; });
      const text = await r.text(); let data = text; try { data = JSON.parse(text); } catch (e) {} return { status: r.status, data }; };
    await fn(call, server); server.close();
  };
  const emails = [];
  await visit(0, async (call, server) => {
    const door = (await call("")).data;
    if (!door.includes('id="free-name">Gone fishing<') || !door.includes("/images/pack-fishing.jpg") || !door.includes("New and free this week") || door.includes("/images/pack-farm.jpg")) bad("week 0: the front door does not show Gone fishing as new and free");
    if (door.includes(catalog.packs[rota[1]].name)) bad("week 0: the front door gives away next week's playpack");
    await call("api/login", { password: pw });
    await call("api/account", { op: "signup", email: "owner@example.test", password: "correct-horse-9", name: "The Owner", over13: true }); await call("api/account", { op: "logout" });
    await call("api/account", { op: "signup", email: "fan@example.test", password: "correct-horse-9", name: "Free Fan", over13: true, news: true });
    const health = (await call("api/health")).data;
    if (!health.week || health.week.free !== "gone-fishing" || health.week.index !== 0) bad("week 0: the app is not told which week it is");
    const free = await call("api/pack?id=gone-fishing");
    if (free.status !== 200 || free.data.core.length + free.data.spice.length + free.data.extras.length < 6) bad("week 0: the free playpack did not open with its mods (status " + free.status + ")");
    if ((await call("api/pack?id=cozy-farmer")).status !== 403) bad("week 0: last season's free playpack is still free to a free account");
    if ((await call("api/pack?id=" + rota[1])).status !== 404) bad("week 0: next week's playpack can already be opened");
    await call("api/mail"); await call("api/mail");
    emails.push(...server.outbox.filter((m) => m.to === "fan@example.test").map((m) => m.subject));
    const body = (server.outbox.find((m) => m.to === "fan@example.test") || { text: "" }).text;
    if (!body.includes("https://hymeta.test/#pack-gone-fishing")) bad("week 0: the weekly email does not link to Gone fishing");
  });
  await visit(1, async (call, server) => {
    await call("api/login", { password: pw }); await call("api/account", { op: "login", email: "fan@example.test", password: "correct-horse-9" });
    if ((await call("api/pack?id=" + rota[1])).status !== 200) bad("week 1: the new playpack is not free");
    if ((await call("api/pack?id=gone-fishing")).status !== 403) bad("week 1: last week's playpack is still free to a free account");
    if ((await call("api/pack?id=" + rota[2] + "")).status !== 404) bad("week 1: the playpack for week 2 can already be opened");
    await call("api/mail"); await call("api/mail");
    emails.push(...server.outbox.filter((m) => m.to === "fan@example.test").map((m) => m.subject));
    // the vote: one each, changeable, only for this week's ideas, and the totals are public but nameless
    const poll = catalog.poll;
    if (poll) {
      const mine = async () => (await call("api/account")).data.poll;
      if ((await mine()).id !== poll.id || (await mine()).mine !== null) bad("a member who has not voted is shown as having voted");
      if ((await call("api/account", { op: "vote", idea: "free-membership-for-me" })).status !== 400) bad("a vote for something that is not on the list was counted");
      if ((await call("api/account", { op: "vote", idea: rota[2] })).status !== 400) bad("a vote for an existing playpack was counted");
      const first = await call("api/account", { op: "vote", idea: poll.ideas[0].id });
      if (first.status !== 200 || first.data.counts[poll.ideas[0].id] !== 1) bad("a vote was not counted");
      await call("api/account", { op: "vote", idea: poll.ideas[0].id }); await call("api/account", { op: "vote", idea: poll.ideas[2].id });
      const after = await mine(), sum = Object.values(after.counts).reduce((a, n) => a + n, 0);
      if (sum !== 1 || after.counts[poll.ideas[2].id] !== 1 || after.mine !== poll.ideas[2].id) bad("voting again should move the member's one vote, got " + JSON.stringify(after.counts));
      await query("insert into votes (poll, user_id, idea) select 'w-old', id, $1 from users", [poll.ideas[0].id]); // an earlier vote must not leak into this one
      const pub = await (await fetch(server.url + "api/mail?poll=1")).json();
      if (pub.poll !== poll.id || pub.week !== poll.week || pub.ideas.length !== 3 || pub.ideas.find((i) => i.id === poll.ideas[2].id).votes !== 1 || pub.ideas.reduce((a, i) => a + i.votes, 0) !== 1) bad("the public totals are wrong: " + JSON.stringify(pub));
      if (/example\.test|Free Fan|user/i.test(JSON.stringify(pub))) bad("the public totals say who voted");
    }
    // the owner, a member without paying, can open past weeks but still not the future
    await call("api/account", { op: "logout" }); await call("api/account", { op: "login", email: "owner@example.test", password: "correct-horse-9" });
    if ((await call("api/pack?id=gone-fishing")).status !== 200) bad("week 1: a member cannot open a past week's playpack");
    if ((await call("api/pack?id=" + rota[2] + "")).status !== 404) bad("week 1: a member can open a playpack before its week");
  });
  if (emails.join(" | ") !== "New this week on HyMeta: Gone fishing | New this week on HyMeta: " + catalog.packs[rota[1]].name) bad("the weekly email should go out once for each new week, got: " + emails.join(" | "));
  await visit("after", async (call) => { if (!(await call("")).data.includes(">Free this week<") || !(await call("")).data.includes('id="free-name">The cozy farmer<')) bad("after the weekly list: the front door should show The cozy farmer as free, not as new"); });
  console.log(problems.length ? problems.join("\n") : "WEEKS OK");
  process.exit(problems.length ? 1 : 0);
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
