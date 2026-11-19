// HyMeta's own database: accounts, sign-in sessions, saved items and stamps. Nothing from
// CurseForge is kept here, only the ids of what a member saved.
// In production it is a Neon Postgres database (DATABASE_URL in the host's settings).
// Tests use a throwaway in-memory Postgres instead (HYMETA_LOCAL_DB=1).
let ready = null;

const SCHEMA = [
  `create table if not exists users (
     id bigserial primary key, email text not null unique, name text not null, pass_hash text not null,
     tier text not null default 'free', created_at timestamptz not null default now())`,
  `create table if not exists sessions (
     token_hash text primary key, user_id bigint not null references users(id) on delete cascade,
     expires_at timestamptz not null)`,
  `create table if not exists kept (
     user_id bigint not null references users(id) on delete cascade, list text not null, item text not null,
     created_at timestamptz not null default now(), primary key (user_id, list, item))`,
];

// The host may name the connection setting DATABASE_URL, POSTGRES_URL, or either with a prefix
// (for example STORAGE_DATABASE_URL), depending on how the database was connected.
function databaseUrl() {
  const env = process.env, looksRight = (v) => typeof v === "string" && /^postgres(ql)?:\/\//.test(v);
  if (looksRight(env.DATABASE_URL)) return env.DATABASE_URL;
  if (looksRight(env.POSTGRES_URL)) return env.POSTGRES_URL;
  const key = Object.keys(env).sort().find((k) => /(^|_)(DATABASE|POSTGRES)_URL$/.test(k) && looksRight(env[k]));
  return key ? env[key] : "";
}
function enabled() { return !!databaseUrl() || process.env.HYMETA_LOCAL_DB === "1"; }

async function connect() {
  let run;
  if (databaseUrl()) {
    const sql = require("@neondatabase/serverless").neon(databaseUrl());
    run = (text, params) => sql.query(text, params || []);
  } else {
    const { PGlite } = require("@electric-sql/pglite");
    const db = new PGlite();
    run = async (text, params) => (await db.query(text, params || [])).rows;
  }
  for (const statement of SCHEMA) await run(statement);
  return run;
}

// query("select ... where id = $1", [id]) returns an array of rows.
async function query(text, params) {
  if (!enabled()) throw Object.assign(new Error("No database is set"), { code: "nodb" });
  if (!ready) ready = connect().catch((e) => { ready = null; throw e; });
  return (await ready)(text, params);
}
module.exports = { enabled, query, databaseUrl };
