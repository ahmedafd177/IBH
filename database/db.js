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

function seedProducts() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
  if (count > 0) return;

  const ins = db.prepare(`
    INSERT INTO products
      (name,brand,cat,subcat,gender,price,oldPrice,emoji,desc,sizes,rating,isNew,isTrend,isFeat,isVisible,stock)
    VALUES
      (@name,@brand,@cat,@subcat,@gender,@price,@oldPrice,@emoji,@desc,@sizes,@rating,@isNew,@isTrend,@isFeat,1,@stock)
  `);

  const products = [
    /* PERFUME */
    {name:'Chanel No. 5 EDP',       brand:'Chanel',        cat:'perfume',subcat:'Eau de Parfum',   gender:'Female',  price:8500, oldPrice:10000,emoji:'🌸',desc:'The iconic floral-aldehyde. Bold, feminine, timeless.',           sizes:'["30ml","50ml","100ml"]',       rating:4.9,isNew:1,isTrend:1,isFeat:1,stock:12},
    {name:'Dior Sauvage EDT',        brand:'Dior',          cat:'perfume',subcat:'Eau de Toilette', gender:'Male',    price:7800, oldPrice:null, emoji:'🌊',desc:'Fresh, rugged, magnetic. Wide open spaces in a bottle.',        sizes:'["60ml","100ml","200ml"]',      rating:4.8,isNew:1,isTrend:1,isFeat:1,stock:8},
    {name:'Tom Ford Black Orchid',   brand:'Tom Ford',      cat:'perfume',subcat:'Eau de Parfum',   gender:'Unisex',  price:12000,oldPrice:14500,emoji:'🖤',desc:'Dark, luxurious, mysterious. A grand floral fragrance.',        sizes:'["50ml","100ml"]',              rating:4.9,isNew:0,isTrend:1,isFeat:1,stock:5},
    {name:'Versace Eros EDT',        brand:'Versace',       cat:'perfume',subcat:'Eau de Toilette', gender:'Male',    price:6500, oldPrice:8000, emoji:'💙',desc:'Powerful, fresh and sensual. For the bold.',                   sizes:'["30ml","50ml","100ml"]',       rating:4.7,isNew:0,isTrend:1,isFeat:0,stock:15},
    {name:'Gucci Bloom EDP',         brand:'Gucci',         cat:'perfume',subcat:'Floral',          gender:'Female',  price:9200, oldPrice:null, emoji:'🌺',desc:'Lush floral bouquet. Fresh, natural and feminine.',            sizes:'["50ml","100ml"]',              rating:4.8,isNew:1,isTrend:0,isFeat:1,stock:10},
    {name:'YSL Mon Paris EDP',       brand:'YSL',           cat:'perfume',subcat:'Floral',          gender:'Female',  price:8900, oldPrice:10500,emoji:'🌹',desc:'Romantic and daring. A passionate love story.',               sizes:'["50ml","90ml"]',               rating:4.7,isNew:1,isTrend:0,isFeat:0,stock:7},
    {name:'Armani Code Absolu',      brand:'Armani',        cat:'perfume',subcat:'Eau de Parfum',   gender:'Male',    price:9500, oldPrice:11000,emoji:'♠️',desc:'Magnetic, mysterious and addictive.',                         sizes:'["60ml","110ml"]',              rating:4.8,isNew:1,isTrend:1,isFeat:1,stock:6},
    {name:'Ajmal Aurum EDP',         brand:'Ajmal',         cat:'perfume',subcat:'Oud & Oriental',  gender:'Female',  price:3500, oldPrice:null, emoji:'✨',desc:'Rich oriental floral — sophisticated and affordable.',        sizes:'["75ml"]',                      rating:4.6,isNew:0,isTrend:1,isFeat:0,stock:20},
    {name:'Rasasi La Yuqawam',       brand:'Rasasi',        cat:'perfume',subcat:'Oud & Oriental',  gender:'Unisex',  price:4200, oldPrice:5000, emoji:'🌙',desc:'Luxurious Arabic oud blend. Long-lasting.',                   sizes:'["75ml","100ml"]',              rating:4.7,isNew:0,isTrend:0,isFeat:1,stock:14},
    {name:'Baby Fresh Mist',         brand:'Rasasi',        cat:'perfume',subcat:'Body Spray',      gender:'Children',price:1200, oldPrice:null, emoji:'🍭',desc:'Gentle, playful and safe. Fruity floral scent.',              sizes:'["100ml"]',                     rating:4.5,isNew:1,isTrend:0,isFeat:0,stock:25},
    /* HAIR */
    {name:'OGX Argan Oil Shampoo',   brand:'OGX',           cat:'hair',   subcat:'Shampoo',         gender:'All',     price:1800, oldPrice:2200, emoji:'🧴',desc:'Moroccan argan oil. Restores shine and moisture.',             sizes:'["385ml","750ml"]',             rating:4.6,isNew:1,isTrend:1,isFeat:1,stock:30},
    {name:'Shea Moisture Curl Enhancer',brand:'Shea Moisture',cat:'hair', subcat:'Styling',         gender:'All',     price:2200, oldPrice:null, emoji:'💚',desc:'Define and moisturize natural curls. Frizz-free.',            sizes:'["340g"]',                      rating:4.8,isNew:1,isTrend:1,isFeat:0,stock:18},
    {name:'Cantu Shea Butter Leave-In',brand:'Cantu',        cat:'hair',  subcat:'Conditioner',     gender:'All',     price:1600, oldPrice:2000, emoji:'🥜',desc:'Rich shea butter for natural and relaxed hair.',              sizes:'["453g"]',                      rating:4.7,isNew:0,isTrend:1,isFeat:1,stock:22},
    {name:'Pantene Pro-V Shampoo',   brand:'Pantene',        cat:'hair',  subcat:'Shampoo',         gender:'All',     price:950,  oldPrice:1200, emoji:'🔵',desc:'Strengthens and adds shine. For all hair types.',             sizes:'["400ml","700ml"]',             rating:4.4,isNew:0,isTrend:0,isFeat:0,stock:40},
    {name:'OGX Coconut Milk Mask',   brand:'OGX',            cat:'hair',  subcat:'Hair Mask',       gender:'All',     price:2400, oldPrice:3000, emoji:'🥥',desc:'Deep conditioning coconut milk mask.',                        sizes:'["300ml"]',                     rating:4.7,isNew:1,isTrend:1,isFeat:1,stock:12},
    {name:'Jamaican Black Castor Oil',brand:'Shea Moisture', cat:'hair',  subcat:'Hair Oil',        gender:'All',     price:1900, oldPrice:null, emoji:'🌿',desc:'Promotes hair growth. 100% natural.',                        sizes:'["118ml","237ml"]',             rating:4.9,isNew:0,isTrend:1,isFeat:0,stock:16},
    {name:'Cantu Thermal Shield',    brand:'Cantu',          cat:'hair',  subcat:'Styling',         gender:'All',     price:1750, oldPrice:2100, emoji:'🛡️',desc:'Heat protectant up to 450°F.',                               sizes:'["237ml"]',                     rating:4.5,isNew:1,isTrend:0,isFeat:0,stock:20},
    {name:'Shea Moisture Manuka Honey',brand:'Shea Moisture',cat:'hair',  subcat:'Hair Mask',       gender:'All',     price:2600, oldPrice:3200, emoji:'🍯',desc:'Intensive repair with Manuka honey.',                        sizes:'["326g"]',                      rating:4.8,isNew:1,isTrend:1,isFeat:1,stock:9},
    {name:'Pantene Gold Series',     brand:'Pantene',        cat:'hair',  subcat:'Natural Hair',    gender:'All',     price:1400, oldPrice:1700, emoji:'🌟',desc:'Specially for natural African hair.',                        sizes:'["591ml"]',                     rating:4.6,isNew:0,isTrend:0,isFeat:1,stock:14},
    {name:'Cantu Curl Activator',    brand:'Cantu',          cat:'hair',  subcat:'Styling',         gender:'All',     price:1550, oldPrice:null, emoji:'💫',desc:'Activates and defines curls beautifully.',                  sizes:'["355ml"]',                     rating:4.7,isNew:1,isTrend:1,isFeat:0,stock:18},
    /* BODY */
    {name:'Nivea Body Milk Lotion',  brand:'Nivea',          cat:'body',  subcat:'Body Lotion',     gender:'All',     price:850,  oldPrice:1000, emoji:'🤍',desc:'48-hour moisture. Deeply nourishes dry skin.',               sizes:'["400ml","600ml"]',             rating:4.5,isNew:0,isTrend:1,isFeat:0,stock:50},
    {name:'Dove Gentle Shower Gel',  brand:'Dove',           cat:'body',  subcat:'Body Wash',       gender:'All',     price:750,  oldPrice:null, emoji:'🕊️',desc:'¼ moisturizing cream. Soft and smooth.',                    sizes:'["250ml","500ml"]',             rating:4.6,isNew:0,isTrend:0,isFeat:0,stock:45},
    {name:'The Body Shop Shea Butter',brand:'The Body Shop', cat:'body',  subcat:'Body Lotion',     gender:'All',     price:3800, oldPrice:4500, emoji:'🌰',desc:'Community Fair Trade shea butter.',                          sizes:'["200ml"]',                     rating:4.9,isNew:1,isTrend:1,isFeat:1,stock:8},
    {name:'Vaseline Intensive Care', brand:'Vaseline',       cat:'body',  subcat:'Body Lotion',     gender:'All',     price:680,  oldPrice:800,  emoji:'💎',desc:'Heals extremely dry skin. Dermatologist tested.',           sizes:'["200ml","400ml"]',             rating:4.4,isNew:0,isTrend:0,isFeat:0,stock:60},
    {name:'Nivea Original Creme',    brand:'Nivea',          cat:'body',  subcat:'Moisturizing',    gender:'All',     price:450,  oldPrice:550,  emoji:'🔵',desc:'Multi-purpose moisturizer. Classic formula.',               sizes:'["75ml","150ml","400ml"]',      rating:4.7,isNew:0,isTrend:1,isFeat:0,stock:80},
    {name:'Dove Deodorant Roll-On',  brand:'Dove',           cat:'body',  subcat:'Deodorant',       gender:'All',     price:550,  oldPrice:null, emoji:'🌿',desc:'48-hour odour protection. Alcohol-free.',                  sizes:'["50ml"]',                      rating:4.5,isNew:0,isTrend:0,isFeat:0,stock:40},
    {name:'The Body Shop Vitamin C', brand:'The Body Shop',  cat:'body',  subcat:'Brightening',     gender:'All',     price:4200, oldPrice:5000, emoji:'🍊',desc:'Brightens and evens skin tone.',                            sizes:'["30ml"]',                      rating:4.8,isNew:1,isTrend:1,isFeat:1,stock:6},
    {name:'Nivea SPF 50 Sunscreen',  brand:'Nivea',          cat:'body',  subcat:'Sunscreen',       gender:'All',     price:2800, oldPrice:3200, emoji:'☀️',desc:'Broad spectrum UVA/UVB. Non-greasy.',                      sizes:'["88ml"]',                      rating:4.7,isNew:1,isTrend:0,isFeat:1,stock:15},
    {name:'Dove Exfoliating Scrub',  brand:'Dove',           cat:'body',  subcat:'Body Scrub',      gender:'All',     price:1200, oldPrice:1500, emoji:'✨',desc:'Gentle exfoliation with micro-moisture capsules.',          sizes:'["250ml"]',                     rating:4.6,isNew:1,isTrend:1,isFeat:0,stock:22},
    {name:'Vaseline Petroleum Jelly',brand:'Vaseline',       cat:'body',  subcat:'Moisturizing',    gender:'All',     price:320,  oldPrice:null, emoji:'💛',desc:'Pure petroleum jelly. Heals cracked skin.',               sizes:'["50g","100g","250g"]',          rating:4.8,isNew:0,isTrend:0,isFeat:0,stock:100},
  ];

  const run = db.transaction(() => products.forEach(p => ins.run(p)));
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
seedProducts();

module.exports = db;
