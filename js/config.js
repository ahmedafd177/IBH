/* ═══════════════════════════════════════
   CONFIG
   ═══════════════════════════════════════ */
const Config = {
  BASE_URL:          null,
  USE_LOCAL_STORAGE: true,

  LS_KEYS: {
    PRODUCTS:   'ibh_products',
    CART:       'ibh_cart',
    WISHLIST:   'ibh_wish',
    ORDERS:     'ibh_orders',
    BRANDS:     'ibh_brands',
    CATEGORIES: 'ibh_cats',
  },

  /* ── Google OAuth — set your Client ID to enable Google Sign-In ── */
  GOOGLE_CLIENT_ID: '',

  /* ── M-Pesa till / paybill ── */
  MPESA_TILL:  '123456',
  MPESA_NAME:  'Inspiring Beauty Hub',

  /* ── Delivery zones (label + fee in KES) ── */
  DELIVERY_ZONES: [
    { label: 'CBD / Eastleigh',           fee: 0   },
    { label: 'Westlands / Parklands',     fee: 300 },
    { label: 'Kilimani / Upper Hill',     fee: 300 },
    { label: 'South B / South C',         fee: 300 },
    { label: 'Ngong Road / Lavington',    fee: 350 },
    { label: 'Kasarani / Thika Road',     fee: 350 },
    { label: 'Embakasi / Utawala',        fee: 350 },
    { label: 'Ruaka / Kitisuru',          fee: 400 },
    { label: 'Karen / Langata / Rongai',  fee: 450 },
    { label: 'Outside Nairobi',           fee: 600 },
  ],

  PAYMENT_METHODS: [
    { id: 'mpesa', label: 'M-PESA',          icon: '📱', sub: 'Lipa na M-PESA' },
    { id: 'cod',   label: 'Pay on Delivery', icon: '💵', sub: 'Cash when delivered' },
    { id: 'card',  label: 'Card',            icon: '💳', sub: 'Visa / Mastercard' },
  ],

  BRANCHES: [
    { name: 'CBD Branch',                       phone: '+254719795442' },
    { name: 'Eastleigh Branch — A Trendy Scents', phone: '+254722953639' },
  ],
};
