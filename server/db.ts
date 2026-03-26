// import { Pool, neonConfig } from '@neondatabase/serverless';
// import { drizzle } from 'drizzle-orm/neon-serverless';
// import ws from "ws";
// import * as schema from "@shared/schema";

// neonConfig.webSocketConstructor = ws;

// if (!process.env.DATABASE_URL) {
//   throw new Error(
//     "DATABASE_URL must be set. Did you forget to provision a database?",
//   );
// }

// export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// export const db = drizzle({ client: pool, schema });


import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '@shared/schema';
import * as dotenv from 'dotenv';

// Load environment variables based on environment
const env = process.env.NODE_ENV || 'development';

let envFile = '.env.development'; // default

switch (env) {
  case 'production':
    // GitHub workflows copy appropriate .env file to .env
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

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
