// Checks membership payments end to end against a pretend Stripe: paying, the members-only wall,
// cancelling, and that a made-up "you paid" message is refused.
// Run: node tests/billing.test.js
const { start } = require("../scripts/dev-server");
(async () => {
  const problems = [], bad = (m) => problems.push(m);
  const server = await start({ pretend: true, password: "gate-pass-1", key: "pretend-key", accounts: true, payments: true });
  const S = server.stripe;
  const client = () => { const jar = {}; return async (path, body) => {
    const r = await fetch(server.url + path, { method: body ? "POST" : "GET", headers: { ...(body ? { "Content-Type": "application/json" } : {}), Cookie: Object.entries(jar).map(([k, v]) => k + "=" + v).join("; ") }, body: body ? JSON.stringify(body) : undefined });
    (r.headers.getSetCookie ? r.headers.getSetCookie() : []).forEach((c) => { const [k, v] = c.split(";")[0].split("="); jar[k] = v; });
    return { status: r.status, data: await r.json().catch(() => ({})) }; }; };
  const signUp = async (email, name) => { const c = client(); await c("api/login", { password: "gate-pass-1" }); await c("api/account", { op: "signup", email, password: "correct-horse-9", name, over13: true }); return c; };
  const owner = await signUp("owner@example.test", "The Owner"), ann = await signUp("ann@example.test", "Ann Player"), bob = await signUp("bob@example.test", "Bob Player");
  const tier = async (c) => (await c("api/account")).data.user.tier;

  // before paying: free, and the server itself refuses members-only playpacks
  if ((await c0()) !== true) bad("payments should be reported as switched on");
  async function c0() { return (await ann("api/account")).data.billing; }
  if ((await tier(ann)) !== "free") bad("a new account should be on the free tier");
  if ((await ann("api/pack?id=cozy-farmer")).status !== 200) bad("the free playpack should be open to everyone");
  if ((await ann("api/pack?id=dungeon-gremlin")).status !== 403) bad("a members-only playpack was served to a free account");
  if ((await tier(owner)) !== "member" || (await owner("api/pack?id=dungeon-gremlin")).status !== 200) bad("the owner should count as a member without paying");

  // paying
  if ((await ann("api/billing", { op: "checkout", plan: "weekly" })).status !== 400) bad("an unknown plan was accepted");
  const pay = await ann("api/billing", { op: "checkout", plan: "year" });
  const session = pay.data.url && S.state.sessions[pay.data.url.split("/").pop()];
  if (!session) { bad("checkout did not return a Stripe page: " + JSON.stringify(pay.data)); }
  else {
    const price = S.state.prices.find((p) => p.id === session.price);
    if (!price || price.unit_amount !== 2499 || price.interval !== "year") bad("the yearly plan is not $24.99 a year: " + JSON.stringify(price));
    if (session.mode !== "subscription" || !/\?paid=1$/.test(session.success_url)) bad("checkout is not set up as a renewing membership that returns to HyMeta");
    await ann("api/billing", { op: "checkout", plan: "month" }); await ann("api/billing", { op: "checkout", plan: "year" });
    if (S.state.prices.length !== 2 || S.state.prices.find((p) => p.lookup_key === "hymeta_monthly").unit_amount !== 399) bad("prices should be made once each, $3.99 monthly: " + JSON.stringify(S.state.prices));
    if (S.state.customers.length !== 1) bad("the same member was given more than one Stripe customer");
    if ((await tier(ann)) !== "free") bad("membership was given before any payment was made");

    // a made-up "you paid" message, from anyone, changes nothing
    const fake = await client()("api/billing", { object: "event", id: "evt_madeup", type: "checkout.session.completed", data: { object: { mode: "subscription", subscription: "sub_x", customer: session.customer, client_reference_id: session.client_reference_id } } });
    if (fake.status === 200 || (await tier(ann)) !== "free") bad("a made-up payment message was accepted");

    // Stripe's real message arrives, with no sign-in, and membership switches on
    const done = await client()("api/billing", S.pay(session.id));
    if (done.status !== 200) bad("Stripe's own message was refused: " + done.status);
    if ((await tier(ann)) !== "member") bad("paying did not switch membership on");
    if ((await ann("api/pack?id=dungeon-gremlin")).status !== 200) bad("a paying member is still locked out of members-only playpacks");
    if ((await tier(bob)) !== "free" || (await bob("api/pack?id=dungeon-gremlin")).status !== 403) bad("one member paying unlocked the site for someone else");
    if ((await ann("api/billing", { op: "checkout", plan: "year" })).status !== 400) bad("a member was allowed to pay a second time");

    // the sneakiest made-up message: a free account claims a real member's real subscription as its own
    const carl = await signUp("carl@example.test", "Carl Sneaky"); // the fourth account made, so its id is 4
    const realSub = Object.values(S.state.subs).find((x) => x.customer === session.customer);
    const steal = await client()("api/billing", { object: "event", id: "evt_forged_by_carl", type: "checkout.session.completed", data: { object: { mode: "subscription", subscription: realSub.id, customer: session.customer, client_reference_id: "4" } } });
    if (steal.status === 200 || (await tier(carl)) !== "free" || (await carl("api/pack?id=dungeon-gremlin")).status !== 403) bad("a made-up message let a free account ride on someone else's membership");

    // managing and cancelling
    const portal = await ann("api/billing", { op: "portal" });
    if (!/^https:\/\/billing\.stripe\.test\//.test(portal.data.url || "")) bad("no page to manage or cancel the membership: " + JSON.stringify(portal.data));
    if ((await bob("api/billing", { op: "portal" })).status !== 400) bad("an account with no membership was sent to the manage page");
    await client()("api/billing", S.end(session.customer));
    if ((await tier(ann)) !== "free" || (await ann("api/pack?id=dungeon-gremlin")).status !== 403) bad("ending the membership did not lock the playpacks again");

    // coming back from paying refreshes the member's own status, even if Stripe's message is late
    const again = await bob("api/billing", { op: "checkout", plan: "month" }); S.pay(again.data.url.split("/").pop());
    if ((await tier(bob)) !== "free") bad("membership appeared without a message or a refresh");
    if ((await bob("api/billing", { op: "sync" })).data.tier !== "member") bad("refreshing after paying did not switch membership on");
  }
  if ((await client()("api/billing", { op: "checkout", plan: "year" })).status !== 401) bad("checkout was open to a visitor who is not signed in to the site");
  server.close();
  console.log(problems.length ? problems.join("\n") : "BILLING OK");
  process.exit(problems.length ? 1 : 0);
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
