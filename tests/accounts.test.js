// Checks the account rules directly against a throwaway in-memory database.
// Run: node tests/accounts.test.js
process.env.HYMETA_LOCAL_DB = "1";
const a = require("../lib/accounts"), { query } = require("../lib/db");
(async () => {
  const problems = [], bad = (m) => problems.push(m);
  // the connection setting is found under any of the names a host may give it
  const { databaseUrl } = require("../lib/db"), url = "postgresql://u:p@host.example/db";
  for (const name of ["DATABASE_URL", "POSTGRES_URL", "STORAGE_DATABASE_URL", "HYMETA_POSTGRES_URL"]) {
    process.env[name] = url; if (databaseUrl() !== url) bad("connection setting named " + name + " was not found"); delete process.env[name];
  }
  process.env.DATABASE_URL = "not-a-database-address"; if (databaseUrl()) bad("a setting that is not a database address was accepted"); delete process.env.DATABASE_URL;
  if (databaseUrl()) bad("a database address was found when none was set");
  const refuses = async (label, fn, pattern) => { try { await fn(); bad(label + ": was allowed"); } catch (e) { if (e.code !== "invalid" || (pattern && !pattern.test(e.message))) bad(label + ": wrong refusal: " + e.message); } };
  const good = { email: "Kid@Example.test", password: "correct-horse-9", name: "Moss Goblin", over13: true };
  const cookie = await a.signUp(good), req = { headers: { cookie: cookie.split(";")[0] } };
  if (!/HttpOnly/.test(cookie) || !/Secure/.test(cookie) || !/SameSite=Lax/.test(cookie)) bad("the sign-in cookie is missing a safety setting: " + cookie.replace(/=[a-f0-9]+/, "=..."));
  const user = await a.currentUser(req);
  if (!user || user.email !== "kid@example.test" || user.tier !== "free") bad("a new account should be signed in, lower-cased and on the free tier");
  const row = (await query("select pass_hash from users"))[0], sess = (await query("select token_hash from sessions"))[0];
  if (!/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(row.pass_hash) || row.pass_hash.includes(good.password)) bad("the password is not stored as a salted hash");
  if (cookie.includes(sess.token_hash)) bad("the session is stored in a form that could be replayed from the database");
  await refuses("under 13", () => a.signUp({ ...good, email: "b@example.test", over13: false }), /13 and up/);
  await refuses("short password", () => a.signUp({ ...good, email: "c@example.test", password: "short" }), /8 characters/);
  await refuses("bad email", () => a.signUp({ ...good, email: "not-an-email" }), /email/);
  await refuses("same email twice", () => a.signUp({ ...good, email: "KID@example.test" }), /already/);
  await refuses("phone number as a name", () => a.signUp({ ...good, email: "d@example.test", name: "call 5551234567" }), /friendlier/);
  await refuses("rude name", () => a.signUp({ ...good, email: "e@example.test", name: "Sexy Beast" }), /friendlier/);
  await refuses("wrong password", () => a.signIn({ email: good.email, password: "correct-horse-8" }), /do not match/);
  await refuses("unknown email", () => a.signIn({ email: "nobody@example.test", password: good.password }), /do not match/);
  await a.keep(user, { list: "saved", id: "cozy-farmer", on: true }); await a.keep(user, { list: "saved", id: "cozy-farmer", on: true });
  await a.keep(user, { list: "savedMods", id: "cf123", on: true }); await a.keep(user, { list: "upnext", id: "cozy-farmer", on: true });
  await a.keep(user, { list: "savedMods", id: "cf123", on: false });
  const lists = await a.lists(user);
  if (JSON.stringify(lists) !== JSON.stringify({ saved: ["cozy-farmer"], savedMods: [], upnext: ["cozy-farmer"] })) bad("kept lists are wrong: " + JSON.stringify(lists));
  await refuses("unknown list", () => a.keep(user, { list: "tier", id: "member", on: true }));
  await refuses("the old stamp list", () => a.keep(user, { list: "stamps", id: "cozy-farmer", on: true })); // stamps were removed: nothing could show a playpack was really played
  await refuses("odd item id", () => a.keep(user, { list: "saved", id: "<script>", on: true }));
  const other = await a.signUp({ ...good, email: "other@example.test", name: "Other One" }), otherReq = { headers: { cookie: other.split(";")[0] } };
  if ((await a.lists(await a.currentUser(otherReq))).saved.length) bad("one member can see another member's saved items");
  await a.signOut(req);
  if (await a.currentUser(req)) bad("signing out left the session working");
  const again = await a.signIn({ email: good.email, password: good.password }), req2 = { headers: { cookie: again.split(";")[0] } };
  await a.deleteAccount(await a.currentUser(req2));
  if (await a.currentUser(req2)) bad("a deleted account is still signed in");
  if ((await query("select 1 from kept where list = 'upnext'")).length) bad("a deleted account left its saved items behind");
  await refuses("deleted account signing in", () => a.signIn({ email: good.email, password: good.password }), /do not match/);
  if (!(await a.currentUser(otherReq))) bad("deleting one account signed out a different member");
  console.log(problems.length ? problems.join("\n") : "ACCOUNTS OK");
  process.exit(problems.length ? 1 : 0);
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
