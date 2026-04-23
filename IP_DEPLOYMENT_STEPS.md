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

### **Applications**
- **Next.js Frontend**: `http://103.127.146.58:3000`
- **Admin Panel**: `http://103.127.146.58:5000`
- **API Endpoints**: `http://103.127.146.58:5000/api/*`

### **Architecture Overview**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js App   │    │  Admin App      │    │   PostgreSQL    │
│   (Port 3000)   │    │  (Port 5000)    │    │   (Port 5432)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │     Redis       │
                    │   (Port 6379)   │
                    └─────────────────┘
```

### **Shared Resources**
- **Database**: Both apps use same PostgreSQL database
- **Cache**: Shared Redis instance for sessions and caching
- **API**: Admin panel provides API endpoints for Next.js
- **File Uploads**: Shared upload directory accessible by both apps

## 📋 Management Commands

### **🔍 Check Application Status**
```bash
# Check if containers are running
docker-compose ps

# Check application health
curl http://103.127.146.58:5000/api/health
curl http://103.127.146.58:3000

# View real-time logs
docker-compose logs -f app
docker-compose logs -f nextjs

# Check specific container logs
docker-compose logs app
docker-compose logs nextjs
docker-compose logs postgres
docker-compose logs redis
```

### **⏯️ Start/Stop/Restart Application**
```bash
# Start application
docker-compose up -d

# Stop application
docker-compose down

# Restart application
docker-compose restart

# Restart specific service
docker-compose restart app
docker-compose restart nextjs
docker-compose restart postgres
docker-compose restart redis
```

### **🔄 Update Application with Changes**

#### **⚡ Quick Update (For Code Changes)**
```bash
# Step 1: Pull latest changes
git pull

# Step 2: Restart apps (no rebuild needed)
docker-compose restart app
docker-compose restart nextjs

# Step 3: Verify update
curl http://103.127.146.58:5000
curl http://103.127.146.58:3000
```

#### **🏗️ Full Update (For Dependencies/Config Changes)**
```bash
# Step 1: Pull latest changes
git pull

# Step 2: Build and restart
docker-compose build app
docker-compose build nextjs
docker-compose up -d

# Step 3: Verify update
docker-compose logs app --tail=20
docker-compose logs nextjs --tail=20
curl http://103.127.146.58:5000
curl http://103.127.146.58:3000
```

#### **🔨 Complete Rebuild (For Major Changes)**
```bash
# Step 1: Pull latest changes
git pull

# Step 2: Full rebuild
docker-compose build --no-cache
docker-compose up -d

# Step 3: Verify update
docker-compose logs app --tail=20
docker-compose logs nextjs --tail=20
curl http://103.127.146.58:5000
curl http://103.127.146.58:3000
```

#### **🔄 Update Next.js Only (From Separate Repo)**
```bash
# Step 1: Update Next.js repository
cd ../moha_weaves_nextjs
git pull
cd ../moha_weaves

# Step 2: Build and restart Next.js
docker-compose build nextjs
docker-compose restart nextjs

# Step 3: Verify update
curl http://103.127.146.58:3000
```

#### **📋 When to Use Each Method:**
- **Quick Update**: Code changes, minor fixes
- **Full Update**: New dependencies, package.json changes
- **Complete Rebuild**: Dockerfile changes, major config updates

**💡 Pro Tip**: Start with Quick Update. If issues occur, try Full Update.

### **🗄️ Database Operations**
```bash
# Access database
docker-compose exec postgres psql -U postgres -d moha_weaves

# Create new admin user
docker-compose exec app npm run create-admin

# Database schema update
docker-compose exec app npm run db:push

# Backup database
docker-compose exec postgres pg_dump -U postgres moha_weaves > backup.sql

# Restore database
docker-compose exec -T postgres psql -U postgres -d moha_weaves < backup.sql
```

### **🔧 Troubleshooting**
```bash
# Check container status
docker-compose ps

# View error logs
docker-compose logs app --tail=50

# Force rebuild if issues
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Check disk space
df -h

# Check memory usage
docker stats
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
