/**
 * Environment preload script.
 * This file is imported via tsx --import flag BEFORE the main server module,
 * ensuring DATABASE_URL and other env vars are available when db.ts is first
 * evaluated (ESM hoists static imports, so dotenv must run before the module graph resolves).
 */
import dotenv from "dotenv";

if (!process.env.DATABASE_URL) {
  const envFile =
    process.env.NODE_ENV === "production" ? ".env" : ".env.development";
  dotenv.config({ path: envFile });
}
