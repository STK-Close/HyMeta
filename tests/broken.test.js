// Checks "It did not work": three different players reporting a mod benches it, the playpack picks
// the next best, reports can be taken back, fade after 30 days, and only the owner can clear them.
// Run: node tests/broken.test.js
const { start } = require("../scripts/dev-server");
const { query } = require("../lib/db");
(async () => {
  const problems = [], bad = (m) => problems.push(m);
  const server = await start({ pretend: true, password: "gate-pass-1", key: "pretend-key", accounts: true, mail: true });
  process.env.SITE_URL = "https://hymeta.test";
  const client = () => { const jar = {}; return async (path, body) => {
    const r = await fetch(server.url + path, { method: body ? "POST" : "GET", headers: { ...(body ? { "Content-Type": "application/json" } : {}), Cookie: Object.entries(jar).map(([k, v]) => k + "=" + v).join("; ") }, body: body ? JSON.stringify(body) : undefined });
    (r.headers.getSetCookie ? r.headers.getSetCookie() : []).forEach((c) => { const [k, v] = c.split(";")[0].split("="); jar[k] = v; });
    return { status: r.status, data: await r.json().catch(() => ({})) }; }; };
  const signUp = async (n) => { const c = client(); await c("api/login", { password: "gate-pass-1" }); await c("api/account", { op: "signup", email: n + "@example.test", password: "correct-horse-9", name: "Player " + n, over13: true }); return c; };
  const owner = await signUp("owner"), [a, b, c, d] = [await signUp("ann"), await signUp("bob"), await signUp("cat"), await signUp("dan")];
  const guest = client(); await guest("api/login", { password: "gate-pass-1" });
  const picks = async (who = a) => { const p = (await who("api/pack?id=cozy-farmer")).data; return p.core.concat(p.spice, p.extras); };
  const has = async (id) => (await picks()).some((m) => m.id === id);
  const tell = (who, mod, extra) => who("api/community", { op: "broken", mod, pack: "cozy-farmer", why: 1, on: true, ...(extra || {}) });
  const notes = () => server.outbox.filter((m) => /benched/.test(m.subject));

  const first = await picks(), X = first[0].id, size = first.length;
  if ((await tell(guest, X)).status !== 401) bad("a report was accepted without an account");
  for (const [label, body] of [["a made-up mod id", { mod: "cf12; drop table" }], ["a mod id of the wrong shape", { mod: "12345" }], ["a playpack that does not exist", { pack: "no-such-pack" }]])
    if ((await tell(a, X, body)).status !== 400) bad("a report with " + label + " was accepted");
  const r1 = await tell(a, X);
  if (r1.status !== 200 || r1.data.broken.join() !== X) bad("a report was not recorded for the player who made it");
  await tell(a, X); await tell(a, X, { why: 2 });
  if ((await query("select count(*)::int as n from broken"))[0].n !== 1) bad("one player reporting three times counted as more than one report");
  if (!(await has(X))) bad("one report was enough to bench a mod");
  await tell(b, X);
  if (!(await has(X)) || notes().length) bad("two reports were enough to bench a mod");
  await tell(c, X);
  const after = await picks();
  if (after.some((m) => m.id === X)) bad("three players reported a mod and it is still in the playpack");
  if (after.length !== size) bad("the benched mod was not replaced by the next best one: " + size + " mods became " + after.length);
  if (new Set(after.map((m) => m.id)).size !== after.length) bad("the replacement doubled up a mod");
  if (notes().length !== 1 || notes()[0].to !== "owner@example.test" || notes()[0].text.includes(first[0].name) || !notes()[0].text.includes("https://hymeta.test/#you")) bad("the owner should get one note when a mod is benched, without the mod's details in it");
  await tell(d, X);
  if (notes().length !== 1) bad("the owner was told twice about the same benched mod");
  // the owner sees it, and only the owner
  const q = (await owner("api/community")).data.queue.broken.find((x) => x.mod === X);
  if (!q || q.count !== 4 || !q.benched || q.needed !== 3 || q.packs !== "The cozy farmer" || !/crashed/.test(q.reasons)) bad("the owner's list is wrong: " + JSON.stringify(q));
  if ((await a("api/community")).data.queue) bad("a member can see the owner's list");
  if ((await a("api/community", { op: "brokenclear", mod: X })).status !== 403 || (await has(X))) bad("a member could clear reports");
  if (/ann|bob|example\.test/i.test(JSON.stringify((await owner("api/community")).data.queue.broken))) bad("the owner's list names who reported");
  // taking a report back
  await a("api/community", { op: "broken", mod: X, pack: "cozy-farmer", on: false }); await b("api/community", { op: "broken", mod: X, pack: "cozy-farmer", on: false });
  if ((await a("api/community")).data.broken.length) bad("a report that was taken back is still listed for the player");
  if (!(await has(X))) bad("the mod stayed benched after two of its four reports were taken back");
  // reports fade: after 30 days the mod gets another chance
  await tell(a, X);
  if (await has(X)) bad("a third report did not bench the mod again");
  await query("update broken set created_at = now() - interval '31 days'"); await tell(d, first[1].id); // any new report makes the list fresh
  if (!(await has(X))) bad("reports older than 30 days still keep a mod out");
  if ((await owner("api/community")).data.queue.broken.some((x) => x.mod === X)) bad("faded reports still show in the owner's list");
  // the owner clears them
  await query("delete from broken"); for (const who of [a, b, c]) await tell(who, X);
  if (await has(X)) bad("the mod was not benched before the owner cleared it");
  if ((await owner("api/community", { op: "brokenclear", mod: X })).status !== 200 || !(await has(X))) bad("the owner clearing the reports did not bring the mod back");
  // a deleted account takes its reports with it
  for (const who of [a, b, c]) await tell(who, X);
  await c("api/account", { op: "delete" }); await tell(d, first[2].id);
  if (!(await has(X))) bad("a deleted account's report still counts");
  // nothing but the mod's id is kept
  const cols = (await query("select * from broken limit 1"))[0];
  if (Object.keys(cols).sort().join() !== "created_at,mod,pack,user_id,why" || JSON.stringify(cols).includes(first[0].name)) bad("more than the mod's id is kept: " + Object.keys(cols).join());
  server.close();
  console.log(problems.length ? problems.join("\n") : "BROKEN OK");
  process.exit(problems.length ? 1 : 0);
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
