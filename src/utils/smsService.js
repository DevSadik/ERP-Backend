import https  from 'https';
import http   from 'http';
import logger from './logger.js';

// ── BulkSMSBD API ─────────────────────────────────────────────────────────────
const sendSMS = (number, message) => new Promise((resolve, reject) => {
  const API_KEY   = process.env.BULKSMS_API_KEY;
  const SENDER_ID = process.env.BULKSMS_SENDER_ID;

  if (!API_KEY || !SENDER_ID) {
    return reject(new Error('BULKSMS_API_KEY or BULKSMS_SENDER_ID missing in .env'));
  }

  // Normalize number → 8801XXXXXXXXX (BulkSMSBD wants this format)
  let num = String(number).replace(/[^0-9]/g, '');
  if (num.startsWith('880'))     { /* ok */ }
  else if (num.startsWith('01')) { num = '88' + num; }
  else if (num.startsWith('1'))  { num = '880' + num; }

  // Build POST body (form-encoded). POST is more reliable than GET for messages.
  const body = new URLSearchParams({
    api_key:  API_KEY,
    type:     'text',
    number:   num,
    senderid: SENDER_ID,
    message:  message,
  }).toString();

  const tryRequest = (lib, port) => {
    const options = {
      hostname: 'bulksmsbd.net',
      port:     port,
      path:     '/api/smsapi',
      method:   'POST',
      headers: {
        'Content-Type':   'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 15000,
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        logger.info('BulkSMSBD raw response: ' + data);
        let parsed = null;
        try { parsed = JSON.parse(data); } catch { /* plain text */ }

        if (parsed && parsed.response_code === 202) {
          logger.info('✅ SMS accepted for ' + num);
          return resolve(parsed);
        }
        if (!parsed && (data.includes('202') || /success/i.test(data))) {
          return resolve({ raw: data });
        }
        const errMsg = parsed
          ? (parsed.error_message || ('code ' + parsed.response_code))
          : data;
        logger.error('❌ BulkSMSBD error: ' + errMsg);
        reject(new Error(errMsg));
      });
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('SMS request timeout')); });
    req.on('error',   (err) => { logger.error('SMS connection error: ' + err.message); reject(err); });
    req.write(body);
    req.end();
  };

  // BulkSMSBD primarily uses http; use https if available
  tryRequest(https, 443);
});

// ── Send OTP ──────────────────────────────────────────────────────────────────
export const sendOtpSMS = async (phone, otp) => {
  // Keep message simple. Some operators block messages with certain words.
  const message = 'Your MiniBazar ERP verification code is ' + otp;
  return await sendSMS(phone, message);
};

export default sendSMS;
