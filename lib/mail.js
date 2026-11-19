// Sending email: password reset links, the weekly email, and a note to the owner when a
// playpack is waiting for review. Off until a sending key and a From address are set in the
// host's settings (BREVO_API_KEY or RESEND_API_KEY, plus MAIL_FROM).
// A hard daily cap sits in front of every send, so the free allowance can never be passed.
const db = require("./db");

const provider = () => (process.env.BREVO_API_KEY ? "brevo" : process.env.RESEND_API_KEY ? "resend" : "");
const from = () => String(process.env.MAIL_FROM || "").trim();
// The site's own address, for links in emails. Never taken from a visitor's request on the
// real site, so a forged request cannot make a reset link point somewhere else.
function siteUrl(req) {
  if (process.env.SITE_URL) return String(process.env.SITE_URL).replace(/\/+$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return "https://" + process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const host = String((req && req.headers && req.headers.host) || "");
  return /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? "http://" + host : "";
}
function enabled() { return !!provider() && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(from()) && db.enabled(); }
// Free allowances (checked November 2026): Brevo 300 a day, Resend 100 a day. Stay under them.
function dailyCap() { const n = parseInt(process.env.MAIL_DAILY_CAP, 10); return n > 0 ? n : provider() === "brevo" ? 280 : 90; }

// Counts today's send before it happens. Returns false once the day's allowance is used.
// `reserve` holds some of the allowance back, so the weekly email cannot starve password resets.
async function take(reserve) {
  const key = "mail-" + new Date().toISOString().slice(0, 10), limit = dailyCap() - (reserve || 0);
  if (limit < 1) return false;
  await db.query("delete from settings where key like 'mail-2%' and key < $1", [key]);
  const rows = await db.query(
    "insert into settings (key, value) values ($1, '1') on conflict (key) do update set value = (settings.value::int + 1)::text where settings.value::int < $2 returning value", [key, limit]);
  return rows.length > 0;
}

async function send({ to, subject, text, html, headers, reserve }) {
  if (!enabled()) throw Object.assign(new Error("Email is not set up"), { code: "nomail" });
  if (!(await take(reserve))) throw Object.assign(new Error("Today's email allowance is used up"), { code: "cap" });
  const kind = provider();
  const r = kind === "brevo"
    ? await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", headers: { "api-key": process.env.BREVO_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ sender: { name: "HyMeta", email: from() }, to: [{ email: to }], subject, textContent: text, htmlContent: html, ...(headers ? { headers } : {}) }) })
    : await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: "Bearer " + process.env.RESEND_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ from: "HyMeta <" + from() + ">", to: [to], subject, text, html, ...(headers ? { headers } : {}) }) });
  if (!r.ok) { console.error("mail refused", kind, r.status, (await r.text().catch(() => "")).slice(0, 200)); throw Object.assign(new Error("The email service refused the message"), { code: "mail" }); }
}

// One look for every email: plain, readable, and fine with pictures switched off.
function layout({ heading, lines, button, footer }) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const text = [heading, "", ...lines, ...(button ? ["", button[0] + ": " + button[1]] : []), "", ...footer].join("\n");
  const html = `<!doctype html><html lang="en"><body style="margin:0;background:#0e1223;padding:24px 12px;font-family:Verdana,Geneva,sans-serif;color:#121930">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px"><tr><td style="padding:28px 24px">
<p style="margin:0 0 16px;font-size:14px;font-weight:bold;color:#3a4461">HyMeta</p>
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.2;color:#121930">${esc(heading)}</h1>
${lines.map((l) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.5;color:#121930">${esc(l)}</p>`).join("\n")}
${button ? `<p style="margin:22px 0"><a href="${esc(button[1])}" style="display:inline-block;background:#f2b94b;color:#1d1503;font-weight:bold;font-size:17px;text-decoration:none;padding:14px 24px;border-radius:12px">${esc(button[0])}</a></p>
<p style="margin:0 0 14px;font-size:13px;line-height:1.5;color:#3a4461">If the button does not work, copy this into your browser: ${esc(button[1])}</p>` : ""}
<p style="margin:22px 0 0;padding-top:16px;border-top:1px solid #c0ccdb;font-size:13px;line-height:1.5;color:#3a4461">${footer.map(esc).join("<br>")}</p>
</td></tr></table></td></tr></table></body></html>`;
  return { text, html };
}
module.exports = { enabled, send, siteUrl, layout, dailyCap, provider };
