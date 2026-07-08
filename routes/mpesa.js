const express = require('express');
const https   = require('https');
const db      = require('../database/db');
const router  = express.Router();

const IS_SANDBOX = process.env.MPESA_ENV !== 'production';
const BASE_URL   = IS_SANDBOX
  ? 'https://sandbox.safaricom.co.ke'
  : 'https://api.safaricom.co.ke';

/* ── OAuth token (cached for 55 min) ── */
let _token    = null;
let _tokenExp = 0;

async function getToken() {
  if (_token && Date.now() < _tokenExp) return _token;

  const key    = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;
  if (!key || !secret) throw new Error('M-PESA credentials not configured');

  const creds = Buffer.from(`${key}:${secret}`).toString('base64');
  const data  = await _fetch('GET', `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    Authorization: `Basic ${creds}`,
  });

  _token    = data.access_token;
  _tokenExp = Date.now() + 55 * 60 * 1000;
  return _token;
}

/* ── Generic HTTPS helper ── */
function _fetch(method, url, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const opts = {
      hostname: parsed.hostname,
      path:     parsed.pathname + parsed.search,
      method,
      headers:  { 'Content-Type': 'application/json', ...headers },
    };
    const req = https.request(opts, res => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch { reject(new Error('Invalid JSON from M-PESA')); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/* ── Timestamp: YYYYMMDDHHmmss ── */
function timestamp() {
  return new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
}

/* POST /api/mpesa/stk-push
   Body: { phone, amount, orderId }
   Initiates STK Push; Safaricom sends a prompt to the customer's phone. */
router.post('/stk-push', async (req, res) => {
  try {
    const { phone, amount, orderId } = req.body;
    if (!phone || !amount) return res.status(400).json({ error: 'phone and amount required' });

    const shortCode = process.env.MPESA_SHORTCODE;
    const passkey   = process.env.MPESA_PASSKEY;
    const callbackUrl = process.env.MPESA_CALLBACK_URL;

    if (!shortCode || !passkey || !callbackUrl) {
      return res.status(503).json({ error: 'M-PESA not configured on this server' });
    }

    const ts       = timestamp();
    const password = Buffer.from(`${shortCode}${passkey}${ts}`).toString('base64');

    /* Normalise phone: 07XX → 2547XX */
    const safPhone = String(phone).replace(/^0/, '254').replace(/^\+/, '');

    const token = await getToken();
    const result = await _fetch('POST', `${BASE_URL}/mpesa/stkpush/v1/processrequest`, {
      Authorization: `Bearer ${token}`,
    }, {
      BusinessShortCode: shortCode,
      Password:          password,
      Timestamp:         ts,
      TransactionType:   'CustomerPayBillOnline',
      Amount:            Math.ceil(Number(amount)),
      PartyA:            safPhone,
      PartyB:            shortCode,
      PhoneNumber:       safPhone,
      CallBackURL:       callbackUrl,
      AccountReference:  orderId ? `IBH-${orderId}` : 'IBH',
      TransactionDesc:   'IBH Order Payment',
    });

    if (result.ResponseCode === '0') {
      res.json({ ok: true, checkoutRequestId: result.CheckoutRequestID });
    } else {
      res.status(400).json({ error: result.CustomerMessage || 'STK push failed' });
    }
  } catch (e) {
    console.error('M-PESA STK push error:', e.message);
    res.status(500).json({ error: 'M-PESA request failed. Check server configuration.' });
  }
});

/* POST /api/mpesa/callback
   Safaricom calls this URL when the customer completes or cancels payment.
   IMPORTANT: This endpoint must be publicly reachable (use ngrok in dev). */
router.post('/callback', async (req, res) => {
  try {
    const body = req.body?.Body?.stkCallback;
    if (!body) return res.json({ ResultCode: 0, ResultDesc: 'OK' });

    const { ResultCode, CheckoutRequestID, CallbackMetadata } = body;

    if (ResultCode === 0 && CallbackMetadata?.Item) {
      const items  = CallbackMetadata.Item;
      const get    = name => items.find(i => i.Name === name)?.Value;
      const amount = get('Amount');
      const mpesaRef = get('MpesaReceiptNumber');
      const phone    = get('PhoneNumber');
      const ref      = get('AccountReference') || '';
      const orderId  = ref.replace('IBH-', '');

      /* Mark the matching order as paid */
      if (orderId) {
        try {
          await db.prepare(`UPDATE orders SET status = 'paid', payment = 'mpesa', notes = ? WHERE id = ?`)
            .run(`M-PESA ${mpesaRef} KES ${amount} from ${phone}`, Number(orderId));
        } catch (e) {
          console.error('Failed to update order after M-PESA payment:', e.message);
        }
      }

      console.log(`✓ M-PESA payment: ${mpesaRef} — KES ${amount} from ${phone} (Order ${orderId})`);
    } else {
      console.log(`✗ M-PESA STK cancelled: ${CheckoutRequestID} code=${ResultCode}`);
    }
  } catch (e) {
    console.error('M-PESA callback error:', e.message);
  }

  /* Always acknowledge receipt to Safaricom */
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

/* GET /api/mpesa/status/:checkoutRequestId — poll for payment status */
router.get('/status/:id', async (req, res) => {
  try {
    const shortCode = process.env.MPESA_SHORTCODE;
    const passkey   = process.env.MPESA_PASSKEY;
    if (!shortCode || !passkey) return res.status(503).json({ error: 'Not configured' });

    const ts       = timestamp();
    const password = Buffer.from(`${shortCode}${passkey}${ts}`).toString('base64');
    const token    = await getToken();

    const result = await _fetch('POST', `${BASE_URL}/mpesa/stkpushquery/v1/query`, {
      Authorization: `Bearer ${token}`,
    }, {
      BusinessShortCode: shortCode,
      Password:          password,
      Timestamp:         ts,
      CheckoutRequestID: req.params.id,
    });

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
