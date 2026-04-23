# Moha Weaves VPS Deployment Guide

## Overview
This guide covers deploying the Moha Weaves e-commerce application to your VPS at `vps.sathish.com` (IP: 103.127.146.58).

## VPS Details
- **Hostname**: vps.sathish.com
- **Main IP**: 103.127.146.58
- **SSH Port**: 7576
- **Username**: root (Linux)
- **Password**: qoBz09Ok72SLeW4

## Architecture
The application uses Docker containers with:
- **Frontend**: React app served by Nginx
- **Backend**: Node.js/Express API server
- **Database**: PostgreSQL 15
- **Cache**: Redis 7
- **SSL**: Let's Encrypt certificates

## Files Created
- `Dockerfile.backend` - Backend container build
- `Dockerfile.frontend` - Frontend container build
- `docker-compose.yml` - Multi-container orchestration
- `nginx/nginx.conf` - Nginx reverse proxy configuration
- `.env.vps` - VPS-specific environment variables
- `deploy.sh` - Automated deployment script

## Quick Deployment

### 1. Make Deploy Script Executable
```bash
chmod +x deploy.sh
```

### 2. Run Automated Deployment
```bash
./deploy.sh
```

This script will:
- Setup Docker and required services on VPS
- Deploy the application
- Configure SSL certificates
- Perform health checks

## Manual Deployment Steps

### 1. Connect to VPS
```bash
ssh -p 7576 root@103.127.146.58
```

### 2. Install Docker & Docker Compose
```bash
# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
usermod -aG docker $USER
systemctl enable docker
systemctl start docker

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install additional utilities
apt install -y git nginx certbot python3-certbot-nginx
```

### 3. Setup Project Directory
```bash
mkdir -p /opt/moha_weaves
cd /opt/moha_weaves
```

### 4. Copy Application Files
```bash
# From your local machine
scp -P 7576 -r . root@103.127.146.58:/opt/moha_weaves/
```

### 5. Configure Environment
```bash
# On VPS
cd /opt/moha_weaves
cp .env.vps .env
```

### 6. Build and Start Containers
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### 7. Setup SSL Certificates
```bash
# Stop frontend to free port 80
docker-compose stop frontend

# Get SSL certificate
certbot certonly --standalone \
    --email sathishreddy.k0337@gmail.com \
    --agree-tos \
    --no-eff-email \
    -d vps.sathish.com \
    -d admin.vps.sathish.com

# Copy certificates
mkdir -p nginx/ssl
cp /etc/letsencrypt/live/vps.sathish.com/fullchain.pem nginx/ssl/cert.pem
cp /etc/letsencrypt/live/vps.sathish.com/privkey.pem nginx/ssl/key.pem

# Setup auto-renewal
echo "0 12 * * * /usr/bin/certbot renew --quiet && docker-compose restart frontend" | crontab -

# Restart frontend
docker-compose start frontend
```

## Environment Configuration

### Frontend (.env.production)
```env
VITE_API_URL=https://vps.sathish.com
VITE_IMAGE_URL=https://vps.sathish.com/uploads
```

### Backend (.env.vps)
Key configurations for VPS deployment:
- Database: PostgreSQL on Docker network
- Redis: Redis on Docker network
- SSL: Enabled with Let's Encrypt
- Domain: vps.sathish.com

## Service Management

### View Logs
```bash
docker-compose logs -f
```

### Restart Services
```bash
docker-compose restart
```

### Update Application
```bash
git pull
docker-compose build
docker-compose up -d
```

### Database Management
```bash
# Access database
docker-compose exec postgres psql -U postgres -d moha_weaves

# Run migrations
docker-compose exec backend npm run db:migrate
```

## Security Configuration

### Firewall Rules
```bash
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable
```

### SSL Configuration
- Automatic certificate renewal via cron
- HSTS headers enabled
- Modern TLS protocols only

## Monitoring

### Health Checks
```bash
# Backend health
curl -k https://vps.sathish.com/api/health

# Frontend health
curl -k https://vps.sathish.com
```

### Container Status
```bash
docker-compose ps
```

### Resource Usage
```bash
docker stats
```

## Troubleshooting

### Common Issues

1. **Container won't start**
   ```bash
   docker-compose logs <service-name>
   ```

2. **Database connection failed**
   - Check DATABASE_URL in .env
   - Verify postgres container is running

3. **SSL certificate issues**
   ```bash
   certbot renew --dry-run
   ```

4. **Nginx configuration errors**
   ```bash
   docker-compose exec frontend nginx -t
   ```

## Performance Optimization

### Database
- PostgreSQL tuned for production
- Connection pooling enabled

### Frontend
- Gzip compression enabled
- Static asset caching
- CDN-ready configuration

### Backend
- Redis caching for sessions
- Rate limiting on API endpoints

## Backup Strategy

### Database Backup
```bash
# Create backup
docker-compose exec postgres pg_dump -U postgres moha_weaves > backup.sql

# Restore backup
docker-compose exec -T postgres psql -U postgres moha_weaves < backup.sql
```

### File Backup
```bash
# Backup uploads
tar -czf uploads_backup.tar.gz uploads/
```

## URLs After Deployment
- **Main Site**: https://vps.sathish.com
- **Admin Panel**: https://admin.vps.sathish.com
- **API**: https://vps.sathish.com/api

## Support
For deployment issues:
1. Check container logs
2. Verify network connectivity
3. Confirm SSL certificates are valid
4. Check firewall settings

## Next Steps
1. Run the deployment script
2. Verify all services are running
3. Test SSL certificates
4. Perform smoke testing of key features
5. Set up monitoring and alerts
