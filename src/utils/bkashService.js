import https from 'https';

// ── bKash PGW service ─────────────────────────────────────────────────────────
// Credentials come from .env (never hardcode). bKash gives these 4 during
// merchant onboarding: username, password, app_key, app_secret.
// Set BKASH_SANDBOX=true while testing, false for live.

const SANDBOX = process.env.BKASH_SANDBOX === 'true';
const BASE = SANDBOX
  ? 'https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout'
  : 'https://tokenized.pay.bka.sh/v1.2.0-beta/tokenized/checkout';

const CREDS = {
  username:  process.env.BKASH_USERNAME,
  password:  process.env.BKASH_PASSWORD,
  appKey:    process.env.BKASH_APP_KEY,
  appSecret: process.env.BKASH_APP_SECRET,
};

// Simple in-memory token cache (token lives ~1 hour)
let cachedToken = null;
let tokenExpiry = 0;

const postJSON = (url, headers, body) => new Promise((resolve, reject) => {
  const data = JSON.stringify(body);
  const u = new URL(url);
  const req = https.request({
    hostname: u.hostname,
    path: u.pathname + u.search,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', ...headers },
  }, (res) => {
    let chunks = '';
    res.on('data', c => chunks += c);
    res.on('end', () => {
      try { resolve(JSON.parse(chunks)); }
      catch { reject(new Error('bKash invalid response')); }
    });
  });
  req.on('error', reject);
  req.write(data);
  req.end();
});

// 1. Grant Token
export const getToken = async () => {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const res = await postJSON(`${BASE}/token/grant`,
    { username: CREDS.username, password: CREDS.password },
    { app_key: CREDS.appKey, app_secret: CREDS.appSecret });
  if (!res.id_token) throw new Error(res.statusMessage || 'bKash token failed');
  cachedToken = res.id_token;
  tokenExpiry = Date.now() + 50 * 60 * 1000; // 50 min
  return cachedToken;
};

// 2. Create Payment
export const createPayment = async ({ amount, invoice, payerRef, callbackURL }) => {
  const token = await getToken();
  return postJSON(`${BASE}/create`,
    { Authorization: token, 'X-APP-Key': CREDS.appKey },
    {
      mode: '0011',
      payerReference: payerRef || ' ',
      callbackURL,
      amount: String(amount),
      currency: 'BDT',
      intent: 'sale',
      merchantInvoiceNumber: invoice,
    });
};

// 3. Execute Payment (after user finishes on bKash page)
export const executePayment = async (paymentID) => {
  const token = await getToken();
  return postJSON(`${BASE}/execute`,
    { Authorization: token, 'X-APP-Key': CREDS.appKey },
    { paymentID });
};

// 4. Query Payment (verify status server-side)
export const queryPayment = async (paymentID) => {
  const token = await getToken();
  return postJSON(`${BASE}/payment/status`,
    { Authorization: token, 'X-APP-Key': CREDS.appKey },
    { paymentID });
};

export const isConfigured = () =>
  !!(CREDS.username && CREDS.password && CREDS.appKey && CREDS.appSecret);
