/* ═══════════════════════════════════════
   DATABASE — SQLite via better-sqlite3
   Creates tables on first run and seeds
   with SeedData if tables are empty.
   ═══════════════════════════════════════ */
const Database = require('better-sqlite3');
const path     = require('path');

const db = new Database(path.join(__dirname, 'ibh.sqlite'));

/* ── Enable WAL for better concurrency ── */
db.pragma('journal_mode = WAL');

/* ── Schema ── */
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT    NOT NULL,
    brand     TEXT    NOT NULL,
    cat       TEXT    NOT NULL,
    subcat    TEXT    NOT NULL,
    gender    TEXT    NOT NULL DEFAULT 'All',
    price     REAL    NOT NULL,
    oldPrice  REAL,
    emoji     TEXT,
    desc      TEXT,
    sizes     TEXT    NOT NULL DEFAULT '[]',
    rating    REAL    NOT NULL DEFAULT 4.5,
    isNew     INTEGER NOT NULL DEFAULT 0,
    isTrend   INTEGER NOT NULL DEFAULT 0,
    isFeat    INTEGER NOT NULL DEFAULT 0,
    isVisible INTEGER NOT NULL DEFAULT 1,
    stock     INTEGER NOT NULL DEFAULT 0,
    imageMain TEXT,
    imageAlt1 TEXT,
    imageAlt2 TEXT
  );

  CREATE TABLE IF NOT EXISTS brands (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT    NOT NULL UNIQUE,
    image TEXT
  );

  CREATE TABLE IF NOT EXISTS categories (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT    NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS orders (
    id           TEXT    PRIMARY KEY,
    status       TEXT    NOT NULL DEFAULT 'confirmed',
    date         TEXT    NOT NULL,
    time         TEXT    NOT NULL,
    total        REAL    NOT NULL DEFAULT 0,
    items        TEXT    NOT NULL DEFAULT '[]',
    customer     TEXT    NOT NULL DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS main_categories (
    id    INTEGER PRIMARY KEY,
    slug  TEXT    NOT NULL UNIQUE,
    name  TEXT    NOT NULL,
    image TEXT
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    phone         TEXT    NOT NULL UNIQUE,
    email         TEXT    NOT NULL DEFAULT '',
    role          TEXT    NOT NULL DEFAULT 'customer',
    password_hash TEXT    NOT NULL DEFAULT '',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS delivery_areas (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT    NOT NULL UNIQUE,
    price REAL    NOT NULL DEFAULT 0
  );
`);

/* ── Seed helpers ── */
function seedBrands() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM brands').get().n;
  if (count > 0) return;
  const seedBrands = [
    'Chanel','Dior','Tom Ford','Versace','Gucci','YSL','Armani',
    'Ajmal','Rasasi','OGX','Shea Moisture','Cantu','Pantene',
    'Nivea','Dove','The Body Shop','Vaseline',
  ];
  const ins = db.prepare('INSERT INTO brands (name, image) VALUES (?, NULL)');
  const run = db.transaction(() => seedBrands.forEach(n => ins.run(n)));
  run();
}

function seedCategories() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM categories').get().n;
  if (count > 0) return;
  const cats = [
    'Eau de Parfum','Eau de Toilette','Cologne','Body Spray',
    'Oud & Oriental','Floral','Fresh & Citrus',
    'Shampoo','Conditioner','Hair Oil','Hair Mask','Styling',
    'Natural Hair','Relaxed Hair',
    'Body Lotion','Body Wash','Body Scrub','Deodorant',
    'Sunscreen','Moisturizing','Brightening','Anti-aging',
  ];
  const ins = db.prepare('INSERT INTO categories (name) VALUES (?)');
  const run = db.transaction(() => cats.forEach(n => ins.run(n)));
  run();
}

function seedMainCategories() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM main_categories').get().n;
  if (count > 0) return;
  const ins = db.prepare('INSERT OR IGNORE INTO main_categories (id, slug, name, image) VALUES (?, ?, ?, NULL)');
  ins.run(1, 'perfume', 'Perfume');
  ins.run(2, 'hair',    'Hair Care');
  ins.run(3, 'body',    'Body Care');
}

/* ── Migrate: add role column to existing accounts tables ── */
try { db.exec("ALTER TABLE accounts ADD COLUMN role TEXT NOT NULL DEFAULT 'customer'"); } catch {}

seedBrands();
seedCategories();
seedMainCategories();

module.exports = db;
