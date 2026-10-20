require('dotenv').config();
const Sentry = require('./instrument');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const routes = require('./routes');
const { pool, ensureSchema } = require('./db');
const { migrate } = require('./migrate');
const { seed } = require('./seed');

const app = express();
const port = Number(process.env.PORT || 5001);
const defaultOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:3003',
  'http://127.0.0.1:3003',
  'https://alkes-pos.vercel.app',
  'https://alkes-web-fawn.vercel.app',
];
const origins = [...defaultOrigins, ...(process.env.CORS_ORIGINS || '').split(',')]
  .map((origin) => origin.trim())
  .filter(Boolean);

if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: origins, credentials: true }));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '256kb' }));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.API_RATE_LIMIT || 600),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { status: 0, message: 'Terlalu banyak request. Silakan coba beberapa saat lagi.' },
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.LOGIN_RATE_LIMIT || 10),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { status: 0, message: 'Terlalu banyak percobaan login. Coba kembali dalam 15 menit.' },
});
app.use(globalLimiter);
app.use('/login', loginLimiter);

function redactSensitive(value) {
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      if (['password', 'token', 'secret', 'authorization'].includes(key.toLowerCase())) {
        return [key, '[REDACTED]'];
      }
      return [key, entry];
    })
  );
}

app.use((req, _res, next) => {
  console.log(JSON.stringify({
    time: new Date().toISOString(),
    method: req.method,
    path: req.path,
    query: req.query,
    body: redactSensitive(req.body),
  }));
  next();
});

app.use(routes);

app.use((req, res) => {
  res.status(404).json({ status: 0, message: `Endpoint ${req.method} ${req.path} tidak ditemukan` });
});

if (process.env.SENTRY_DSN) Sentry.setupExpressErrorHandler(app);

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error?.type === 'entity.too.large') return res.status(413).json({ status: 0, message: 'Ukuran request terlalu besar' });
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) return res.status(400).json({ status: 0, message: 'Format JSON tidak valid' });
  if (error?.statusCode && error.statusCode < 500) return res.status(error.statusCode).json({ status: 0, message: error.message });
  if (error?.code === '23505') return res.status(409).json({ status: 0, message: 'Data sudah digunakan. Gunakan nomor atau kode lain.' });
  return res.status(500).json({ status: 0, message: process.env.NODE_ENV === 'production' ? 'Internal server error' : (error.message || 'Internal server error') });
});

let server;

const shouldBootstrapDatabase = !process.env.VERCEL || process.env.RUN_DB_BOOTSTRAP === 'true';
const databaseReady = shouldBootstrapDatabase
  ? Promise.resolve()
    .then(() => migrate())
    .then(() => seed())
    .then(() => ensureSchema())
  : Promise.resolve();

if (process.env.VERCEL) {
  module.exports = async function handler(req, res) {
    await databaseReady;
    return app(req, res);
  };
} else {
  databaseReady
    .then(() => {
      server = app.listen(port, '0.0.0.0', () => {
        console.log('ONPOS Node backend running on http://localhost:' + port);
      });
    })
    .catch((error) => {
      console.error('Failed to bootstrap database', error);
      process.exit(1);
    });

  function shutdown() {
    if (!server) {
      pool.end().finally(() => process.exit(0));
      return;
    }
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}