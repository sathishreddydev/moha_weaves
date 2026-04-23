#!/bin/bash

# Moha Weaves VPS Deployment Script
# This script sets up the complete Docker environment on VPS

set -e

echo "🚀 Starting Moha Weaves VPS Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run as root (use sudo)"
    exit 1
fi

# Update system packages
print_status "Updating system packages..."
apt update && apt upgrade -y

# Install Docker and Docker Compose
print_status "Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    systemctl enable docker
    systemctl start docker
    usermod -aG docker root
else
    print_status "Docker already installed"
fi

print_status "Installing Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    apt install docker-compose -y
else
    print_status "Docker Compose already installed"
fi

# Install other required packages
print_status "Installing additional packages..."
apt install -y nginx certbot python3-certbot-nginx curl unzip git

# Configure firewall
print_status "Configuring firewall..."
if ! command -v ufw &> /dev/null; then
    apt install ufw -y
fi

ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 7576/tcp  # Custom SSH port
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable

# Create application directory
print_status "Creating application directory..."
mkdir -p /opt/moha-weaves
cd /opt/moha-weaves

# Create necessary directories
print_status "Creating directories..."
mkdir -p uploads attached_assets backups nginx/ssl nginx/conf.d

# Set permissions
chmod -R 755 /opt/moha-weaves
chown -R root:root /opt/moha-weaves

# Create backup script
print_status "Creating backup script..."
cat > /opt/moha-weaves/backup.sh << 'EOF'
#!/bin/bash
# Daily backup script for Moha Weaves

BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M%S)
APP_DIR="/opt/moha-weaves"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
docker exec moha_weaves_postgres pg_dump -U postgres moha_weaves > $BACKUP_DIR/db_backup_$DATE.sql

# Backup application files
tar -czf $BACKUP_DIR/app_backup_$DATE.tar.gz -C $APP_DIR uploads attached_assets .env.prod

# Clean old backups (keep 7 days)
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
EOF

chmod +x /opt/moha-weaves/backup.sh

# Setup cron job for daily backups at 2 AM
print_status "Setting up daily backup cron job..."
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/moha-weaves/backup.sh") | crontab -

# Create systemd service for application
print_status "Creating systemd service..."
cat > /etc/systemd/system/moha-weaves.service << 'EOF'
[Unit]
Description=Moha Weaves Application
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/moha-weaves
ExecStart=/usr/bin/docker-compose -f docker-compose.prod.yml up -d
ExecStop=/usr/bin/docker-compose -f docker-compose.prod.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

systemctl enable moha-weaves.service

# Create nginx SSL directory
mkdir -p /opt/moha-weaves/nginx/ssl

print_status "Setup completed successfully!"
echo ""
print_warning "Next steps:"
echo "1. Copy your application files to /opt/moha-weaves"
echo "2. Update .env.prod with your actual values"
echo "3. Run: docker-compose -f docker-compose.prod.yml up -d"
echo "4. Setup SSL certificate: certbot --nginx -d admin.vps.sathish.com"
echo ""
print_status "VPS is ready for Moha Weaves deployment!"

# Clean up
rm -f /opt/moha-weaves/get-docker.sh

echo "✅ Deployment setup complete!"
