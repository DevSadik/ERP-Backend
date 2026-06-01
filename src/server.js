require('dotenv').config();
const express       = require('express');
const http          = require('http');
const { Server }    = require('socket.io');
const mongoose      = require('mongoose');
const cors          = require('cors');
const helmet        = require('helmet');
const compression   = require('compression');
const morgan        = require('morgan');
const rateLimit     = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const path          = require('path');

const authRoutes          = require('./routes/auth');
const productRoutes       = require('./routes/products');
const supplierRoutes      = require('./routes/suppliers');
const stockInRoutes       = require('./routes/stockIn');
const stockOutRoutes      = require('./routes/stockOut');
const ledgerRoutes        = require('./routes/ledger');
const dashboardRoutes     = require('./routes/dashboard');
const notificationRoutes  = require('./routes/notifications');
const userRoutes          = require('./routes/users');
const brandRoutes         = require('./routes/brand');
const shopRoutes          = require('./routes/shop');
const adminCentralRoutes  = require('./routes/adminCentral');
const { errorHandler }    = require('./middleware/errorHandler');
const logger              = require('./utils/logger');

const app    = express();
const server = http.createServer(app);

// ── Socket.io ──────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || 'http://localhost:3000', methods: ['GET', 'POST'] },
});
app.set('io', io);
io.on('connection', socket => {
  logger.info(`Socket connected: ${socket.id}`);
  socket.on('disconnect', () => logger.info(`Socket disconnected: ${socket.id}`));
});

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(helmet());
app.use(compression());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(mongoSanitize());
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));

app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 500, message: { success: false, message: 'Too many requests.' } }));
app.use('/api/v1/auth/', rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { success: false, message: 'Too many login attempts.' } }));

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/v1/auth',          authRoutes);
app.use('/api/v1/products',      productRoutes);
app.use('/api/v1/suppliers',     supplierRoutes);
app.use('/api/v1/stock-in',      stockInRoutes);
app.use('/api/v1/stock-out',     stockOutRoutes);
app.use('/api/v1/ledger',        ledgerRoutes);
app.use('/api/v1/dashboard',     dashboardRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/users',         userRoutes);
app.use('/api/v1/brand',          brandRoutes);
app.use('/api/v1/shop',           shopRoutes);
app.use('/api/v1/admin',          adminCentralRoutes);

app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date() }));
app.use(errorHandler);

// ── DB + Start ─────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    logger.info('MongoDB connected');
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
  })
  .catch(err => { logger.error(`DB connection failed: ${err.message}`); process.exit(1); });
