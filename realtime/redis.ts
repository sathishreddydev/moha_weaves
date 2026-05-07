import Redis from "ioredis"
import { config } from "dotenv"

// Load environment variables to ensure they're available
config({ path: '.env.development' })

// Use environment variable for Redis URL, fallback to Redis Cloud
const redisUrl = process.env.REDIS_URL || "redis://default:2uzhKQIdCpNkBnLrOSQ2aLnb2czY0DGh@redis-11945.c52.us-east-1-4.ec2.cloud.redislabs.com:11945"

// Parse Redis URL to use individual connection parameters
const redisUrlParts = new URL(redisUrl);
const redisConfig = {
  host: redisUrlParts.hostname,
  port: parseInt(redisUrlParts.port) || 6379,
  username: redisUrlParts.username,
  password: redisUrlParts.password,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  keepAlive: 30000,
  family: 4,
  keyPrefix: "moha_weaves:",
}


export const pub = new Redis(redisConfig)

export const sub = new Redis(redisConfig)

// Connection event handlers
pub.on("connect", () => {
  console.log("✅ Redis publisher connected to Redis Cloud")
})

pub.on("error", (err) => {
  console.error("❌ Redis publisher error:", err)
})

sub.on("connect", () => {
  console.log("✅ Redis subscriber connected to Redis Cloud")
})

sub.on("error", (err) => {
  console.error("❌ Redis subscriber error:", err)
})
