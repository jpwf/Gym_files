require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const routes = require('./routes');
const verifyJWT = require('./middleware/verifyJWT');

// Validar variáveis críticas no startup
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('❌ ERRO CRÍTICO: JWT_SECRET não definida no ambiente (.env)');
  process.exit(1);
}

const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && !process.env.ALLOWED_ORIGINS) {
  console.error('❌ ERRO CRÍTICO: ALLOWED_ORIGINS obrigatório em produção');
  process.exit(1);
}

const app = express();

// Security headers - Helmet com CSP
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
}));

app.use(morgan(isProduction ? 'combined' : 'dev'));

// CORS - origins do .env (produção) ou padrão (desenvolvimento)
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [
      'http://localhost:3000',
      'http://localhost:8081',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:8081',
      'exp://localhost:8081',
    ];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // mobile apps, curl
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('CORS: Origin não permitido: ' + origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Global rate limit (applies to all routes)
const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  limit: 100, // 100 requests per window
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente mais tarde.' },
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req.ip)
});
app.use(globalRateLimit);

app.use('/api', routes);

app.get('/', (req, res) => res.json({ message: 'Servidor up' }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
