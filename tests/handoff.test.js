// Checks the "send to my computer" codes against a throwaway in-memory database.
process.env.HYMETA_LOCAL_DB = "1";
const h = require("../lib/handoff"), { query } = require("../lib/db");
(async () => {
  const problems = [], bad = (m) => problems.push(m);
  const refuses = async (label, fn, pattern) => { try { await fn(); bad(label + ": was allowed"); } catch (e) { if (e.code !== "invalid" || (pattern && !pattern.test(e.message))) bad(label + ": wrong refusal: " + e.message); } };
  const code = await h.create("cozy-farmer");
  if (!/^[BCDFGHJKLMNPQRSTVWXZ]{4}-\d{4}$/.test(code)) bad("code has the wrong shape: " + code);
  if ((await h.open(code)) !== "cozy-farmer") bad("the code did not open its playpack");
  if ((await h.open(code.toLowerCase().replace("-", " "))) !== "cozy-farmer") bad("a code typed in lower case with a space was not accepted");
  const seen = new Set(); for (let i = 0; i < 200; i++) seen.add(h.newCode());
  if (seen.size < 195) bad("codes repeat too often to be safe");
  if ([...seen].some((c) => /[AEIOUY]/.test(c))) bad("a code contains a vowel, so codes could spell words");
  await refuses("a made-up code", () => h.open("ZZZZ-0000"), /not right/);
  await refuses("a badly shaped code", () => h.open("hello"), /look like/);
  await refuses("an odd playpack id", () => h.create("<script>"));
  await query("update handoffs set expires_at = now() - interval '1 minute' where code = $1", [code]);
  await refuses("a code more than a day old", () => h.open(code), /day old/);
  await h.create("the-wanderer");
  if ((await query("select 1 from handoffs where code = $1", [code])).length) bad("old codes are not cleared out");
  console.log(problems.length ? problems.join("\n") : "HANDOFF OK");
  process.exit(problems.length ? 1 : 0);
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
