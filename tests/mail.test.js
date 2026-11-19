// Checks password reset, the weekly email and the daily allowance against a throwaway database
// and a pretend email service. Nothing is really sent.
// Run: node tests/mail.test.js
process.env.HYMETA_LOCAL_DB = "1"; process.env.HYMETA_WEEK = "12"; // week 12: The cozy farmer is free
const { pretendMail } = require("../scripts/dev-server");
const post = pretendMail();
const a = require("../lib/accounts"), mail = require("../lib/mail"), news = require("../lib/news"), { query } = require("../lib/db");
const handler = require("../api/mail");
const call = (method, url, body, headers) => new Promise((done) => {
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(text) { let data = text; try { data = JSON.parse(text); } catch (e) {} done({ status: this.statusCode, data, headers: this.headers }); } };
  handler({ method, url, body, headers: { host: "evil.example", "content-type": "application/json", ...(headers || {}) } }, res);
});
(async () => {
  const problems = [], bad = (m) => problems.push(m);
  const SITE = "https://hymeta.test";
  const good = { email: "kid@example.test", password: "correct-horse-9", name: "Moss Goblin", over13: true };
  const cookie = (await a.signUp(good)).split(";")[0];
  const linkIn = (m, kind) => (m.text.match(new RegExp("https://hymeta\\.test/api/mail\\?" + kind + "=([a-f0-9]+)")) || [])[1];

  // ----- off until it is set up -----
  if (mail.enabled() || news.enabled()) bad("email counts as set up with no key");
  await call("POST", "/api/mail", { op: "forgot", email: good.email });
  if (post.outbox.length) bad("an email was sent with no key set");
  process.env.BREVO_API_KEY = "pretend-mail-key"; process.env.MAIL_FROM = "hello@hymeta.test";
  if (!mail.enabled()) bad("email is not on with a key and a From address");
  if (news.enabled()) bad("the weekly email is on without a postal address, which the law requires");
  // links are never built from the address a visitor claims to be using
  await call("POST", "/api/mail", { op: "forgot", email: good.email });
  if (post.outbox.length) bad("a reset link was built from the visitor's own Host header: " + (post.outbox[0] || {}).text);
  await query("delete from resets");
  process.env.SITE_URL = SITE;

  // ----- forgotten password -----
  let t0 = Date.now(); const known = await call("POST", "/api/mail", { op: "forgot", email: "KID@example.test " }); const tKnown = Date.now() - t0;
  t0 = Date.now(); const unknown = await call("POST", "/api/mail", { op: "forgot", email: "nobody@example.test" }); const tUnknown = Date.now() - t0;
  if (JSON.stringify(known.data) !== JSON.stringify(unknown.data) || known.status !== unknown.status) bad("the reply reveals whether an email has an account");
  if (tKnown < 1100 || tUnknown < 1100) bad("the reply time reveals whether an email has an account (" + tKnown + "ms and " + tUnknown + "ms)");
  if (post.outbox.length !== 1 || post.outbox[0].to !== good.email) bad("a reset email should go to the account's address only, got " + post.outbox.length);
  const m = post.outbox[0] || { text: "", html: "" }, token = linkIn(m, "reset");
  if (!token || token.length !== 64) bad("the reset email carries no link");
  if (m.from !== "hello@hymeta.test" || !/Reset your HyMeta password/.test(m.subject) || !m.html.includes(token)) bad("the reset email is malformed");
  if ((await query("select token_hash from resets"))[0].token_hash === token) bad("the reset secret is stored as it is, not as a hash");
  await call("POST", "/api/mail", { op: "forgot", email: good.email });
  if (post.outbox.length !== 1) bad("a second reset email was sent straight after the first");
  const page = await call("GET", "/api/mail?reset=" + token);
  if (page.status !== 200 || !/Choose a new password/.test(page.data) || page.headers["Referrer-Policy"] !== "no-referrer" || !/noindex/.test(page.headers["X-Robots-Tag"])) bad("the reset page is missing or unprotected");
  if (/<script>alert/.test((await call("GET", "/api/mail?reset=%3Cscript%3Ealert(1)%3C/script%3E")).data)) bad("the reset page repeats whatever is put in its address");
  const weak = await call("POST", "/api/mail", { op: "reset", token, password: "short" });
  if (weak.status !== 400 || !/8 characters/.test(weak.data.message)) bad("a weak new password was not refused");
  if ((await call("POST", "/api/mail", { op: "reset", token: "0".repeat(64), password: "brand-new-pass-1" })).status !== 400) bad("a made-up reset link was accepted");
  const done = await call("POST", "/api/mail", { op: "reset", token, password: "brand-new-pass-1" });
  if (done.status !== 200) bad("a real reset link was refused, after a weak password had been tried first: " + JSON.stringify(done.data));
  if (await a.currentUser({ headers: { cookie } })) bad("resetting the password left other devices signed in");
  try { await a.signIn({ email: good.email, password: good.password }); bad("the old password still works after a reset"); } catch (e) {}
  const fresh = (await a.signIn({ email: good.email, password: "brand-new-pass-1" })).split(";")[0];
  if ((await call("POST", "/api/mail", { op: "reset", token, password: "another-pass-22" })).status !== 400) bad("a reset link worked twice");
  await query("update resets set created_at = now() - interval '3 minutes'");
  await call("POST", "/api/mail", { op: "forgot", email: good.email });
  const stale = linkIn(post.outbox[post.outbox.length - 1], "reset");
  await query("update resets set expires_at = now() - interval '1 minute' where not used");
  if ((await call("POST", "/api/mail", { op: "reset", token: stale, password: "another-pass-22" })).status !== 400) bad("a reset link worked after its hour was up");
  for (let i = 0; i < 6; i++) { await query("update resets set created_at = created_at - interval '3 minutes'"); await call("POST", "/api/mail", { op: "forgot", email: good.email }); }
  if (post.outbox.length !== 5) bad("more than five reset emails in a day can be sent to one person, sent " + post.outbox.length);

  // ----- the weekly email -----
  post.outbox.length = 0;
  const me = await a.currentUser({ headers: { cookie: fresh } });
  await a.setNews(me, true);
  await a.signUp({ ...good, email: "quiet@example.test", name: "Quiet One" });                 // did not ask for it
  await a.signUp({ ...good, email: "keen@example.test", name: "Keen One", news: true });       // asked at sign-up
  if ((await call("GET", "/api/mail")).data.sent !== 0 || post.outbox.length) bad("the weekly email went out with no postal address set");
  process.env.MAIL_ADDRESS = "1 Pretend Street, Testville, FL 00000";
  const run = await call("GET", "/api/mail");
  const got = post.outbox.map((x) => x.to).sort().join(",");
  if (run.data.sent !== 2 || got !== "keen@example.test,kid@example.test") bad("the weekly email should reach only the two who asked, reached: " + got);
  const n = post.outbox.find((x) => x.to === good.email) || { text: "", headers: {} }, unsub = linkIn(n, "unsub");
  if (!/The cozy farmer/.test(n.subject + n.text) || !n.text.includes(SITE + "/#pack-cozy-farmer")) bad("the weekly email does not name this week's free playpack or link to it");
  if (!n.text.includes("1 Pretend Street") || !n.text.includes("Lumina Art House, LLC")) bad("the weekly email has no postal address");
  if (!unsub || n.headers["List-Unsubscribe"] !== "<" + SITE + "/api/mail?unsub=" + unsub + ">" || n.headers["List-Unsubscribe-Post"] !== "List-Unsubscribe=One-Click") bad("the weekly email has no way to stop it");
  if (/pretend mod|curseforge\.com/i.test(n.text + n.html)) bad("the weekly email carries CurseForge details");
  await call("GET", "/api/mail"); await call("GET", "/api/mail");
  if (post.outbox.length !== 2) bad("running the daily send again sent the same issue twice (" + post.outbox.length + " emails)");
  // stopping it
  const upage = await call("GET", "/api/mail?unsub=" + unsub);
  if (!/Stop the weekly email/.test(upage.data)) bad("the stop page is missing");
  if ((await query("select news from users where email = $1", [good.email]))[0].news !== true) bad("just opening the stop link (as a mail scanner does) unsubscribed the member");
  if ((await call("POST", "/api/mail", { op: "unsub", token: "f".repeat(48) })).status !== 400) bad("a made-up stop link was accepted");
  await call("POST", "/api/mail", { op: "unsub", token: unsub });
  if ((await query("select news from users where email = $1", [good.email]))[0].news !== false) bad("the stop button did not stop the emails");
  const keen = linkIn(post.outbox.find((x) => x.to === "keen@example.test"), "unsub");
  await call("POST", "/api/mail?unsub=" + keen, "List-Unsubscribe=One-Click", { "content-type": "application/x-www-form-urlencoded" });
  if ((await query("select news from users where email = 'keen@example.test'"))[0].news !== false) bad("one-click unsubscribe from a mail app did not work");
  await query("update users set news_issue = null");
  await call("GET", "/api/mail");
  if (post.outbox.length !== 2) bad("someone who stopped the emails was sent another");
  // only the owner can send a test
  const stranger = (await a.signIn({ email: "quiet@example.test", password: good.password })).split(";")[0];
  if ((await call("POST", "/api/mail", { op: "test" }, { cookie: stranger })).status !== 403) bad("a member who is not the owner could send a test email");
  const test = await call("POST", "/api/mail", { op: "test" }, { cookie: fresh });
  if (test.status !== 200 || post.outbox.length !== 3 || !/^\[Test\]/.test(post.outbox[2].subject) || post.outbox[2].to !== good.email) bad("the owner's test email did not arrive");
  if ((await query("select news from users where email = $1", [good.email]))[0].news !== false) bad("sending a test switched the owner's weekly email back on");

  // ----- the owner is told when a playpack is waiting for review, at most once an hour -----
  process.env.SITE_OPEN = "1"; post.outbox.length = 0;
  const share = (n) => new Promise((done) => { const res = { setHeader() {}, end(t) { done({ status: this.statusCode, data: JSON.parse(t) }); } };
    require("../api/community")({ method: "POST", url: "/api/community", headers: { host: "evil.example", "content-type": "application/json", cookie: stranger }, body: { op: "submit", name: "Quiet pack " + n, blurb: "A calm set of mods for a rainy day.", mods: ["cf1", "cf2", "cf3"] } }, res); });
  const s1 = await share(1), s2 = await share(2);
  if (s1.status !== 200 || s2.status !== 200) bad("sharing a playpack failed with email on: " + JSON.stringify(s1.data));
  if (post.outbox.length !== 1 || post.outbox[0].to !== good.email || !/waiting for review/.test(post.outbox[0].subject) || !post.outbox[0].text.includes(SITE + "/#you")) bad("the owner should get one note about the review queue, got " + post.outbox.length);
  if (/Quiet pack/.test(post.outbox[0] ? post.outbox[0].text : "")) bad("the note to the owner repeats a member's own words before they are reviewed");
  await query("update settings set value = (now() - interval '2 hours')::text where key = 'review-note'");
  await share(3);
  if (post.outbox.length !== 2) bad("the owner was not told about a playpack that arrived more than an hour after the last note");
  post.state.refuse = true; const s4 = await (async () => { await query("update settings set value = (now() - interval '2 hours')::text where key = 'review-note'"); return share(4); })(); post.state.refuse = false;
  if (s4.status !== 200) bad("a failing email service stopped a member from sharing a playpack");
  delete process.env.SITE_OPEN;

  // ----- the daily allowance can never be passed -----
  post.outbox.length = 0; await query("delete from settings where key like 'mail-%'");
  process.env.MAIL_DAILY_CAP = "25";
  for (let i = 0; i < 12; i++) await a.signUp({ ...good, email: "fan" + i + "@example.test", name: "Fan " + i, news: true });
  const capped = await call("GET", "/api/mail");
  if (post.outbox.length !== 5 || capped.data.left !== 7) bad("the weekly email should stop 20 short of the day's allowance (5 of 25), sent " + post.outbox.length);
  for (let i = 0; i < 30; i++) await mail.send({ to: "x@example.test", subject: "s", text: "t", html: "h" }).catch(() => {});
  if (post.outbox.length !== 25) bad("the day's allowance of 25 was passed: " + post.outbox.length + " sent");
  await query("update settings set key = 'mail-2020-01-01' where key like 'mail-%'");
  if ((await call("GET", "/api/mail")).data.sent < 1) bad("the allowance did not start again on a new day");
  if ((await query("select 1 from settings where key = 'mail-2020-01-01'")).length) bad("old daily counts are never cleared");
  // the other service works the same way
  delete process.env.BREVO_API_KEY; process.env.RESEND_API_KEY = "pretend-resend-key"; delete process.env.MAIL_DAILY_CAP;
  if (mail.dailyCap() !== 90) bad("the free allowance for the second service is wrong");
  await mail.send({ to: "y@example.test", subject: "s", text: "t", html: "h" });
  const last = post.outbox[post.outbox.length - 1];
  if (last.via !== "resend" || last.from !== "HyMeta <hello@hymeta.test>" || last.to !== "y@example.test") bad("sending through the second service is malformed");
  // a refusal from the service is reported, not hidden
  post.state.refuse = true;
  try { await mail.send({ to: "z@example.test", subject: "s", text: "t", html: "h" }); bad("a refused email was reported as sent"); } catch (e) { if (e.code !== "mail") bad("wrong error for a refused email"); }
  console.log(problems.length ? problems.join("\n") : "MAIL OK");
  process.exit(problems.length ? 1 : 0);
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
