# Moha Weaves VPS Deployment Steps

## Step 1: Connect to VPS and Install Docker

```bash
# Connect to your VPS
ssh -p 7576 root@103.127.146.58

# Update system packages
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

# Install additional utilities needed
apt install -y git nginx certbot python3-certbot-nginx

# Setup firewall
ufw allow 22/tcp    # SSH port 7576
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable
```

## Step 2: Create Project Directory and Pull Code

```bash
# Create project directory
mkdir -p /opt/moha_weaves
cd /opt/moha_weaves

# If you have git repository set up:
git clone <your-repository-url> .

# If not, you can upload files manually using scp from your local machine:
# From your local machine:
# scp -P 7576 -r . root@103.127.146.58:/opt/moha_weaves/
```

## Step 3: Setup Environment Configuration

```bash
# Copy VPS environment file
cp .env.vps .env

# Verify environment variables are correct
cat .env
```

## Step 4: Build and Start Docker Containers

```bash
# Stop any existing containers
docker-compose down

# Build containers (no cache for fresh build)
docker-compose build --no-cache

# Start all services in detached mode
docker-compose up -d

# Check container status
docker-compose ps

# View logs to check for any issues
docker-compose logs -f
```

## Step 5: Verify Deployment

```bash
# Check all containers are running
docker-compose ps

# Test application health
curl http://103.127.146.58:5000/api/health

# Test frontend
curl http://103.127.146.58:5000

# Check logs for any errors
docker-compose logs app
```

## Step 7: Final Setup and Verification

```bash
# Run database migrations (if needed)
docker-compose exec app npm run db:migrate

# Create admin user (if needed)
docker-compose exec app npm run create-admin

# Test the application in browser:
# - Admin Panel: https://admin.vps.sathish.com
```

## Quick One-Command Deployment (Alternative)

If you want to use the automated script:

```bash
# From your local machine:
chmod +x deploy.sh
./deploy.sh
```

This script will perform all the above steps automatically.

## Common Commands for Management

```bash
# View logs
docker-compose logs -f app

# Restart services
docker-compose restart

# Update application
git pull
docker-compose build
docker-compose up -d

# Stop all services
docker-compose down

# Database access
docker-compose exec postgres psql -U postgres -d moha_weaves

# Backup database
docker-compose exec postgres pg_dump -U postgres moha_weaves > backup.sql
```

## Troubleshooting

If containers fail to start:
```bash
# Check logs
docker-compose logs app

# Rebuild app service
docker-compose build --no-cache app

# Reset everything
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```
