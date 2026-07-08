/* ═══════════════════════════════════════
   EMAIL — order notifications via Resend.
   Soft-disabled (logs once, no-ops) when
   RESEND_API_KEY isn't set, so the app still
   runs fine before email is configured.
   ═══════════════════════════════════════ */
const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM   = process.env.ORDER_NOTIFICATION_FROM_EMAIL || 'onboarding@resend.dev';

if (!resend) {
  console.warn('RESEND_API_KEY not set — order notification emails are disabled.');
}

function buildOrderEmailHtml(order) {
  const itemsHtml = (order.items || []).map(i => `
    <tr>
      <td style="padding:.4rem .5rem;border-bottom:1px solid #eee">${i.name}${i.brand ? ` <span style="color:#888">(${i.brand})</span>` : ''}</td>
      <td style="padding:.4rem .5rem;border-bottom:1px solid #eee;text-align:center">${i.qty}</td>
      <td style="padding:.4rem .5rem;border-bottom:1px solid #eee;text-align:right">KES ${((i.price || 0) * (i.qty || 1)).toLocaleString()}</td>
    </tr>`).join('');

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto">
      <h2 style="color:#1e3a8a;margin-bottom:.25rem">New order received</h2>
      <p style="color:#555;margin-top:0">${order.id} — ${order.date} ${order.time || ''}</p>
      <p><strong>Customer:</strong> ${order.customer?.name || '—'} (${order.customer?.phone || '—'})</p>
      ${order.customer?.zone ? `<p><strong>Zone:</strong> ${order.customer.zone}</p>` : ''}
      <p><strong>Payment:</strong> ${(order.payment || '').toUpperCase()} · <strong>Total:</strong> KES ${(order.total || 0).toLocaleString()}</p>
      <table style="width:100%;border-collapse:collapse;margin-top:.75rem">
        <thead>
          <tr style="background:#f1f5ff">
            <th style="text-align:left;padding:.4rem .5rem">Item</th>
            <th style="padding:.4rem .5rem">Qty</th>
            <th style="text-align:right;padding:.4rem .5rem">Total</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <p style="margin-top:1.25rem">
        <a href="${(process.env.APP_URL || '').replace(/\/$/, '')}/ibh-manage" style="color:#1e3a8a">Open admin dashboard →</a>
      </p>
    </div>`;
}

/* Fire-and-log — never throws, so a broken/unconfigured mail
   provider can't take down order creation. */
async function notifyNewOrder(order, recipientEmails) {
  if (!resend || !recipientEmails || !recipientEmails.length) return;
  const subject = `New order ${order.id} — KES ${(order.total || 0).toLocaleString()}`;
  const html    = buildOrderEmailHtml(order);

  /* Send one-by-one instead of a single batched call — on Resend's
     sandbox (unverified domain) tier, a single unrecognized recipient
     fails the *entire* call, silently blocking delivery to everyone
     else too. Isolating each send means the addresses that can go
     through still do. */
  const results = await Promise.allSettled(
    recipientEmails.map(to => resend.emails.send({ from: FROM, to, subject, html }))
  );
  results.forEach((r, i) => {
    if (r.status === 'rejected' || r.value?.error) {
      const reason = r.reason?.message || r.value?.error?.message || 'unknown error';
      console.error(`Failed to send order notification to ${recipientEmails[i]}:`, reason);
    }
  });
}

module.exports = { notifyNewOrder };
