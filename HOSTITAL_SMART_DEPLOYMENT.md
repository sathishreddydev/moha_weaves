# HostItSmart VPS Deployment - Moha Weaves

## Server Details
- **Hostname**: vps.sathish.com
- **IP Address**: 103.127.146.58
- **SSH Port**: 7576 (custom port)
- **Username**: root
- **Password**: qoBz09Ok72SLeW4

## Quick Deployment Steps

### 1. Connect to VPS
```bash
ssh -p 7576 root@103.127.146.58
```

### 2. Upload and Run Deployment Script
```bash
# Upload deployment files (from your local machine)
scp -P 7576 deploy.sh root@103.127.146.58:/root/
scp -P 7576 docker-compose.prod.yml root@103.127.146.58:/root/
scp -P 7576 Dockerfile root@103.127.146.58:/root/
scp -P 7576 -r nginx root@103.127.146.58:/root/

# On VPS - make script executable and run
chmod +x deploy.sh
./deploy.sh
```

### 3. Update Environment Variables
After the script runs, edit the production environment file:
```bash
nano /opt/moha-weaves/.env.prod
```

Update with your actual values:
```env
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

### 4. Restart Services
```bash
cd /opt/moha-weaves
docker-compose -f docker-compose.prod.yml restart
```

## Application URLs

After deployment, your application will be accessible at:
- **Main Site**: https://vps.sathish.com
- **API**: https://vps.sathish.com/api
- **Health Check**: https://vps.sathish.com/health

## SSL Certificate Setup

### Option A: Let's Encrypt (Recommended)
```bash
# Install certbot if not already installed
apt install certbot python3-certbot-nginx

# Get SSL certificate
certbot --nginx -d vps.sathish.com --non-interactive --agree-tos --email admin@sathish.com
```

### Option B: Self-Signed (For Testing)
```bash
# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /opt/moha-weaves/nginx/ssl/key.pem \
    -out /opt/moha-weaves/nginx/ssl/cert.pem \
    -subj "/C=IN/ST=State/L=City/O=MohaWeaves/CN=vps.sathish.com"
```

## Firewall Configuration

The deployment script will automatically configure UFW firewall with:
- SSH (port 7576) - Custom SSH port
- HTTP (port 80)
- HTTPS (port 443)

## Service Management

### Check Service Status
```bash
cd /opt/moha-weaves
docker-compose -f docker-compose.prod.yml ps
```

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

## Database Management

### Backup Database
```bash
docker exec moha_weaves_postgres pg_dump -U postgres moha_weaves > backup.sql
```

### Restore Database
```bash
docker exec -i moha_weaves_postgres psql -U postgres moha_weaves < backup.sql
```

### Access Database
```bash
docker exec -it moha_weaves_postgres psql -U postgres moha_weaves
```

## Monitoring

### Health Checks
- Application health: https://vps.sathish.com/health
- Container status: `docker ps`
- Resource usage: `docker stats`

### Logs Location
- Application logs: `docker-compose logs`
- Nginx logs: `/var/log/nginx/`
- System logs: `/var/log/syslog`

## Security Notes

1. **Custom SSH Port**: Your SSH runs on port 7576 instead of default 22
2. **Strong Password**: Change the default password after first login
3. **Firewall**: UFW is enabled with required ports only
4. **SSL**: Configure SSL certificate for HTTPS
5. **Regular Updates**: Keep system and Docker images updated

## Troubleshooting

### Cannot Connect via SSH
```bash
ssh -p 7576 root@103.127.146.58
```

### Services Not Starting
```bash
cd /opt/moha-weaves
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d
```

### SSL Certificate Issues
```bash
# Check certificate
openssl x509 -in /opt/moha-weaves/nginx/ssl/cert.pem -text -noout

# Renew Let's Encrypt
certbot renew
```

### Database Connection Issues
```bash
# Check PostgreSQL container
docker exec -it moha_weaves_postgres psql -U postgres -l

# Restart database
docker-compose -f docker-compose.prod.yml restart postgres
```

## Automatic Backups

The deployment script sets up automatic daily backups at 2 AM:
- Database backups stored in `/opt/backups/`
- Application configuration backups
- 7-day retention policy

## Performance Optimization

For production use, consider:
1. **Enable swap file** if memory is limited
2. **Configure log rotation** to prevent disk space issues
3. **Monitor resource usage** with `htop` and `docker stats`
4. **Set up monitoring** alerts for critical services

## Support

For deployment issues:
1. Check logs: `docker-compose -f docker-compose.prod.yml logs`
2. Verify environment variables in `/opt/moha-weaves/.env.prod`
3. Ensure all ports are accessible (7576, 80, 443)
4. Check firewall rules: `ufw status`

## Domain Configuration

If you want to use a custom domain instead of vps.sathish.com:
1. Update DNS A record to point to 103.127.146.58
2. Update client/.env.production with new domain
3. Rebuild and redeploy application
4. Update SSL certificate for new domain
