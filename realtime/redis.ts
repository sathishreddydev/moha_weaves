import Redis from "ioredis"

if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL environment variable is required. Please set it in your environment.");
}

const redisUrl = process.env.REDIS_URL;

// Parse Redis URL to use individual connection parameters
const redisUrlParts = new URL(redisUrl);
const redisConfig = {
  host: redisUrlParts.hostname,
  port: parseInt(redisUrlParts.port) || 6379,
  username: redisUrlParts.username || undefined,
  password: redisUrlParts.password || undefined,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  keepAlive: 30000,
  family: 4,
  // NOTE: keyPrefix is intentionally removed — it breaks pub/sub channel names
}


export const pub = new Redis(redisConfig)

export const sub = new Redis(redisConfig)

// Connection event handlers
pub.on("connect", () => {
  console.log("✅ Redis publisher connected")
})

pub.on("error", (err) => {
  console.error("❌ Redis publisher error:", err.message)
})

sub.on("connect", () => {
  console.log("✅ Redis subscriber connected")
})

sub.on("error", (err) => {
  console.error("❌ Redis subscriber error:", err.message)
})
