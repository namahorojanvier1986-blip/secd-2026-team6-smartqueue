require('dotenv').config();

const config = {
  port: Number(process.env.PORT) || 4000,
  databaseUrl:
    process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/smart_queue',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  timezone: process.env.APP_TIMEZONE || 'Africa/Kigali',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  isProduction: process.env.NODE_ENV === 'production',
};

if (config.isProduction && config.jwtSecret === 'dev-only-secret-change-me') {
  console.warn('[config] WARNING: JWT_SECRET is not set. Set a strong secret in production.');
}

module.exports = config;

