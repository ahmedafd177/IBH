/* ═══════════════════════════════════════
   ONE-TIME MIGRATION — copies every row
   from the local database/ibh.sqlite file
   into the Supabase Postgres database
   pointed to by DATABASE_URL.

   Run once, right after the Postgres schema
   has been created (db.js creates it on
   server boot) and BEFORE relying on the
   app for real data:

     node database/migrate-to-postgres.js

   This TRUNCATEs the target tables first
   (wiping the brands/categories/admin-user
   auto-seeded by db.js) so the sqlite data
   becomes the single source of truth with
   original row ids preserved.
   ═══════════════════════════════════════ */
require('dotenv').config();
const path = require('path');
const Database = require('better-sqlite3');
const db = require('./db'); // Postgres — triggers schema creation + default seed

const SQLITE_PATH = path.join(__dirname, 'ibh.sqlite');

const SERIAL_TABLES = [
  'products', 'brands', 'categories', 'accounts',
  'delivery_areas', 'coupons', 'branches', 'reviews', 'order_notes',
];

const needsQuoting = (c) => /[A-Z]/.test(c) || c === 'desc';

async function copyTable(sqlite, table, columns) {
  const rows = sqlite.prepare(`SELECT * FROM ${table}`).all();
  if (!rows.length) { console.log(`  ${table}: 0 rows (nothing to copy)`); return; }

  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const colList = columns.map(c => needsQuoting(c) ? `"${c}"` : c).join(', ');
  const insertSql = `INSERT INTO ${table} (${colList}) VALUES (${placeholders})`;

  for (const row of rows) {
    const values = columns.map(c => row[c]);
    await db.pool.query(insertSql, values);
  }
  console.log(`  ${table}: copied ${rows.length} rows`);
}

async function resetSequence(table) {
  await db.pool.query(
    `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1), true)`
  );
}

async function main() {
  console.log(`Reading from ${SQLITE_PATH}`);
  const sqlite = new Database(SQLITE_PATH, { readonly: true });

  await db.ready; // let db.js finish creating schema + default seed data first

  console.log('Clearing auto-seeded/default rows before restoring real data…');
  await db.pool.query(`
    TRUNCATE products, brands, categories, orders, main_categories, accounts,
             delivery_areas, coupons, branches, settings, order_notes, reviews
    RESTART IDENTITY CASCADE
  `);

  console.log('Copying tables…');

  await copyTable(sqlite, 'brands', ['id', 'name', 'image']);
  await copyTable(sqlite, 'categories', ['id', 'name']);
  await copyTable(sqlite, 'main_categories', ['id', 'slug', 'name', 'image']);
  await copyTable(sqlite, 'delivery_areas', ['id', 'name', 'price']);
  await copyTable(sqlite, 'branches', ['id', 'name', 'location', 'phone']);
  await copyTable(sqlite, 'settings', ['key', 'value']);
  await copyTable(sqlite, 'coupons', [
    'id', 'code', 'type', 'value', 'min_order', 'max_uses', 'uses',
    'expires_at', 'is_active', 'show_in_notif',
  ]);
  await copyTable(sqlite, 'accounts', [
    'id', 'name', 'phone', 'email', 'role', 'branch', 'password_hash', 'created_at',
  ]);
  await copyTable(sqlite, 'products', [
    'id', 'name', 'brand', 'cat', 'subcat', 'gender', 'price', 'oldPrice', 'emoji',
    'desc', 'sizes', 'rating', 'isNew', 'isTrend', 'isFeat', 'isVisible', 'stock',
    'imageMain', 'imageAlt1', 'imageAlt2', 'isOnSale', 'isHot', 'review_count',
  ]);
  await copyTable(sqlite, 'reviews', ['id', 'product_id', 'name', 'rating', 'comment', 'created_at']);
  await copyTable(sqlite, 'order_notes', ['id', 'order_id', 'author_id', 'author_name', 'note', 'is_internal', 'created_at']);

  /* orders.id is an app-generated TEXT id (not SERIAL) — no sequence to reset.
     created_at didn't exist in the old schema, so we synthesize timestamps that
     preserve original insertion order (oldest sqlite rowid → earliest timestamp),
     all set safely in the past so genuinely new orders created after this
     migration still sort after them. */
  const orderRows = sqlite.prepare('SELECT * FROM orders ORDER BY rowid ASC').all();
  if (orderRows.length) {
    const insertSql = `
      INSERT INTO orders (id, status, date, time, total, items, customer, branch,
        payment, payment_status, mpesa_ref, coupon_code, coupon_discount,
        assigned_to, assigned_name, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    `;
    const now = Date.now();
    for (let i = 0; i < orderRows.length; i++) {
      const o = orderRows[i];
      const createdAt = new Date(now - (orderRows.length - i) * 1000);
      await db.pool.query(insertSql, [
        o.id, o.status, o.date, o.time, o.total, o.items, o.customer, o.branch,
        o.payment, o.payment_status, o.mpesa_ref, o.coupon_code, o.coupon_discount,
        o.assigned_to, o.assigned_name, createdAt,
      ]);
    }
    console.log(`  orders: copied ${orderRows.length} rows`);
  } else {
    console.log('  orders: 0 rows (nothing to copy)');
  }

  console.log('Resetting sequences for tables with explicit ids…');
  for (const table of SERIAL_TABLES) await resetSequence(table);

  console.log('Note: sessions were NOT migrated — existing logins will need to sign in again.');
  console.log('✓ Migration complete.');
  sqlite.close();
  await db.pool.end();
}

main().catch(e => {
  console.error('Migration failed:', e);
  process.exit(1);
});
