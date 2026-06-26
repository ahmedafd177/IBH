const express = require('express');
const db      = require('../database/db');
const router  = express.Router();

/* ── helpers ── */
function row2js(p) {
  if (!p) return null;
  return {
    ...p,
    sizes:     JSON.parse(p.sizes   || '[]'),
    isNew:     Boolean(p.isNew),
    isTrend:   Boolean(p.isTrend),
    isFeat:    Boolean(p.isFeat),
    isVisible: Boolean(p.isVisible),
  };
}

/* GET /api/products/genders?cat=X — distinct genders that exist in DB */
router.get('/genders', (req, res) => {
  const { cat } = req.query;
  let sql = "SELECT DISTINCT gender FROM products WHERE isVisible = 1 AND gender != 'All'";
  const args = [];
  if (cat) { sql += ' AND cat = ?'; args.push(cat); }
  sql += ' ORDER BY gender ASC';
  res.json(db.prepare(sql).all(...args).map(r => r.gender));
});

/* GET /api/products/subcats?cat=X — distinct subcategories that exist in DB */
router.get('/subcats', (req, res) => {
  const { cat } = req.query;
  let sql = 'SELECT DISTINCT subcat FROM products WHERE isVisible = 1';
  const args = [];
  if (cat) { sql += ' AND cat = ?'; args.push(cat); }
  sql += ' ORDER BY subcat ASC';
  res.json(db.prepare(sql).all(...args).map(r => r.subcat));
});

/* GET /api/products */
router.get('/', (req, res) => {
  const { cat, brand, gender, subcat, isNew, isTrend, isFeat, search, admin } = req.query;
  let sql    = 'SELECT * FROM products WHERE 1=1';
  const args = [];

  if (!admin)   { sql += ' AND isVisible = 1'; }
  if (cat)      { sql += ' AND cat = ?';    args.push(cat); }
  if (brand)    { sql += ' AND brand = ?';  args.push(brand); }
  if (gender)   { sql += ' AND (gender = ? OR gender = "All")'; args.push(gender); }
  if (subcat)   { sql += ' AND subcat = ?'; args.push(subcat); }
  if (isNew)    { sql += ' AND isNew = 1'; }
  if (isTrend)  { sql += ' AND isTrend = 1'; }
  if (isFeat)   { sql += ' AND isFeat = 1'; }
  if (search) {
    const q = `%${search}%`;
    sql += ' AND (name LIKE ? OR brand LIKE ? OR subcat LIKE ? OR gender LIKE ?)';
    args.push(q, q, q, q);
  }

  sql += ' ORDER BY id DESC';
  res.json(db.prepare(sql).all(...args).map(row2js));
});

/* GET /api/products/:id */
router.get('/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json(row2js(p));
});

/* POST /api/products */
router.post('/', (req, res) => {
  const d = req.body;
  const stmt = db.prepare(`
    INSERT INTO products
      (name,brand,cat,subcat,gender,price,oldPrice,emoji,desc,sizes,rating,isNew,isTrend,isFeat,isVisible,stock,imageMain,imageAlt1,imageAlt2)
    VALUES
      (@name,@brand,@cat,@subcat,@gender,@price,@oldPrice,@emoji,@desc,@sizes,@rating,@isNew,@isTrend,@isFeat,@isVisible,@stock,@imageMain,@imageAlt1,@imageAlt2)
  `);
  const info = stmt.run({
    name:      d.name,
    brand:     d.brand,
    cat:       d.cat,
    subcat:    d.subcat,
    gender:    d.gender    || 'All',
    price:     d.price,
    oldPrice:  d.oldPrice  || null,
    emoji:     d.emoji     || '✨',
    desc:      d.desc      || '',
    sizes:     JSON.stringify(d.sizes || []),
    rating:    d.rating    || 4.5,
    isNew:     d.isNew     ? 1 : 0,
    isTrend:   d.isTrend   ? 1 : 0,
    isFeat:    d.isFeat    ? 1 : 0,
    isVisible: d.isVisible !== false ? 1 : 0,
    stock:     d.stock     || 0,
    imageMain: d.imageMain || null,
    imageAlt1: d.imageAlt1 || null,
    imageAlt2: d.imageAlt2 || null,
  });
  const np = db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(row2js(np));
});

/* PUT /api/products/:id */
router.put('/:id', (req, res) => {
  const d = req.body;
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const merged = { ...existing, ...d };
  db.prepare(`
    UPDATE products SET
      name=@name, brand=@brand, cat=@cat, subcat=@subcat, gender=@gender,
      price=@price, oldPrice=@oldPrice, emoji=@emoji, desc=@desc, sizes=@sizes,
      rating=@rating, isNew=@isNew, isTrend=@isTrend, isFeat=@isFeat,
      isVisible=@isVisible, stock=@stock,
      imageMain=@imageMain, imageAlt1=@imageAlt1, imageAlt2=@imageAlt2
    WHERE id=@id
  `).run({
    ...merged,
    id:        req.params.id,
    sizes:     typeof merged.sizes === 'string' ? merged.sizes : JSON.stringify(merged.sizes || []),
    isNew:     merged.isNew     ? 1 : 0,
    isTrend:   merged.isTrend   ? 1 : 0,
    isFeat:    merged.isFeat    ? 1 : 0,
    isVisible: merged.isVisible !== false && merged.isVisible !== 0 ? 1 : 0,
  });
  res.json(row2js(db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id)));
});

/* DELETE /api/products/:id */
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
