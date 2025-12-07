
import "dotenv/config";
import { db } from "../server/db";
import { users } from "../shared/schema";
import bcrypt from "bcryptjs";

async function createAdmin() {
  const email = process.argv[2] || "admin@moha.com";
  const password = process.argv[3] || "admin123";
  const name = process.argv[4] || "Admin User";

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const [admin] = await db.insert(users).values({
      email,
      password: hashedPassword,
      name,
      role: "admin",
      isActive: true,
    }).returning();

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
