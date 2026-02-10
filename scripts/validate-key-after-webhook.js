require('dotenv').config();
const crypto = require('crypto');
const db = require('../config/database');
const webhook = require('../netlify/functions/webhook-stripe.js');

function signEvent(payload, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const body = JSON.stringify(payload);
  const sig = crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return { body, headers: { 'stripe-signature': `t=${timestamp},v1=${sig}` } };
}

(async () => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('Missing STRIPE_WEBHOOK_SECRET');
    process.exit(1);
  }

  const apiKey = process.argv[2];
  const customer = process.argv[3];
  const subscription = process.argv[4];
  if (!apiKey || !customer || !subscription) {
    console.error('Usage: node scripts/validate-key-after-webhook.js <api_key> <customer_id> <subscription_id>');
    process.exit(1);
  }

  const failed = { id: 'evt_check_fail', object: 'event', type: 'invoice.payment_failed', data: { object: { id: 'in_check_fail', customer, subscription } } };
  const succeeded = { id: 'evt_check_succeed', object: 'event', type: 'invoice.payment_succeeded', data: { object: { id: 'in_check_succeed', customer, subscription } } };

  const show = async (label) => {
    const v = await db.validateApiKey(apiKey);
    console.log(label, v);
  };

  // Suspend
  let ev = signEvent(failed, secret);
  await webhook.handler({ body: ev.body, headers: ev.headers });
  await show('after_failed');

  // Restore
  ev = signEvent(succeeded, secret);
  await webhook.handler({ body: ev.body, headers: ev.headers });
  await show('after_succeeded');
})();
