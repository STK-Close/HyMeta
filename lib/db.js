// HyMeta's own database: accounts, sign-in sessions and saved items. Nothing from
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
  `create table if not exists settings (key text primary key, value text not null)`,
  // a playpack a member built: only its name, one line and the ids of the mods chosen
  `create table if not exists shared_packs (
     id text primary key, user_id bigint not null references users(id) on delete cascade, name text not null, blurb text not null,
     mods jsonb not null, status text not null default 'pending', reason text not null default '',
     created_at timestamptz not null default now(), reviewed_at timestamptz)`,
  `create table if not exists reports (
     pack_id text not null references shared_packs(id) on delete cascade, user_id bigint not null references users(id) on delete cascade,
     why text not null, created_at timestamptz not null default now(), primary key (pack_id, user_id))`,
  `alter table users add column if not exists stripe_customer text`,
  `alter table users add column if not exists sub_id text`,
  `create table if not exists handoffs (code text primary key, pack text not null, expires_at timestamptz not null)`,
  // a password reset link: only a hash of it is kept, it works once, and it lasts an hour
  `create table if not exists resets (
     token_hash text primary key, user_id bigint not null references users(id) on delete cascade,
     expires_at timestamptz not null, used boolean not null default false, created_at timestamptz not null default now())`,
  // the weekly email: off unless the member asks for it
  `alter table users add column if not exists news boolean not null default false`,
  `alter table users add column if not exists news_token text`,
  `alter table users add column if not exists news_issue text`,
  // "it did not work": one report per member per mod. Only the mod's id is kept.
  `create table if not exists broken (mod text not null, user_id bigint not null references users(id) on delete cascade, pack text not null, why text not null,
     created_at timestamptz not null default now(), primary key (mod, user_id))`,
  // the weekly vote: one vote per member per vote, changeable until it closes
  `create table if not exists votes (poll text not null, user_id bigint not null references users(id) on delete cascade, idea text not null, primary key (poll, user_id))`,
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
