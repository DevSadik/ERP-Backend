import 'dotenv/config';
import express        from 'express';
import http           from 'http';
import { Server }     from 'socket.io';
import mongoose       from 'mongoose';
import cors           from 'cors';
import helmet         from 'helmet';
import compression    from 'compression';
import morgan         from 'morgan';
import rateLimit      from 'express-rate-limit';
import mongoSanitize  from 'express-mongo-sanitize';
import path           from 'path';
import { fileURLToPath } from 'url';

import authRoutes     from './routes/auth.routes.js';
import shopRoutes     from './routes/shop.routes.js';
import customerRoutes from './routes/customer.routes.js';
import adminRoutes    from './routes/admin.routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import logger         from './utils/logger.js';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const app        = express();
const httpServer = http.createServer(app);

// ── Trust proxy (required for Render, Heroku, Nginx) ─────────────────────────
// Without this, express-rate-limit throws X-Forwarded-For error in production
app.set('trust proxy', 1);

// ── Socket.io ─────────────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});
io.on('connection', socket => {
  logger.info(`Socket connected: ${socket.id}`);
  socket.on('disconnect', () => logger.info(`Socket disconnected: ${socket.id}`));
});
app.set('io', io);

// ── Security middleware ────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow image uploads
}));
app.use(compression());
app.use(mongoSanitize()); // prevent NoSQL injection

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map(o => o.trim())
  : ['http://localhost:3000'];

app.use(cors({
  origin: (origin, cb) => {
    // Allow all in development, or if CLIENT_URL=*
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return cb(null, true);
    }
    cb(null, true); // allow all for now (tighten later)
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Body parser ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Overload protection ───────────────────────────────────────────────────────
// If the event loop lag gets too high (server overwhelmed by requests),
// reject new requests with 503 instead of crashing. This keeps the process
// alive and responsive under sudden traffic spikes.
let lastLag = 0;
setInterval(() => {
  const start = Date.now();
  setImmediate(() => { lastLag = Date.now() - start; });
}, 500);

app.use((req, res, next) => {
  // Always allow health check through
  if (req.path === '/health') return next();
  // If event loop lag > 1 second, server is overloaded
  if (lastLag > 1000) {
    return res.status(503).json({
      success: false,
      message: 'Server is busy. Please try again in a moment.',
    });
  }
  next();
});

// ── Request logger ────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));
}

// ── Rate limiting ─────────────────────────────────────────────────────────────
const createLimiter = (max, windowMinutes = 15) => rateLimit({
  windowMs:    windowMinutes * 60 * 1000,
  max,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

app.use('/api/',                     createLimiter(500, 15)); // general
app.use('/api/v1/shop/login',        createLimiter(10,  15)); // login brute force
app.use('/api/v1/auth/login',        createLimiter(10,  15)); // admin login
app.use('/api/v1/shop/register',     createLimiter(5,   60)); // registration
app.use('/api/v1/shop/forgot-password', createLimiter(5, 60)); // forgot password

// ── Static files ──────────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/v1/auth',      authRoutes);
app.use('/api/v1/shop',      shopRoutes);
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/admin',     adminRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status:   'OK',
    app:      'Mini Manager ERP',
    version:  '3.0.0',
    env:      process.env.NODE_ENV || 'development',
    time:     new Date().toISOString(),
    email: {
      resend: !!process.env.RESEND_API_KEY,
      gmail:  !!(process.env.GMAIL_USER && process.env.GMAIL_PASS),
      smtp:   !!process.env.SMTP_HOST,
    },
  });
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.path}` });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use(errorHandler);

// ── Connect DB + Start server ─────────────────────────────────────────────────
const startServer = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: process.env.DB_NAME || 'ERP',
      serverSelectionTimeoutMS: 10000,
    });
    logger.info('✅ MongoDB connected');

    const PORT = process.env.PORT || 5000;
    httpServer.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Mini Manager ERP running on port ${PORT}`);
      logger.info(`📧 Email: Resend=${!!process.env.RESEND_API_KEY} Gmail=${!!process.env.GMAIL_USER}`);
      logger.info(`🌐 Frontend: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
    });
  } catch (error) {
    logger.error('❌ Startup failed:', error.message);
    process.exit(1);
  }
};

startServer();

// ── Crash protection ──────────────────────────────────────────────────────────
// Log errors instead of letting the whole process die silently.
// On fatal errors, exit cleanly so the process manager (PM2/Render) restarts it.

// Unhandled promise rejection — log but keep running
process.on('unhandledRejection', (reason) => {
  logger.error('⚠️ Unhandled Rejection: ' + (reason?.message || reason));
  // Do NOT exit — keep server alive for other requests
});

// Uncaught exception — log, then exit so the manager restarts a fresh process
process.on('uncaughtException', (err) => {
  logger.error('💥 Uncaught Exception: ' + err.message);
  logger.error(err.stack);
  // Give logger a moment, then exit (PM2/Render will auto-restart)
  setTimeout(() => process.exit(1), 1000);
});

// Graceful shutdown on termination signals
const shutdown = (signal) => {
  logger.info(`${signal} received — shutting down gracefully…`);
  httpServer.close(() => {
    logger.info('HTTP server closed.');
    mongoose.connection.close(false).then(() => {
      logger.info('MongoDB connection closed.');
      process.exit(0);
    });
  });
  // Force exit if cleanup hangs
  setTimeout(() => process.exit(1), 10000);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

export default app;
