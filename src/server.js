import 'dotenv/config';
import express      from 'express';
import http         from 'http';
import { Server }   from 'socket.io';
import mongoose     from 'mongoose';
import cors         from 'cors';
import helmet       from 'helmet';
import compression  from 'compression';
import morgan       from 'morgan';
import rateLimit    from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import path         from 'path';
import { fileURLToPath } from 'url';

import authRoutes     from './routes/auth.routes.js';
import shopRoutes     from './routes/shop.routes.js';
import customerRoutes from './routes/customer.routes.js';
import adminRoutes    from './routes/admin.routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import logger         from './utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app        = express();
const httpServer = http.createServer(app);

// ── Socket.io ─────────────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET','POST'] },
});
io.on('connection', socket => {
  logger.info(`Socket connected: ${socket.id}`);
  socket.on('disconnect', () => logger.info(`Socket disconnected: ${socket.id}`));
});
app.set('io', io);

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: (origin, cb) => cb(null, true),
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(mongoSanitize());
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));

// Rate limiting
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000, max: 500,
  message: { success: false, message: 'Too many requests. Try again later.' },
}));
app.use('/api/v1/shop/login',    rateLimit({ windowMs: 15*60*1000, max: 10 }));
app.use('/api/v1/auth/login',    rateLimit({ windowMs: 15*60*1000, max: 10 }));
app.use('/api/v1/shop/forgot',   rateLimit({ windowMs: 60*60*1000, max: 5  }));

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/v1/auth',      authRoutes);
app.use('/api/v1/shop',      shopRoutes);
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/admin',     adminRoutes);

// Health check
app.get('/health', (req, res) => res.json({
  status: 'OK', app: 'MiniBazar ERP', version: '3.0.0',
  time: new Date().toISOString(),
}));

// 404
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found.' }));

// Error handler
app.use(errorHandler);

// ── Database + Start ──────────────────────────────────────────────────────────
const startServer = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    logger.info('✅ MongoDB connected');

    const PORT = process.env.PORT || 5000;
    httpServer.listen(PORT, () => {
      logger.info(`🚀 MiniBazar ERP backend running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('❌ DB connection failed:', error.message);
    process.exit(1);
  }
};

startServer();

export default app;
