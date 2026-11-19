// "Send to my computer": a short code made on the phone opens the same playpack on the computer.
// A code holds nothing but the playpack's id, and stops working after a day.
const crypto = require("crypto");
const { query } = require("./db");
const { problem } = require("./accounts");

const LETTERS = "BCDFGHJKLMNPQRSTVWXZ"; // no vowels, so a code can never spell a word
function newCode() {
  const b = crypto.randomBytes(8);
  let letters = "", digits = "";
  for (let i = 0; i < 4; i++) { letters += LETTERS[b[i] % LETTERS.length]; digits += String(b[i + 4] % 10); }
  return letters + "-" + digits;
}
async function create(pack) {
  if (typeof pack !== "string" || !/^[a-z0-9-]{1,80}$/.test(pack)) throw problem("That playpack cannot be sent.");
  await query("delete from handoffs where expires_at < now()");
  for (let tries = 0; tries < 5; tries++) {
    const code = newCode();
    const rows = await query("insert into handoffs (code, pack, expires_at) values ($1, $2, now() + interval '1 day') on conflict (code) do nothing returning code", [code, pack]);
    if (rows.length) return code;
  }
  throw new Error("Could not make a code");
}
async function open(code) {
  const tidy = String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!/^[A-Z]{4}\d{4}$/.test(tidy)) throw problem("Codes look like BCDF-1234. Check it and try again.");
  const rows = await query("select pack from handoffs where code = $1 and expires_at > now()", [tidy.slice(0, 4) + "-" + tidy.slice(4)]);
  if (!rows.length) throw problem("That code is not right, or it is more than a day old. Make a new one on your phone.");
  return rows[0].pack;
}
module.exports = { create, open, newCode };
