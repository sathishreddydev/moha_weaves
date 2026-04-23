import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { users } from '../shared/schema';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set');
}

// Create database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, { schema: { users } });

async function createAdmin() {
  const email = process.argv[2] || "admin@moha.com";
  const password = process.argv[3] || "admin123";
  const name = process.argv[4] || "Admin User";

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    await db.insert(users).values({
      email,
      password: hashedPassword,
      name,
      role: "admin",
      isActive: true,
    }).returning();

    console.log(`✅ Admin user created: ${email}`);
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Password: ${password}`);
    process.exit(0);
  } catch (error: any) {
    if (error.message?.includes("unique")) {
      console.error("❌ Admin with this email already exists");
    } else {
      console.error("❌ Failed to create admin:", error.message);
    }
    process.exit(1);
  }
}

createAdmin();
