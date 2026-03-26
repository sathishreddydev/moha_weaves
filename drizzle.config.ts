import { defineConfig } from "drizzle-kit";
import * as dotenv from 'dotenv';

// Load environment variables based on environment
const env = process.env.NODE_ENV || 'development';

let envFile = '.env.development'; // default

switch (env) {
  case 'production':
    dotenv.config();
    break;
  case 'stage':
    envFile = '.env.stage';
    break;
  case 'beta':
    envFile = '.env.beta';
    break;
  case 'prod':
    envFile = '.env.prod';
    break;
  default:
    envFile = '.env.development';
    break;
}

if (env !== 'production') {
  dotenv.config({ path: envFile });
}

if (!process.env.DATABASE_URL) {
  throw new Error(`DATABASE_URL must be set for environment: ${env}`);
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
