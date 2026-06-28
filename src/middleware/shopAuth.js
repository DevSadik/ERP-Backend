import jwt  from 'jsonwebtoken';
import Shop from '../models/Shop.model.js';

export const protectShop = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1] : null;
    if (!token) return res.status(401).json({ success: false, message: 'লগইন করুন।' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'shop')
      return res.status(401).json({ success: false, message: 'Invalid token type.' });

    const shop = await Shop.findById(decoded.id);
    if (!shop || !shop.isActive)
      return res.status(401).json({ success: false, message: 'Shop not found.' });

    req.shop   = shop;
    req.shopId = shop._id;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Token expired or invalid.' });
  }
};
