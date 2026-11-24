import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import dotenv from 'dotenv';
import connectDB from './config/db.js';

// Route imports
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import roleRoutes from './routes/roleRoutes.js';
import permissionRoutes from './routes/permissionRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import setupRoutes from './routes/setupRoutes.js';
import deviceRoutes from './routes/deviceRoutes.js';
import abacPolicyRoutes from './routes/abacPolicyRoutes.js';
import securityOperationsRoutes from './routes/securityOperationsRoutes.js';

// Load environment variables
dotenv.config();

// FATAL CHECK: Enforce strong JWT secret on server boot
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.trim().length < 32) {
  console.error('\n====================================================================');
  console.error('[FATAL CONFIGURATION ERROR]: JWT_SECRET is missing or insecure!');
  console.error('SecureGate requires a cryptographically strong secret of at least 32 characters.');
  console.error('Please configure JWT_SECRET in server/.env before starting the server.');
  console.error('====================================================================\n');
  process.exit(1);
}

const app = express();
const trustProxyHops = Number.parseInt(process.env.TRUST_PROXY_HOPS || '0', 10);
if (Number.isInteger(trustProxyHops) && trustProxyHops > 0) {
  app.set('trust proxy', trustProxyHops);
}

// Database Connection
connectDB();

// 1. Helmet Security Headers
app.use(
  helmet({
    contentSecurityPolicy: false, // Allows flexible client dev integration while securing headers
    crossOriginEmbedderPolicy: false,
  })
);

// 2. Strict CORS Configuration
const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin server requests)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Blocked by CORS policy: Origin ${origin} is not allowed.`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-SecureGate-Device'],
  })
);

// 3. Rate Limiting Protection
// General API Rate Limiter
const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Max 300 requests per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP address. Please try again after 15 minutes.',
  },
});

// Strict Auth Route Limiter (Brute-force protection on Login/Register)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  // Keep production strict. The security test suite deliberately exercises
  // multiple independent login flows from one test IP in a single run.
  max: process.env.NODE_ENV === 'test' ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP. Rate limit exceeded. Try again in 15 minutes.',
  },
});

app.use('/api', generalApiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/invitations/accept', authLimiter);
app.use('/api/auth/register', authLimiter);

// 4. Request Body Parsers with Safe Size Limits (DoS / Memory exhaustion protection)
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Health Check API
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'SecureGate IAM Engine',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// NOTE: Public database seeding route POST /api/seed HAS BEEN PERMANENTLY REMOVED
// for security. Seeding is strictly restricted to developer CLI execution (`npm run seed`).

// API Routes
app.use('/api/setup', setupRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/abac-policies', abacPolicyRoutes);
app.use('/api/security', securityOperationsRoutes);

// 404 Handler for undefined routes
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `API endpoint not found: [${req.method}] ${req.originalUrl}`,
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  if (err.message && err.message.includes('CORS policy')) {
    return res.status(403).json({
      success: false,
      message: err.message,
    });
  }

  console.error('[Global Server Error]:', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
});

const PORT = process.env.PORT || 5000;

// Listen if executed directly or if not in test import
let server;
const isTestEnv = process.env.NODE_ENV === 'test' || process.argv[1]?.includes('test');
if (!isTestEnv) {
  server = app.listen(PORT, () => {
    console.log(`[SecureGate Server] Running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    console.log(`[SecureGate Server] API Base: http://localhost:${PORT}/api`);
  });
}

export { server };
export default app;
