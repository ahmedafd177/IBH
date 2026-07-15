/* ═══════════════════════════════════════
   DATABASE — Postgres (Supabase) via `pg`
   Exposes a better-sqlite3-shaped API
   (db.prepare(sql).get/all/run) so route
   files barely change, but every call is
   async — callers must `await`.
   Creates tables on first run and seeds
   with SeedData if tables are empty.
   ═══════════════════════════════════════ */
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set — point it at your Supabase Postgres connection string.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

/* ── prepare() shim — mirrors better-sqlite3's .get/.all/.run, async ──
   Supports both `?` positional placeholders and `@name` named
   placeholders (better-sqlite3 named-param style used by products.js),
   converting either into Postgres `$1, $2, …` at call time. ── */
function convertSql(sql) {
  const namedParams = [];
  const namedSql = sql.replace(/@(\w+)/g, (_, name) => {
    namedParams.push(name);
    return `$${namedParams.length}`;
  });
  if (namedParams.length) return { pgSql: namedSql, namedParams };

  let i = 0;
  return { pgSql: sql.replace(/\?/g, () => `$${++i}`), namedParams: [] };
}

function bindParams(namedParams, args) {
  if (!namedParams.length) return args;
  const obj = args[0] || {};
  return namedParams.map(name => obj[name]);
}

/* rawPrepare has no readiness guard — used internally during schema
   init/seeding, where waiting on `ready` would deadlock (the init
   IIFE itself hasn't resolved yet). */
function rawPrepare(sql) {
  const { pgSql, namedParams } = convertSql(sql);
  return {
    async get(...args) {
      const { rows } = await pool.query(pgSql, bindParams(namedParams, args));
      return rows[0];
    },
    async all(...args) {
      const { rows } = await pool.query(pgSql, bindParams(namedParams, args));
      return rows;
    },
    async run(...args) {
      const result = await pool.query(pgSql, bindParams(namedParams, args));
      return { changes: result.rowCount, rows: result.rows };
    },
  };
}

/* Exported prepare() — waits for schema/seed init before every call.
   Protects the (mostly serverless cold-start) race where a request
   handler queries the DB before initSchema()/seed*() have finished. */
function prepare(sql) {
  const inner = rawPrepare(sql);
  return {
    get: async (...args) => { await ready; return inner.get(...args); },
    all: async (...args) => { await ready; return inner.all(...args); },
    run: async (...args) => { await ready; return inner.run(...args); },
  };
}

async function exec(sql) {
  await pool.query(sql);
}

/* ── Transaction helper — replaces better-sqlite3's db.transaction(fn).
   fn receives a `prepare`-shaped function bound to the checked-out
   client, so statements inside run atomically. ── */
async function transaction(fn) {
  await ready;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const scopedPrepare = (sql) => {
      const { pgSql, namedParams } = convertSql(sql);
      return {
        get: async (...args) => (await client.query(pgSql, bindParams(namedParams, args))).rows[0],
        all: async (...args) => (await client.query(pgSql, bindParams(namedParams, args))).rows,
        run: async (...args) => {
          const r = await client.query(pgSql, bindParams(namedParams, args));
          return { changes: r.rowCount, rows: r.rows };
        },
      };
    };
    const result = await fn(scopedPrepare);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/* ── Schema ──
   Camel-cased columns from the old SQLite schema (products table)
   are quoted here to preserve exact case — Postgres otherwise folds
   unquoted identifiers to lowercase, which would silently break
   `SELECT *` results the frontend depends on (p.oldPrice, p.imageMain…). */
async function initSchema() {
  await exec(`
    CREATE TABLE IF NOT EXISTS products (
      id          SERIAL PRIMARY KEY,
      name        TEXT    NOT NULL,
      brand       TEXT    NOT NULL,
      cat         TEXT    NOT NULL,
      subcat      TEXT    NOT NULL,
      gender      TEXT    NOT NULL DEFAULT 'All',
      price       REAL    NOT NULL,
      "oldPrice"  REAL,
      emoji       TEXT,
      "desc"      TEXT,
      sizes       TEXT    NOT NULL DEFAULT '[]',
      rating      REAL    NOT NULL DEFAULT 4.5,
      "isNew"     INTEGER NOT NULL DEFAULT 0,
      "isTrend"   INTEGER NOT NULL DEFAULT 0,
      "isFeat"    INTEGER NOT NULL DEFAULT 0,
      "isVisible" INTEGER NOT NULL DEFAULT 1,
      stock       INTEGER NOT NULL DEFAULT 0,
      "imageMain" TEXT,
      "imageAlt1" TEXT,
      "imageAlt2" TEXT,
      "isOnSale"  INTEGER NOT NULL DEFAULT 0,
      "isHot"     INTEGER NOT NULL DEFAULT 0,
      review_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS brands (
      id    SERIAL PRIMARY KEY,
      name  TEXT   NOT NULL UNIQUE,
      image TEXT
    );

    CREATE TABLE IF NOT EXISTS categories (
      id   SERIAL PRIMARY KEY,
      name TEXT   NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS orders (
      id              TEXT        PRIMARY KEY,
      status          TEXT        NOT NULL DEFAULT 'confirmed',
      date            TEXT        NOT NULL,
      time            TEXT        NOT NULL,
      total           REAL        NOT NULL DEFAULT 0,
      items           TEXT        NOT NULL DEFAULT '[]',
      customer        TEXT        NOT NULL DEFAULT '{}',
      branch          TEXT,
      payment         TEXT        NOT NULL DEFAULT 'mpesa',
      payment_status  TEXT        NOT NULL DEFAULT 'pending',
      mpesa_ref       TEXT,
      coupon_code     TEXT,
      coupon_discount REAL        NOT NULL DEFAULT 0,
      assigned_to     INTEGER,
      assigned_name   TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS main_categories (
      id    INTEGER PRIMARY KEY,
      slug  TEXT    NOT NULL UNIQUE,
      name  TEXT    NOT NULL,
      image TEXT
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id            SERIAL      PRIMARY KEY,
      name          TEXT        NOT NULL,
      phone         TEXT        NOT NULL UNIQUE,
      email         TEXT        NOT NULL DEFAULT '',
      role          TEXT        NOT NULL DEFAULT 'customer',
      branch        TEXT,
      password_hash TEXT        NOT NULL DEFAULT '',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS delivery_areas (
      id    SERIAL PRIMARY KEY,
      name  TEXT   NOT NULL UNIQUE,
      price REAL   NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id         TEXT        PRIMARY KEY,
      account_id INTEGER     NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS coupons (
      id             SERIAL PRIMARY KEY,
      code           TEXT   NOT NULL UNIQUE,
      type           TEXT   NOT NULL DEFAULT 'percent',
      value          REAL   NOT NULL,
      min_order      REAL   NOT NULL DEFAULT 0,
      max_uses       INTEGER NOT NULL DEFAULT 0,
      uses           INTEGER NOT NULL DEFAULT 0,
      expires_at     TEXT,
      is_active      INTEGER NOT NULL DEFAULT 1,
      show_in_notif  INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS branches (
      id       SERIAL PRIMARY KEY,
      name     TEXT   NOT NULL UNIQUE,
      location TEXT   NOT NULL DEFAULT '',
      phone    TEXT   NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS order_notes (
      id          SERIAL      PRIMARY KEY,
      order_id    TEXT        NOT NULL,
      author_id   INTEGER,
      author_name TEXT        NOT NULL DEFAULT 'Admin',
      note        TEXT        NOT NULL,
      is_internal INTEGER     NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id         SERIAL      PRIMARY KEY,
      product_id INTEGER     NOT NULL,
      name       TEXT        NOT NULL,
      rating     INTEGER     NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment    TEXT        NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  /* Defensive column additions for schemas created before a field existed. */
  const migrations = [
    'ALTER TABLE accounts ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT \'customer\'',
    'ALTER TABLE accounts ADD COLUMN IF NOT EXISTS branch TEXT',
    'ALTER TABLE products ADD COLUMN IF NOT EXISTS "isOnSale" INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE products ADD COLUMN IF NOT EXISTS "isHot" INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE products ADD COLUMN IF NOT EXISTS review_count INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS branch TEXT',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment TEXT NOT NULL DEFAULT \'mpesa\'',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT \'pending\'',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS mpesa_ref TEXT',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code TEXT',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_discount REAL NOT NULL DEFAULT 0',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_to INTEGER',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_name TEXT',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()',
    'ALTER TABLE coupons ADD COLUMN IF NOT EXISTS show_in_notif INTEGER NOT NULL DEFAULT 0',
  ];
  for (const sql of migrations) {
    try { await exec(sql); } catch (e) { console.error('Migration failed:', sql, e.message); }
  }
}

/* ── Seed helpers (use rawPrepare — prepare() would deadlock waiting on `ready`) ── */
async function seedBrands() {
  const { n } = await rawPrepare('SELECT COUNT(*) AS n FROM brands').get();
  if (Number(n) > 0) return;
  const seedBrands = [
    'Chanel','Dior','Tom Ford','Versace','Gucci','YSL','Armani',
    'Ajmal','Rasasi','OGX','Shea Moisture','Cantu','Pantene',
    'Nivea','Dove','The Body Shop','Vaseline',
  ];
  const ins = rawPrepare('INSERT INTO brands (name, image) VALUES (?, NULL)');
  for (const name of seedBrands) await ins.run(name);
}

async function seedCategories() {
  const { n } = await rawPrepare('SELECT COUNT(*) AS n FROM categories').get();
  if (Number(n) > 0) return;
  const cats = [
    'Eau de Parfum','Eau de Toilette','Cologne','Body Spray',
    'Oud & Oriental','Floral','Fresh & Citrus',
    'Shampoo','Conditioner','Hair Oil','Hair Mask','Styling',
    'Natural Hair','Relaxed Hair',
    'Body Lotion','Body Wash','Body Scrub','Deodorant',
    'Sunscreen','Moisturizing','Brightening','Anti-aging',
  ];
  const ins = rawPrepare('INSERT INTO categories (name) VALUES (?)');
  for (const name of cats) await ins.run(name);
}

async function seedMainCategories() {
  const { n } = await rawPrepare('SELECT COUNT(*) AS n FROM main_categories').get();
  if (Number(n) > 0) return;
  const ins = rawPrepare('INSERT INTO main_categories (id, slug, name, image) VALUES (?, ?, ?, NULL) ON CONFLICT (id) DO NOTHING');
  await ins.run(1, 'perfume', 'Perfume');
  await ins.run(2, 'hair',    'Hair Care');
  await ins.run(3, 'body',    'Body Care');
}

/* ── Seed admin user (bcrypt — matches the login route's bcrypt.compare) ── */
async function seedAdmin() {
  const bcryptjs = require('bcryptjs');
  const email    = 'ahmedafd180@gmail.com';
  const existing = await rawPrepare('SELECT id, password_hash FROM accounts WHERE LOWER(email) = ?').get(email);
  const needsHash = !existing || !(existing.password_hash || '').startsWith('$2');
  const hash = needsHash ? bcryptjs.hashSync('Admin@123', 12) : existing.password_hash;
  if (existing) {
    await rawPrepare("UPDATE accounts SET role = 'admin', password_hash = ? WHERE LOWER(email) = ?").run(hash, email);
  } else {
    await rawPrepare('INSERT INTO accounts (name, phone, email, role, password_hash) VALUES (?, ?, ?, ?, ?)')
      .run('Ahmed', email, email, 'admin', hash);
  }
}

const ready = (async () => {
  await initSchema();
  await rawPrepare("DELETE FROM sessions WHERE expires_at <= NOW()").run();
  await seedBrands();
  await seedCategories();
  await seedMainCategories();
  await seedAdmin();
})().catch(e => {
  console.error('Database initialization failed:', e);
  /* Do NOT process.exit() or rethrow here — this runs inside a shared
     serverless Lambda instance that may be mid-flight on other, unrelated
     concurrent requests (static assets, other routes). Exiting or leaving
     `ready` rejected kills/breaks all of them, not just the DB-dependent
     one. Swallow the error so `ready` resolves; callers proceed straight
     to pool.query(), which fails (and fails gracefully) only for requests
     that actually touch the DB. The next cold start retries initSchema(). */
});

module.exports = { prepare, exec, transaction, pool, ready };
