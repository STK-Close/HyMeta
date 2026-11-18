const { passwordOk, cookie, json } = require("../lib/gate");
module.exports = async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "method" });
  if (!process.env.SITE_PASSWORD) return json(res, 503, { error: "notset" });
  const body = req.body && typeof req.body === "object" ? req.body : {};
  if (!passwordOk(body.password)) {
    await new Promise((r) => setTimeout(r, 600)); // slows down guessing
    return json(res, 401, { error: "wrong" });
  }
  res.setHeader("Set-Cookie", cookie());
  json(res, 200, { ok: true });
};
