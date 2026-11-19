// Membership payments through Stripe. HyMeta never sees card details: members pay on Stripe's own
// checkout page (card, Apple Pay, Google Pay) and manage or cancel on Stripe's own portal page.
// The only setting needed is STRIPE_SECRET_KEY. The two prices, the webhook and the portal
// settings are created in Stripe the first time they are needed.
const { query } = require("./db");
const { problem } = require("./accounts");

const API = "https://api.stripe.com/v1";
const PLANS = {
  month: { key: "hymeta_monthly", amount: 399, interval: "month", name: "HyMeta membership, monthly" },
  year: { key: "hymeta_yearly", amount: 2499, interval: "year", name: "HyMeta membership, yearly" },
};
const EVENTS = ["checkout.session.completed", "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"];

function enabled() { return !!process.env.STRIPE_SECRET_KEY; }

function form(obj, prefix, out = new URLSearchParams()) {
  Object.entries(obj).forEach(([k, v]) => {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v && typeof v === "object") form(v, key, out); else if (v !== undefined && v !== null) out.append(key, String(v));
  });
  return out;
}
async function stripe(method, path, body) {
  const r = await fetch(API + path, { method, headers: { Authorization: "Bearer " + process.env.STRIPE_SECRET_KEY, "Content-Type": "application/x-www-form-urlencoded" }, body: body ? form(body).toString() : undefined });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error((data.error && data.error.message) || "Stripe answered " + r.status), { code: "stripe", status: r.status });
  return data;
}

async function priceFor(plan) {
  const p = PLANS[plan];
  const found = await stripe("GET", "/prices?active=true&lookup_keys[]=" + p.key);
  if (found.data && found.data[0]) return found.data[0].id;
  return (await stripe("POST", "/prices", { currency: "usd", unit_amount: p.amount, lookup_key: p.key, recurring: { interval: p.interval }, product_data: { name: p.name, statement_descriptor: "HYMETA" } })).id;
}
async function ensureWebhook(origin) {
  if (!/^https:\/\//.test(origin)) return; // Stripe only calls secure addresses
  const url = origin + "/api/billing";
  const have = await stripe("GET", "/webhook_endpoints?limit=100");
  if ((have.data || []).some((w) => w.url === url && w.status === "enabled")) return;
  await stripe("POST", "/webhook_endpoints", { url, enabled_events: EVENTS, description: "HyMeta membership updates" });
}
async function customerFor(user) {
  if (user.stripe_customer) return user.stripe_customer;
  const c = await stripe("POST", "/customers", { email: user.email, metadata: { hymeta_user: user.id } });
  await query("update users set stripe_customer = $1 where id = $2", [c.id, user.id]);
  return c.id;
}

// Starts a payment. Returns the address of Stripe's checkout page.
async function checkout(user, plan, origin) {
  if (!PLANS[plan]) throw problem("Choose the monthly or the yearly plan.");
  if (user.tier === "member") throw problem("You are already a member.");
  await ensureWebhook(origin);
  const session = await stripe("POST", "/checkout/sessions", {
    mode: "subscription", customer: await customerFor(user), client_reference_id: user.id,
    line_items: { 0: { price: await priceFor(plan), quantity: 1 } },
    success_url: origin + "/?paid=1", cancel_url: origin + "/", allow_promotion_codes: true,
  });
  return session.url;
}
// The address of Stripe's page where a member updates their card or cancels.
async function portal(user, origin) {
  if (!user.stripe_customer) throw problem("There is no membership on this account yet.");
  const open = () => stripe("POST", "/billing_portal/sessions", { customer: user.stripe_customer, return_url: origin + "/#you" });
  try { return (await open()).url; } catch (e) {
    if (e.code !== "stripe" || !/configuration/i.test(e.message)) throw e;
    // first use: Stripe has no portal settings saved yet, so save sensible ones
    await stripe("POST", "/billing_portal/configurations", { business_profile: { headline: "Manage your HyMeta membership" },
      features: { subscription_cancel: { enabled: true, mode: "at_period_end" }, payment_method_update: { enabled: true }, invoice_history: { enabled: true } } });
    return (await open()).url;
  }
}

// A membership is on while Stripe says the subscription is active.
async function apply(sub) {
  const on = sub.status === "active" || sub.status === "trialing";
  await query("update users set tier = $1, sub_id = $2 where stripe_customer = $3", [on ? "member" : "free", on ? sub.id : null, sub.customer]);
}
// Stripe tells us something changed. We never trust what the message says: we ask Stripe for the
// event by its id with our own key, so a made-up message cannot grant anyone a membership.
async function handleEvent(body) {
  if (!body || typeof body.id !== "string" || !/^evt_[A-Za-z0-9_]+$/.test(body.id)) throw problem("Not a Stripe event.");
  let ev; try { ev = await stripe("GET", "/events/" + body.id); } catch (e) { throw problem("Unknown event."); }
  const obj = ev.data && ev.data.object;
  if (!obj) return;
  if (ev.type === "checkout.session.completed" && obj.mode === "subscription" && obj.subscription) {
    if (obj.client_reference_id && obj.customer) await query("update users set stripe_customer = $1 where id = $2 and (stripe_customer is null or stripe_customer = $1)", [obj.customer, String(obj.client_reference_id).replace(/\D/g, "") || "0"]);
    await apply(await stripe("GET", "/subscriptions/" + obj.subscription));
  } else if (/^customer\.subscription\./.test(ev.type) && obj.id) {
    await apply(await stripe("GET", "/subscriptions/" + obj.id));
  }
}
// Asked for by the member's own browser when they come back from paying, in case Stripe's message is slow.
async function sync(user) {
  if (!user.stripe_customer) return;
  const subs = await stripe("GET", "/subscriptions?status=all&limit=10&customer=" + encodeURIComponent(user.stripe_customer));
  const live = (subs.data || []).find((s) => s.status === "active" || s.status === "trialing");
  if (live) await apply(live); else await query("update users set tier = 'free', sub_id = null where id = $1", [user.id]);
}
module.exports = { enabled, checkout, portal, handleEvent, sync, PLANS };
