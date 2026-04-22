# Moha Weaves - HostItSmart VPS Deployment Guide

This guide provides step-by-step instructions for deploying Moha Weaves on HostItSmart VPS.

## Prerequisites

- HostItSmart VPS with Ubuntu 20.04 or higher
- At least 2GB RAM, 2 CPU cores, 20GB storage
- Domain name (optional, for SSL)
- SSH access to VPS with sudo privileges

## Quick Deployment (Recommended)

1. **Connect to your VPS:**
   ```bash
   ssh root@your-vps-ip
   ```

2. **Download and run deployment script:**
   ```bash
   wget https://raw.githubusercontent.com/yourusername/moha-weaves/main/deploy.sh
   chmod +x deploy.sh
   ./deploy.sh
   ```

3. **Update environment variables:**
   Edit `/opt/moha-weaves/.env` with your actual values

4. **Restart services:**
   ```bash
   cd /opt/moha-weaves
   docker-compose -f docker-compose.prod.yml restart
   ```

## Manual Deployment Steps

### 1. System Setup

```bash
# Update system
apt update && apt upgrade -y

# Install required packages
apt install -y git curl wget nginx certbot python3-certbot-nginx
```

### 2. Docker Installation

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
```

### 3. Application Setup

```bash
# Create application directory
mkdir -p /opt/moha-weaves
cd /opt/moha-weaves

# Clone repository
git clone https://github.com/yourusername/moha-weaves.git .

# Create uploads directory
mkdir -p uploads nginx/ssl
```

### 4. Environment Configuration

Create `.env` file with your production values:

```bash
# Database Configuration
POSTGRES_DB=moha_weaves
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password_here

# Redis Configuration
REDIS_PASSWORD=your_redis_password_here

# Application Secrets
SESSION_SECRET=your_session_secret_here
JWT_SECRET=your_jwt_secret_here

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# Razorpay Configuration
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret

# Email Configuration
SMTP_HOST=your_smtp_host
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
EMAIL_FROM_EMAIL=your_email@example.com

# Delhivery Configuration
DELHIVERY_CLIENT_ID=your_delhivery_client_id
DELHIVERY_API_TOKEN=your_delhivery_api_token
DELHIVERY_PICKUP_WAREHOUSE=your_warehouse_code
```

### 5. SSL Certificate Setup

**Option A: Let's Encrypt (Recommended)**
```bash
# Replace your-domain.com with your actual domain
certbot --nginx -d your-domain.com --non-interactive --agree-tos --email admin@your-domain.com
```

**Option B: Self-Signed Certificate**
```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout nginx/ssl/key.pem \
    -out nginx/ssl/cert.pem \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=your-domain.com"
```

### 6. Application Deployment

```bash
# Build and start services
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d

# Check service status
docker-compose -f docker-compose.prod.yml ps
```

### 7. Firewall Configuration

```bash
# Configure UFW firewall
ufw allow ssh
ufw allow 80
ufw allow 443
ufw --force enable
```

## Service Management

### View Logs
```bash
cd /opt/moha-weaves
docker-compose -f docker-compose.prod.yml logs -f
```

### Restart Services
```bash
cd /opt/moha-weaves
docker-compose -f docker-compose.prod.yml restart
```

### Update Application
```bash
cd /opt/moha-weaves
git pull origin main
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
```

### Database Backup
```bash
docker exec moha_weaves_postgres pg_dump -U postgres moha_weaves > backup.sql
```

### Database Restore
```bash
docker exec -i moha_weaves_postgres psql -U postgres moha_weaves < backup.sql
```

## Monitoring and Maintenance

### Health Checks
- Application health: `http://your-vps-ip/health`
- Nginx status: `systemctl status nginx`
- Docker status: `docker ps`

### Automatic Backups
The deployment script sets up automatic daily backups at 2 AM. Backup files are stored in `/opt/backups`.

### Log Locations
- Application logs: `docker-compose logs`
- Nginx logs: `/var/log/nginx/`
- System logs: `/var/log/syslog`

## Security Recommendations

1. **Regular Updates:** Keep your system and Docker images updated
2. **Strong Passwords:** Use strong, unique passwords for all services
3. **SSH Keys:** Use SSH key authentication instead of passwords
4. **Fail2Ban:** Install fail2ban to prevent brute force attacks
5. **Regular Backups:** Ensure backups are working and test restores

## Troubleshooting

### Common Issues

**Application won't start:**
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs

# Check environment variables
cat /opt/moha-weaves/.env
```

**Database connection failed:**
```bash
# Check PostgreSQL container
docker exec -it moha_weaves_postgres psql -U postgres -l

# Restart database
docker-compose -f docker-compose.prod.yml restart postgres
```

**Nginx configuration error:**
```bash
# Test Nginx configuration
nginx -t

# Reload Nginx
nginx -s reload
```

**SSL certificate issues:**
```bash
# Check certificate expiry
openssl x509 -in /opt/moha-weaves/nginx/ssl/cert.pem -text -noout

# Renew Let's Encrypt certificate
certbot renew
```

### Performance Optimization

1. **Enable Docker Swarm** for high availability
2. **Configure Redis clustering** for better session management
3. **Use CDN** for static assets
4. **Enable database connection pooling**
5. **Monitor resource usage** with tools like htop, docker stats

## Support

For deployment issues:
1. Check the logs: `docker-compose -f docker-compose.prod.yml logs`
2. Verify environment variables in `.env` file
3. Ensure all ports are open and accessible
4. Check firewall and security group settings

## Application URLs

After deployment, your application will be accessible at:
- **HTTP:** `http://your-vps-ip`
- **HTTPS:** `https://your-vps-ip` (if SSL configured)
- **API:** `http://your-vps-ip/api`
- **Health Check:** `http://your-vps-ip/health`

## File Structure

```
/opt/moha-weaves/
  Dockerfile
  docker-compose.prod.yml
  nginx/
    nginx.conf
    ssl/
  uploads/
  .env
  server/
  client/
  shared/
```

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `POSTGRES_DB` | Database name | Yes |
| `POSTGRES_USER` | Database user | Yes |
| `POSTGRES_PASSWORD` | Database password | Yes |
| `REDIS_PASSWORD` | Redis password | Yes |
| `SESSION_SECRET` | Session encryption key | Yes |
| `JWT_SECRET` | JWT signing key | Yes |
| `CLOUDINARY_*` | Cloudinary credentials | Yes |
| `RAZORPAY_*` | Razorpay payment credentials | Yes |
| `SMTP_*` | Email configuration | Optional |
| `DELHIVERY_*` | Shipping integration | Optional |
