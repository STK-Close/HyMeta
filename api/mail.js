// Everything reached from an email, plus the daily run that sends the weekly email.
// These work without the site password, because an email link must open for anyone who holds it:
//   GET  ?reset=<secret>   the page for choosing a new password
//   GET  ?unsub=<secret>   the page for stopping the weekly email
//   GET  (nothing)         the daily run. Safe for anyone to call: nobody is ever sent an issue twice.
//   POST { op: "forgot" | "reset" | "unsub" | "test", ... }
const { json, query } = require("../lib/gate");
const db = require("../lib/db"), accounts = require("../lib/accounts"), mail = require("../lib/mail"), news = require("../lib/news");
const { shell } = require("../lib/shell");

function page(res, title, body, script) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Referrer-Policy", "no-referrer"); // the link's secret must not travel on to other sites
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Content-Security-Policy", "default-src 'self'; img-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  res.end(shell(title, body, script));
}
const POST = `function send(body){ return fetch("/api/mail", { method:"POST", headers:{ "Content-Type":"application/json" }, credentials:"same-origin", body:JSON.stringify(body) }).then(function(r){ return r.json().then(function(d){ if (!r.ok) throw new Error(d.message || "Something went wrong. Try again."); return d; }); }); }`;

const resetPage = (res, token) => page(res, "Choose a new password",
  `<h1 id="h">Choose a new password</h1>
  <form id="f" class="doc" novalidate>
    <div class="field"><label for="pw">New password</label><input type="password" id="pw" autocomplete="new-password"><span class="small muted">At least 8 characters.</span></div>
    <label class="check"><input type="checkbox" id="show">Show the password</label>
    <p id="err" class="err" role="alert" hidden></p>
    <button type="submit" class="btn">Save my new password</button>
  </form>
  <div id="done" class="doc" hidden><p class="hexline" id="done-line" tabindex="-1">Done. Hex has forgotten the old one already.</p><p>You were signed out everywhere, to be safe. Sign in with your new password.</p><a class="btn" href="/">Back to HyMeta</a></div>`,
  `${POST}
  var f = document.getElementById("f"), pw = document.getElementById("pw"), err = document.getElementById("err");
  document.getElementById("show").addEventListener("change", function(e){ pw.type = e.target.checked ? "text" : "password"; });
  f.addEventListener("submit", function(e){ e.preventDefault(); var b = f.querySelector("button"); b.disabled = true; err.hidden = true;
    send({ op:"reset", token:${JSON.stringify(token)}, password:pw.value }).then(function(){ f.hidden = true; document.getElementById("h").hidden = true; document.getElementById("done").hidden = false; document.getElementById("done-line").focus(); },
      function(x){ b.disabled = false; err.textContent = x.message; err.hidden = false; pw.focus(); }); });`);

const unsubPage = (res, token) => page(res, "Stop the weekly email",
  `<h1 id="h">Stop the weekly email?</h1>
  <div id="ask" class="doc"><p>You will get no more weekly emails from HyMeta. Your account stays exactly as it is.</p><button type="button" class="btn" id="go">Stop the emails</button><p id="err" class="err" role="alert" hidden></p></div>
  <div id="done" class="doc" hidden><p class="hexline" id="done-line" tabindex="-1">Done. No more emails. Hex is only a little hurt.</p><p>Changed your mind? Switch it back on under You, Account.</p><a class="btn" href="/">Back to HyMeta</a></div>`,
  `${POST}
  document.getElementById("go").addEventListener("click", function(e){ var b = e.target, err = document.getElementById("err"); b.disabled = true; err.hidden = true;
    send({ op:"unsub", token:${JSON.stringify(token)} }).then(function(){ document.getElementById("ask").hidden = true; document.getElementById("h").hidden = true; document.getElementById("done").hidden = false; document.getElementById("done-line").focus(); },
      function(x){ b.disabled = false; err.textContent = x.message; err.hidden = false; }); });`);

module.exports = async (req, res) => {
  const q = query(req), site = mail.siteUrl(req);
  const secret = (name) => { const v = String(q.get(name) || ""); return /^[a-f0-9]{48,64}$/.test(v) ? v : ""; };
  try {
    if (req.method === "GET") {
      if (q.has("reset")) return resetPage(res, secret("reset"));
      if (q.has("unsub")) return unsubPage(res, secret("unsub"));
      const done = await news.sendBatch(site);
      return json(res, 200, { ok: true, on: done.on, sent: done.sent, left: done.left });
    }
    if (req.method !== "POST") return json(res, 405, { error: "method" });
    if (!db.enabled()) return json(res, 400, { error: "off", message: "Accounts are not switched on." });
    // one-click unsubscribe, sent by mail apps themselves (RFC 8058): a plain form post to the link
    if (q.has("unsub")) { await accounts.unsubscribe(secret("unsub")); return json(res, 200, { ok: true }); }
    if (!/application\/json/i.test(String(req.headers["content-type"] || ""))) return json(res, 405, { error: "method" });
    const body = req.body && typeof req.body === "object" ? req.body : {};
    if (body.op === "forgot") {
      // the same answer, after the same wait, whether or not the email has an account
      const started = Date.now();
      if (mail.enabled() && site) {
        const made = await accounts.requestReset(body.email);
        if (made) {
          const link = site + "/api/mail?reset=" + made.token;
          const { text, html } = mail.layout({ heading: "Reset your HyMeta password", lines: ["Hex here. Somebody asked to reset the password on this HyMeta account.", "If that was you, use the button below within one hour. It works once.", "If it was not you, do nothing. Your password stays exactly as it is."],
            button: ["Choose a new password", link], footer: ["I lose things too. Mostly spiders.", "Lumina Art House, LLC"] });
          await mail.send({ to: made.email, subject: "Reset your HyMeta password", text, html }).catch((e) => console.error("reset email not sent", e && e.code));
        }
      }
      await new Promise((r) => setTimeout(r, Math.max(0, 1200 - (Date.now() - started))));
      return json(res, 200, { ok: true });
    }
    if (body.op === "reset") { await accounts.finishReset(body); return json(res, 200, { ok: true }); }
    if (body.op === "unsub") {
      if (!(await accounts.unsubscribe(body.token))) return json(res, 400, { error: "invalid", message: "That link is not right. Switch the email off under You, Account instead." });
      return json(res, 200, { ok: true });
    }
    if (body.op === "test") {
      const user = await accounts.currentUser(req);
      if (!user || !(await accounts.isOwner(user))) return json(res, 403, { error: "notowner", message: "Only the owner can send a test." });
      if (!news.enabled() || !site) return json(res, 400, { error: "off", message: "The weekly email is not set up yet." });
      await accounts.setNews(user, user.news === true); // makes sure the owner has a link to stop the emails, without changing their choice
      const me = (await db.query("select email, news_token from users where id = $1", [user.id]))[0];
      const m = news.compose(me, site);
      await mail.send({ ...m, subject: "[Test] " + m.subject });
      return json(res, 200, { ok: true });
    }
    return json(res, 400, { error: "unknown" });
  } catch (e) {
    if (e.code === "invalid") return json(res, 400, { error: "invalid", message: e.message });
    if (e.code === "cap") return json(res, 429, { error: "cap", message: "Today's email allowance is used up. Try again tomorrow." });
    console.error("mail error", e && e.message);
    return json(res, 500, { error: "server", message: "Something went wrong on our side. Try again in a moment." });
  }
};
