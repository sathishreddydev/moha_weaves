# Moha Weaves IP-Based Deployment Steps

## 🚀 Quick IP Deployment (No Domain Required)

### **Step 1: Connect to VPS**
```bash
ssh -p 7576 root@103.127.146.58
```

### **Step 2: Navigate to Project**
```bash
cd /opt/moha_weaves
```

### **Step 3: Update Environment Files**
```bash
# Copy IP-based environment
cp .env.vps .env

# Verify configuration
cat .env
```

### **Step 4: Build and Start Application**
```bash
# Stop any existing containers
docker-compose down

# Build and start
docker-compose build --no-cache
docker-compose up -d

# Check container status
docker-compose ps
```

### **Step 5: Verify Deployment**
```bash
# Check application logs
docker-compose logs -f app

# Test API health
curl http://103.127.146.58:5000/api/health

# Test frontend
curl http://103.127.146.58:5000
```

### **Step 6: Database Setup**
```bash
# Run migrations
docker-compose exec app npm run db:migrate

# Create admin user
docker-compose exec app npm run create-admin
```

## 🌐 Access URLs

### **Admin Panel**
- **URL**: `http://103.127.146.58:5000`
- **API**: `http://103.127.146.58:5000/api/*`

## 📋 Management Commands

```bash
# View logs
docker-compose logs -f app

# Restart application
docker-compose restart

# Update application
git pull
docker-compose build
docker-compose up -d

# Stop application
docker-compose down

# Database access
docker-compose exec postgres psql -U postgres -d moha_weaves

# Backup database
docker-compose exec postgres pg_dump -U postgres moha_weaves > backup.sql
```

## 🔧 Configuration Summary

### **Updated Files**
- `docker-compose.yml` - Port 5000 only (no SSL)
- `.env.vps` - IP-based URLs
- `client/.env.production` - Frontend IP configuration

### **Network Configuration**
- **Application Port**: 5000
- **Database Port**: 5432 (internal)
- **Redis Port**: 6379 (internal)
- **Access IP**: 103.127.146.58

## ⚠️ Important Notes

1. **No SSL**: Using HTTP only (acceptable for private admin use)
2. **Firewall**: Ensure port 5000 is open
3. **Security**: Consider VPN access for additional security
4. **Backup**: Regular database backups recommended

## 🎯 Final Steps

1. Access admin panel at: `http://103.127.146.58:5000`
2. Login with created admin credentials
3. Verify all features are working
4. Set up regular backups

## 🚨 Troubleshooting

```bash
# If containers fail to start
docker-compose logs app

# If port conflicts occur
netstat -tulpn | grep :5000

# Rebuild application
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```
