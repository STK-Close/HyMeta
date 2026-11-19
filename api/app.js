// Serves the app to signed-in visitors and the sign-in screen to everyone else.
const { authed, isOpen, cookies, query } = require("../lib/gate");
module.exports = (req, res) => {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Content-Security-Policy", "default-src 'self'; img-src 'self' data: https://media.forgecdn.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  // Private: the app after the password, the front door before it.
  // Open: the front door on a first visit, the app once the visitor has chosen "Come in".
  // Adding ?door=1 shows the front door to anyone, for a preview.
  const wantDoor = query(req).get("door") === "1", open = isOpen();
  const inside = open ? cookies(req).hymeta_in === "1" : authed(req);
  res.end(inside && !wantDoor ? require("../lib/page") : require("../lib/front")(open));
};
