const jwt = require('jsonwebtoken');
const { Shop } = require('../models');

exports.protectShop = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1] : null;
    if (!token) return res.status(401).json({ success: false, message: 'লগইন করুন।' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'shop') return res.status(401).json({ success: false, message: 'Invalid token.' });

    const shop = await Shop.findById(decoded.id);
    if (!shop || !shop.isActive)
      return res.status(401).json({ success: false, message: 'অ্যাকাউন্ট পাওয়া যায়নি।' });

    req.shop   = shop;
    req.shopId = shop._id;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Token expired.' });
  }
};
