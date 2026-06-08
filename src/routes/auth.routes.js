import { Router } from 'express';
import jwt    from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User   from '../models/User.model.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

const signToken = (id) => jwt.sign(
  { id },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
);

// ── Register (Admin/Manager/Staff) ───────────────────────────────────────────
// Public only if no admin exists yet. Otherwise requires admin JWT.
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ success: false, message: 'Name, email and password required.' });
    if (password.length < 6)
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });

    // Check if any admin exists
    const adminExists = await User.findOne({ role: 'admin' });

    // If admin exists, only another admin can create users
    if (adminExists) {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token)
        return res.status(403).json({ success: false, message: 'Admin login required to create users.' });
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const requester = await User.findById(decoded.id);
        if (!requester || requester.role !== 'admin')
          return res.status(403).json({ success: false, message: 'Only admin can create new users.' });
      } catch {
        return res.status(401).json({ success: false, message: 'Invalid token.' });
      }
    }

    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists)
      return res.status(409).json({ success: false, message: 'Email already registered.' });

    const user = await User.create({
      name:     name.trim(),
      email:    email.toLowerCase().trim(),
      password,
      role:     role || (adminExists ? 'staff' : 'admin'), // first user = admin
    });

    user.password = undefined;
    const jwtToken = signToken(user._id);

    res.status(201).json({
      success: true,
      message: `✅ User "${user.name}" created as ${user.role}.`,
      data: { token: jwtToken, user },
    });
  } catch (e) { next(e); }
});

// ── Login ─────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password required.' });

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    if (!user.isActive)
      return res.status(403).json({ success: false, message: 'Account is deactivated.' });

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = signToken(user._id);
    user.password = undefined;

    res.json({ success: true, message: 'Login successful.', data: { token, user } });
  } catch (e) { next(e); }
});

// ── Get Me ────────────────────────────────────────────────────────────────────
router.get('/me', protect, (req, res) => {
  res.json({ success: true, data: req.user });
});

// ── Change Password ───────────────────────────────────────────────────────────
router.put('/change-password', protect, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ success: false, message: 'Both passwords required.' });
    if (newPassword.length < 6)
      return res.status(400).json({ success: false, message: 'New password must be 6+ characters.' });

    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.comparePassword(currentPassword)))
      return res.status(401).json({ success: false, message: 'Current password is wrong.' });

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (e) { next(e); }
});

// ── List Users (admin only) ───────────────────────────────────────────────────
router.get('/users', protect, authorize('admin'), async (req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json({ success: true, data: users });
  } catch (e) { next(e); }
});

// ── Update User (admin only) ──────────────────────────────────────────────────
router.put('/users/:id', protect, authorize('admin'), async (req, res, next) => {
  try {
    const allowed = ['name', 'role', 'isActive'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, message: 'User updated.', data: user });
  } catch (e) { next(e); }
});

// ── One-time Admin Setup ──────────────────────────────────────────────────────
// Use this ONLY when no admin exists yet (fresh install)
router.post('/setup-admin', async (req, res, next) => {
  try {
    const { secretKey, name, email, password } = req.body;

    const validKey = process.env.ADMIN_SETUP_KEY || 'minibazar-admin-setup-2026';
    if (secretKey !== validKey)
      return res.status(403).json({ success: false, message: 'Invalid secret key.' });

    if (!name || !email || !password)
      return res.status(400).json({ success: false, message: 'Name, email and password required.' });
    if (password.length < 6)
      return res.status(400).json({ success: false, message: 'Password must be 6+ characters.' });

    const exists = await User.findOne({ role: 'admin' });
    if (exists)
      return res.status(409).json({
        success: false,
        message: 'Admin already exists. Use /api/v1/auth/login instead.',
      });

    const user = await User.create({ name, email, password, role: 'admin' });
    user.password = undefined;
    const token = signToken(user._id);

    res.status(201).json({
      success: true,
      message: '✅ Admin created! This route is now permanently disabled.',
      data: { token, user },
    });
  } catch (e) { next(e); }
});

export default router;

// ── Test Email (admin only — remove after testing) ────────────────────────────
router.post('/test-email', async (req, res, next) => {
  try {
    const { to } = req.body;
    if (!to) return res.status(400).json({ success: false, message: 'Provide "to" email.' });

    const { sendVerificationEmail } = await import('../utils/emailService.js');
    await sendVerificationEmail(to, 'Test User', 'test-token-12345');

    res.json({
      success: true,
      message: `Test email sent to ${to}`,
      config: {
        hasResend: !!process.env.RESEND_API_KEY,
        hasGmail:  !!(process.env.GMAIL_USER && process.env.GMAIL_PASS),
        hasSmtp:   !!process.env.SMTP_HOST,
        frontendUrl: process.env.FRONTEND_URL || 'NOT SET',
      },
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      message: e.message,
      config: {
        hasResend: !!process.env.RESEND_API_KEY,
        hasGmail:  !!(process.env.GMAIL_USER && process.env.GMAIL_PASS),
        hasSmtp:   !!process.env.SMTP_HOST,
        frontendUrl: process.env.FRONTEND_URL || 'NOT SET',
      },
    });
  }
});
