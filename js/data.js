/* ═══════════════════════════════════════
   SEED DATA — products, brands, categories
   ═══════════════════════════════════════ */
const SeedData = {
  brands: [
    { name: 'Chanel',        image: null },
    { name: 'Dior',          image: null },
    { name: 'Tom Ford',      image: null },
    { name: 'Versace',       image: null },
    { name: 'Gucci',         image: null },
    { name: 'YSL',           image: null },
    { name: 'Armani',        image: null },
    { name: 'Ajmal',         image: null },
    { name: 'Rasasi',        image: null },
    { name: 'OGX',           image: null },
    { name: 'Shea Moisture', image: null },
    { name: 'Cantu',         image: null },
    { name: 'Pantene',       image: null },
    { name: 'Nivea',         image: null },
    { name: 'Dove',          image: null },
    { name: 'The Body Shop', image: null },
    { name: 'Vaseline',      image: null },
  ],

  categories: [
    'Eau de Parfum','Eau de Toilette','Cologne','Body Spray',
    'Oud & Oriental','Floral','Fresh & Citrus',
    'Shampoo','Conditioner','Hair Oil','Hair Mask','Styling',
    'Natural Hair','Relaxed Hair',
    'Body Lotion','Body Wash','Body Scrub','Deodorant',
    'Sunscreen','Moisturizing','Brightening','Anti-aging',
  ],

  products: [
    /* ── PERFUME ── */
    {id:1,  name:'Chanel No. 5 EDP',       brand:'Chanel',       cat:'perfume', subcat:'Eau de Parfum', gender:'Female',   price:8500,  oldPrice:10000, emoji:'🌸', desc:'The iconic floral-aldehyde. Bold, feminine, timeless.',                sizes:['30ml','50ml','100ml'], rating:4.9, isNew:true,  isTrend:true,  isFeat:true,  stock:12},
    {id:2,  name:'Dior Sauvage EDT',        brand:'Dior',         cat:'perfume', subcat:'Eau de Toilette',gender:'Male',    price:7800,  oldPrice:null,  emoji:'🌊', desc:'Fresh, rugged, magnetic. Wide open spaces in a bottle.',          sizes:['60ml','100ml','200ml'],rating:4.8, isNew:true,  isTrend:true,  isFeat:true,  stock:8},
    {id:3,  name:'Tom Ford Black Orchid',   brand:'Tom Ford',     cat:'perfume', subcat:'Eau de Parfum', gender:'Unisex',   price:12000, oldPrice:14500, emoji:'🖤', desc:'Dark, luxurious, mysterious. A grand floral fragrance.',          sizes:['50ml','100ml'],        rating:4.9, isNew:false, isTrend:true,  isFeat:true,  stock:5},
    {id:4,  name:'Versace Eros EDT',        brand:'Versace',      cat:'perfume', subcat:'Eau de Toilette',gender:'Male',    price:6500,  oldPrice:8000,  emoji:'💙', desc:'Powerful, fresh and sensual. For the bold.',                     sizes:['30ml','50ml','100ml'], rating:4.7, isNew:false, isTrend:true,  isFeat:false, stock:15},
    {id:5,  name:'Gucci Bloom EDP',         brand:'Gucci',        cat:'perfume', subcat:'Floral',         gender:'Female',   price:9200,  oldPrice:null,  emoji:'🌺', desc:'Lush floral bouquet. Fresh, natural and feminine.',              sizes:['50ml','100ml'],        rating:4.8, isNew:true,  isTrend:false, isFeat:true,  stock:10},
    {id:6,  name:'YSL Mon Paris EDP',       brand:'YSL',          cat:'perfume', subcat:'Floral',         gender:'Female',   price:8900,  oldPrice:10500, emoji:'🌹', desc:'Romantic and daring. A passionate love story.',                 sizes:['50ml','90ml'],         rating:4.7, isNew:true,  isTrend:false, isFeat:false, stock:7},
    {id:7,  name:'Armani Code Absolu',      brand:'Armani',       cat:'perfume', subcat:'Eau de Parfum', gender:'Male',    price:9500,  oldPrice:11000, emoji:'♠️', desc:'Magnetic, mysterious and addictive.',                           sizes:['60ml','110ml'],        rating:4.8, isNew:true,  isTrend:true,  isFeat:true,  stock:6},
    {id:8,  name:'Ajmal Aurum EDP',         brand:'Ajmal',        cat:'perfume', subcat:'Oud & Oriental', gender:'Female',   price:3500,  oldPrice:null,  emoji:'✨', desc:'Rich oriental floral — sophisticated and affordable.',           sizes:['75ml'],                rating:4.6, isNew:false, isTrend:true,  isFeat:false, stock:20},
    {id:9,  name:'Rasasi La Yuqawam',       brand:'Rasasi',       cat:'perfume', subcat:'Oud & Oriental', gender:'Unisex',   price:4200,  oldPrice:5000,  emoji:'🌙', desc:'Luxurious Arabic oud blend. Long-lasting.',                      sizes:['75ml','100ml'],        rating:4.7, isNew:false, isTrend:false, isFeat:true,  stock:14},
    {id:10, name:'Baby Fresh Mist',         brand:'Rasasi',       cat:'perfume', subcat:'Body Spray',    gender:'Children', price:1200,  oldPrice:null,  emoji:'🍭', desc:'Gentle, playful and safe. Fruity floral scent.',                 sizes:['100ml'],               rating:4.5, isNew:true,  isTrend:false, isFeat:false, stock:25},

    /* ── HAIR ── */
    {id:11, name:'OGX Argan Oil Shampoo',   brand:'OGX',          cat:'hair',    subcat:'Shampoo',        gender:'All',      price:1800,  oldPrice:2200,  emoji:'🧴', desc:'Moroccan argan oil. Restores shine and moisture.',               sizes:['385ml','750ml'],       rating:4.6, isNew:true,  isTrend:true,  isFeat:true,  stock:30},
    {id:12, name:'Shea Moisture Curl Enhancer',brand:'Shea Moisture',cat:'hair', subcat:'Styling',        gender:'All',      price:2200,  oldPrice:null,  emoji:'💚', desc:'Define and moisturize natural curls. Frizz-free.',               sizes:['340g'],                rating:4.8, isNew:true,  isTrend:true,  isFeat:false, stock:18},
    {id:13, name:'Cantu Shea Butter Leave-In', brand:'Cantu',      cat:'hair',   subcat:'Conditioner',    gender:'All',      price:1600,  oldPrice:2000,  emoji:'🥜', desc:'Rich shea butter for natural and relaxed hair.',                 sizes:['453g'],                rating:4.7, isNew:false, isTrend:true,  isFeat:true,  stock:22},
    {id:14, name:'Pantene Pro-V Shampoo',    brand:'Pantene',      cat:'hair',    subcat:'Shampoo',        gender:'All',      price:950,   oldPrice:1200,  emoji:'🔵', desc:'Strengthens and adds shine. For all hair types.',                sizes:['400ml','700ml'],       rating:4.4, isNew:false, isTrend:false, isFeat:false, stock:40},
    {id:15, name:'OGX Coconut Milk Mask',    brand:'OGX',          cat:'hair',    subcat:'Hair Mask',      gender:'All',      price:2400,  oldPrice:3000,  emoji:'🥥', desc:'Deep conditioning coconut milk mask.',                           sizes:['300ml'],               rating:4.7, isNew:true,  isTrend:true,  isFeat:true,  stock:12},
    {id:16, name:'Jamaican Black Castor Oil',brand:'Shea Moisture', cat:'hair',   subcat:'Hair Oil',       gender:'All',      price:1900,  oldPrice:null,  emoji:'🌿', desc:'Promotes hair growth. 100% natural.',                            sizes:['118ml','237ml'],       rating:4.9, isNew:false, isTrend:true,  isFeat:false, stock:16},
    {id:17, name:'Cantu Thermal Shield',     brand:'Cantu',        cat:'hair',    subcat:'Styling',        gender:'All',      price:1750,  oldPrice:2100,  emoji:'🛡️', desc:'Heat protectant up to 450°F.',                                   sizes:['237ml'],               rating:4.5, isNew:true,  isTrend:false, isFeat:false, stock:20},
    {id:18, name:'Shea Moisture Manuka Honey',brand:'Shea Moisture',cat:'hair',  subcat:'Hair Mask',       gender:'All',      price:2600,  oldPrice:3200,  emoji:'🍯', desc:'Intensive repair with Manuka honey.',                            sizes:['326g'],                rating:4.8, isNew:true,  isTrend:true,  isFeat:true,  stock:9},
    {id:19, name:'Pantene Gold Series',      brand:'Pantene',      cat:'hair',    subcat:'Natural Hair',   gender:'All',      price:1400,  oldPrice:1700,  emoji:'🌟', desc:'Specially for natural African hair.',                            sizes:['591ml'],               rating:4.6, isNew:false, isTrend:false, isFeat:true,  stock:14},
    {id:20, name:'Cantu Curl Activator',     brand:'Cantu',        cat:'hair',    subcat:'Styling',        gender:'All',      price:1550,  oldPrice:null,  emoji:'💫', desc:'Activates and defines curls beautifully.',                       sizes:['355ml'],               rating:4.7, isNew:true,  isTrend:true,  isFeat:false, stock:18},

    /* ── BODY ── */
    {id:21, name:'Nivea Body Milk Lotion',   brand:'Nivea',        cat:'body',    subcat:'Body Lotion',    gender:'All',      price:850,   oldPrice:1000,  emoji:'🤍', desc:'48-hour moisture. Deeply nourishes dry skin.',                   sizes:['400ml','600ml'],       rating:4.5, isNew:false, isTrend:true,  isFeat:false, stock:50},
    {id:22, name:'Dove Gentle Shower Gel',   brand:'Dove',         cat:'body',    subcat:'Body Wash',      gender:'All',      price:750,   oldPrice:null,  emoji:'🕊️', desc:'¼ moisturizing cream. Soft and smooth.',                         sizes:['250ml','500ml'],       rating:4.6, isNew:false, isTrend:false, isFeat:false, stock:45},
    {id:23, name:'The Body Shop Shea Butter',brand:'The Body Shop', cat:'body',   subcat:'Body Lotion',    gender:'All',      price:3800,  oldPrice:4500,  emoji:'🌰', desc:'Community Fair Trade shea butter.',                              sizes:['200ml'],               rating:4.9, isNew:true,  isTrend:true,  isFeat:true,  stock:8},
    {id:24, name:'Vaseline Intensive Care',  brand:'Vaseline',     cat:'body',    subcat:'Body Lotion',    gender:'All',      price:680,   oldPrice:800,   emoji:'💎', desc:'Heals extremely dry skin. Dermatologist tested.',                sizes:['200ml','400ml'],       rating:4.4, isNew:false, isTrend:false, isFeat:false, stock:60},
    {id:25, name:'Nivea Original Creme',     brand:'Nivea',        cat:'body',    subcat:'Moisturizing',   gender:'All',      price:450,   oldPrice:550,   emoji:'🔵', desc:'Multi-purpose moisturizer. Classic formula.',                    sizes:['75ml','150ml','400ml'],rating:4.7, isNew:false, isTrend:true,  isFeat:false, stock:80},
    {id:26, name:'Dove Deodorant Roll-On',   brand:'Dove',         cat:'body',    subcat:'Deodorant',      gender:'All',      price:550,   oldPrice:null,  emoji:'🌿', desc:'48-hour odour protection. Alcohol-free.',                        sizes:['50ml'],                rating:4.5, isNew:false, isTrend:false, isFeat:false, stock:40},
    {id:27, name:'The Body Shop Vitamin C',  brand:'The Body Shop', cat:'body',   subcat:'Brightening',    gender:'All',      price:4200,  oldPrice:5000,  emoji:'🍊', desc:'Brightens and evens skin tone.',                                 sizes:['30ml'],                rating:4.8, isNew:true,  isTrend:true,  isFeat:true,  stock:6},
    {id:28, name:'Nivea SPF 50 Sunscreen',   brand:'Nivea',        cat:'body',    subcat:'Sunscreen',      gender:'All',      price:2800,  oldPrice:3200,  emoji:'☀️', desc:'Broad spectrum UVA/UVB. Non-greasy.',                            sizes:['88ml'],                rating:4.7, isNew:true,  isTrend:false, isFeat:true,  stock:15},
    {id:29, name:'Dove Exfoliating Scrub',   brand:'Dove',         cat:'body',    subcat:'Body Scrub',     gender:'All',      price:1200,  oldPrice:1500,  emoji:'✨', desc:'Gentle exfoliation with micro-moisture capsules.',               sizes:['250ml'],               rating:4.6, isNew:true,  isTrend:true,  isFeat:false, stock:22},
    {id:30, name:'Vaseline Petroleum Jelly', brand:'Vaseline',     cat:'body',    subcat:'Moisturizing',   gender:'All',      price:320,   oldPrice:null,  emoji:'💛', desc:'Pure petroleum jelly. Heals cracked skin.',                     sizes:['50g','100g','250g'],   rating:4.8, isNew:false, isTrend:false, isFeat:false, stock:100},
  ],
};
