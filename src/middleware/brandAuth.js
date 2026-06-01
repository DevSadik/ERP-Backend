const jwt   = require('jsonwebtoken');
const { Brand } = require('../models');

exports.protectBrand = async (req, res, next) => {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.split(' ')[1] : null;
  if (!token) return res.status(401).json({ success: false, message: 'লগইন করুন।' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'brand') return res.status(401).json({ success: false, message: 'Invalid token type.' });
    const brand = await Brand.findById(decoded.id);
    if (!brand || brand.status !== 'approved')
      return res.status(401).json({ success: false, message: 'অ্যাকাউন্ট অনুমোদিত নয়।' });
    req.brand = brand;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Token expired or invalid.' });
  }
};
