import { defineConfig } from "drizzle-kit";
import * as dotenv from 'dotenv';

// Normalise NODE_ENV: treat "prod" as "production" for consistency
const rawEnv = process.env.NODE_ENV || 'development';
const env = rawEnv === 'prod' ? 'production' : rawEnv;

// Pick the right env file for each environment.
// In Docker / CI the real vars are injected directly, so dotenv is a no-op.
const envFileMap: Record<string, string> = {
  production: '.env',       // injected by Docker / CI — .env is written at deploy time
  stage:      '.env.stage',
  beta:       '.env.beta',
  development: '.env.development',
};

const envFile = envFileMap[env] ?? '.env.development';

// Only load from file when the DATABASE_URL isn't already in the environment
// (avoids overwriting values injected by Docker Compose or GitHub Actions).
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: envFile });
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    `DATABASE_URL must be set. Tried loading from "${envFile}" for NODE_ENV="${rawEnv}".`
  );
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
