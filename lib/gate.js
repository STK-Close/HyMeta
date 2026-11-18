// The password gate. The whole site and every data route sit behind one shared password
// (SITE_PASSWORD in the host's settings). With no password set, everything stays locked.
const crypto = require("crypto");
const NAME = "hymeta_gate";

function token() {
  const pw = process.env.SITE_PASSWORD || "";
  return pw ? crypto.createHmac("sha256", pw).update("hymeta-gate-v1").digest("hex") : "";
}
function cookies(req) {
  const out = {};
  String((req.headers && req.headers.cookie) || "").split(";").forEach((part) => {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  });
  return out;
}
const digest = (s) => crypto.createHash("sha256").update(String(s)).digest();
const same = (a, b) => crypto.timingSafeEqual(digest(a), digest(b));

function authed(req) {
  const t = token();
  return !!t && same(cookies(req)[NAME] || "", t);
}
function passwordOk(pw) {
  const real = process.env.SITE_PASSWORD || "";
  return !!real && typeof pw === "string" && same(pw, real);
}
function cookie() {
  return `${NAME}=${token()}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`;
}
function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.end(JSON.stringify(body));
}
// Use at the top of every data route: returns false (and answers 401) when the visitor has not signed in.
function guard(req, res) {
  if (authed(req)) return true;
  json(res, 401, { error: "locked" });
  return false;
}
function query(req) {
  return new URL(req.url, "http://localhost").searchParams;
}
module.exports = { authed, passwordOk, cookie, json, guard, query };
