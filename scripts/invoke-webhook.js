require('dotenv').config();
const crypto = require('crypto');
const handler = require('../netlify/functions/webhook-stripe.js');

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

  const customer = process.argv[2];
  const subscription = process.argv[3];
  if (!customer || !subscription) {
    console.error('Usage: node scripts/invoke-webhook.js <customer_id> <subscription_id>');
    process.exit(1);
  }

  const failed = {
    id: 'evt_local_fail',
    object: 'event',
    type: 'invoice.payment_failed',
    data: { object: { id: 'in_local_fail', customer, subscription } }
  };
  const succeeded = {
    id: 'evt_local_succeed',
    object: 'event',
    type: 'invoice.payment_succeeded',
    data: { object: { id: 'in_local_succeed', customer, subscription } }
  };

  console.log('Invoking invoice.payment_failed...');
  let ev = signEvent(failed, secret);
  let res = await handler.handler({ body: ev.body, headers: ev.headers });
  console.log(res.statusCode, res.body);

  console.log('Invoking invoice.payment_succeeded...');
  ev = signEvent(succeeded, secret);
  res = await handler.handler({ body: ev.body, headers: ev.headers });
  console.log(res.statusCode, res.body);
})();
