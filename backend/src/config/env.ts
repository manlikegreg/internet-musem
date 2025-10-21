import dotenv from 'dotenv';

dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT || 5000),
  DATABASE_URL: process.env.DATABASE_URL || '',
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN || '*',
  ADMIN_TOKEN: process.env.ADMIN_TOKEN || ''
};
