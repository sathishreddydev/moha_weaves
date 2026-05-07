# Redis Cloud Setup Guide

## Overview
This guide covers setting up Redis Cloud for both local development and VPS deployment in the Moha Weaves application.

## Connection Details
- **Redis Cloud URL**: `redis://default:2uzhKQIdCpNkBnLrOSQ2aLnb2czY0DGh@redis-11945.c52.us-east-1-4.ec2.cloud.redislabs.com:11945`
- **Host**: `redis-11945.c52.us-east-1-4.ec2.cloud.redislabs.com`
- **Port**: `11945`
- **Password**: `2uzhKQIdCpNkBnLrOSQ2aLnb2czY0DGh`

## Environment Configuration

### Local Development (.env.development)
```bash
REDIS_URL=redis://default:2uzhKQIdCpNkBnLrOSQ2aLnb2czY0DGh@redis-11945.c52.us-east-1-4.ec2.cloud.redislabs.com:11945
```

### VPS Production (.env.vps)
```bash
REDIS_URL=redis://default:2uzhKQIdCpNkBnLrOSQ2aLnb2czY0DGh@redis-11945.c52.us-east-1-4.ec2.cloud.redislabs.com:11945
```

## Implementation Details

### Redis Configuration (realtime/redis.ts)
- Uses environment variable `REDIS_URL` with fallback to hardcoded connection string
- Configured with retry logic and connection pooling
- Includes connection event handlers for monitoring
- Uses key prefix `moha_weaves:` for namespacing

### Features
- **Connection Management**: Automatic reconnection with retry logic
- **Pub/Sub Support**: Separate publisher and subscriber instances
- **Error Handling**: Comprehensive error logging and monitoring
- **Performance**: Connection pooling and keep-alive settings

## Testing

### Test Connection
Run the test script to verify Redis Cloud connectivity:
```bash
node test-redis-connection.cjs
```

### Expected Output
```
🔍 Testing Redis Cloud connection...
✅ Successfully connected to Redis Cloud
✅ SET/GET test passed: Hello from Moha Weaves!
✅ Subscribed to test_channel
✅ Received message: { channel: 'test_channel', message: 'Test message from Moha Weaves' }
✅ Published test message
✅ Pub/Sub test passed
🎉 Redis Cloud connection test completed
```

## Usage in Application

### Realtime Features
- **Socket.IO Integration**: Redis adapter for multi-server scaling
- **Event Broadcasting**: Real-time updates across all instances
- **Room Management**: User-specific and role-based targeting
- **Message Queuing**: Reliable message delivery

### Event Types
- `user_update` - User profile changes
- `stock_update` - Inventory updates
- `order_update` - Order status changes
- `system_notification` - System-wide notifications

## VPS Deployment

### Docker Integration
Redis Cloud works seamlessly with Docker containers:
- No local Redis instance needed
- External connection through internet
- Automatic failover and high availability

### Security Considerations
- Connection string contains credentials - keep secure
- Use environment variables in production
- Monitor connection logs for unusual activity
- Consider IP whitelisting if supported

### Monitoring
- Connection status logged on startup
- Error events captured and logged
- Performance metrics available through Redis Cloud dashboard

## Troubleshooting

### Common Issues
1. **Connection Timeout**: Check network connectivity and firewall settings
2. **Authentication Failed**: Verify Redis URL and credentials
3. **Memory Limits**: Monitor Redis Cloud memory usage
4. **Rate Limiting**: Check Redis Cloud plan limits

### Debug Commands
```bash
# Test direct connection
redis-cli -u redis://default:2uzhKQIdCpNkBnLrOSQ2aLnb2czY0DGh@redis-11945.c52.us-east-1-4.ec2.cloud.redislabs.com:11945 ping

# Check connection status
node test-redis-connection.cjs
```

## Migration from Local Redis

If migrating from local Redis:
1. Update environment variables
2. Test connectivity with provided script
3. Verify all Redis operations work correctly
4. Monitor performance and adjust timeouts if needed

## Benefits of Redis Cloud
- **High Availability**: Built-in replication and failover
- **Scalability**: Automatic scaling based on usage
- **Performance**: Optimized for low-latency operations
- **Management**: No server maintenance required
- **Monitoring**: Built-in metrics and dashboards
