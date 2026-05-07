const Redis = require("ioredis");

const redisUrl = "redis://default:2uzhKQIdCpNkBnLrOSQ2aLnb2czY0DGh@redis-11945.c52.us-east-1-4.ec2.cloud.redislabs.com:11945";

async function testRedisConnection() {
  console.log("🔍 Testing Redis Cloud connection...");
  
  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
  });

  try {
    await redis.connect();
    console.log("✅ Successfully connected to Redis Cloud");

    // Test basic operations
    await redis.set("test_key", "Hello from Moha Weaves!", "EX", 60);
    const value = await redis.get("test_key");
    console.log("✅ SET/GET test passed:", value);

    // Test pub/sub
    const pub = new Redis(redisUrl);
    const sub = new Redis(redisUrl);
    
    let messageReceived = false;
    
    sub.subscribe("test_channel", (err, count) => {
      if (err) {
        console.error("❌ Subscribe error:", err);
        return;
      }
      console.log("✅ Subscribed to test_channel");
    });

    sub.on("message", (channel, message) => {
      console.log("✅ Received message:", { channel, message });
      messageReceived = true;
    });

    setTimeout(async () => {
      await pub.publish("test_channel", "Test message from Moha Weaves");
      console.log("✅ Published test message");
    }, 1000);

    // Wait for message
    setTimeout(async () => {
      if (messageReceived) {
        console.log("✅ Pub/Sub test passed");
      } else {
        console.log("❌ Pub/Sub test failed - no message received");
      }
      
      // Cleanup
      await redis.del("test_key");
      await pub.quit();
      await sub.quit();
      await redis.quit();
      
      console.log("🎉 Redis Cloud connection test completed");
      process.exit(0);
    }, 3000);

  } catch (error) {
    console.error("❌ Redis connection failed:", error.message);
    process.exit(1);
  }
}

testRedisConnection();
