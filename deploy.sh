#!/bin/bash

# Moha Weaves Deployment Script for HostItSmart VPS
# This script automates the deployment process

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="moha-weaves"
APP_DIR="/opt/$APP_NAME"
BACKUP_DIR="/opt/backups"
LOG_FILE="/var/log/$APP_NAME-deploy.log"

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Print colored output
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
check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root or with sudo"
        exit 1
    fi
}

# Check system requirements
check_requirements() {
    print_status "Checking system requirements..."
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        install_docker
    else
        print_status "Docker is already installed"
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed"
        install_docker_compose
    else
        print_status "Docker Compose is already installed"
    fi
    
    # Check if Git is installed
    if ! command -v git &> /dev/null; then
        print_error "Git is not installed"
        apt-get update && apt-get install -y git
    else
        print_status "Git is already installed"
    fi
}

# Install Docker
install_docker() {
    print_status "Installing Docker..."
    
    # Remove old versions
    apt-get remove -y docker docker-engine docker.io containerd runc || true
    
    # Install dependencies
    apt-get update
    apt-get install -y \
        ca-certificates \
        curl \
        gnupg \
        lsb-release
    
    # Add Docker's official GPG key
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    # Set up the repository
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
        $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker Engine
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    
    # Start and enable Docker
    systemctl start docker
    systemctl enable docker
    
    print_status "Docker installed successfully"
}

# Install Docker Compose
install_docker_compose() {
    print_status "Installing Docker Compose..."
    
    # Download Docker Compose
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    
    # Apply executable permissions
    chmod +x /usr/local/bin/docker-compose
    
    # Create symbolic link
    ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
    
    print_status "Docker Compose installed successfully"
}

# Create application directory
create_app_directory() {
    print_status "Creating application directory..."
    
    mkdir -p "$APP_DIR"
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$APP_DIR/uploads"
    mkdir -p "$APP_DIR/nginx/ssl"
    
    # Set proper permissions
    chown -R root:root "$APP_DIR"
    chmod -R 755 "$APP_DIR"
    
    print_status "Application directory created"
}

# Clone or update repository
setup_repository() {
    print_status "Setting up repository..."
    
    cd "$APP_DIR"
    
    # If repository exists, pull latest changes
    if [ -d ".git" ]; then
        print_status "Pulling latest changes..."
        git pull origin main
    else
        print_status "Cloning repository..."
        # You'll need to replace this with your actual repository URL
        git clone https://github.com/yourusername/moha-weaves.git .
    fi
    
    print_status "Repository setup complete"
}

# Setup environment variables
setup_environment() {
    print_status "Setting up environment variables..."
    
    # Create production environment file
    if [ ! -f "$APP_DIR/.env.prod" ]; then
        print_warning "Environment file not found. Please create .env.prod file with your production variables."
        print_status "Template .env.prod file created. Please update it with your values."
        
        cat > "$APP_DIR/.env.prod" << EOF
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
EOF
        
        print_warning "Please edit $APP_DIR/.env.prod with your actual values before continuing!"
        read -p "Press Enter after updating the environment file..."
    fi
    
    print_status "Environment variables configured"
}

# Setup SSL certificates (Let's Encrypt)
setup_ssl() {
    print_status "Setting up SSL certificates..."
    
    # Install Certbot
    if ! command -v certbot &> /dev/null; then
        apt-get update
        apt-get install -y certbot python3-certbot-nginx
    fi
    
    # Get SSL certificate (replace with your domain)
    read -p "Enter your domain name: " DOMAIN
    
    if [ -n "$DOMAIN" ]; then
        certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email admin@"$DOMAIN" || {
            print_warning "SSL certificate setup failed. Using self-signed certificate for now."
            # Generate self-signed certificate
            openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
                -keyout "$APP_DIR/nginx/ssl/key.pem" \
                -out "$APP_DIR/nginx/ssl/cert.pem" \
                -subj "/C=US/ST=State/L=City/O=Organization/CN=$DOMAIN"
        }
    else
        print_warning "No domain provided. Skipping SSL setup."
    fi
    
    print_status "SSL setup complete"
}

# Deploy application
deploy_application() {
    print_status "Deploying application..."
    
    cd "$APP_DIR"
    
    # Stop existing services
    docker-compose -f docker-compose.prod.yml down || true
    
    # Build and start services
    docker-compose -f docker-compose.prod.yml build --no-cache
    docker-compose -f docker-compose.prod.yml up -d
    
    # Wait for services to be ready
    print_status "Waiting for services to start..."
    sleep 30
    
    # Check service health
    if docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
        print_status "Application deployed successfully!"
    else
        print_error "Application deployment failed!"
        docker-compose -f docker-compose.prod.yml logs
        exit 1
    fi
}

# Setup firewall
setup_firewall() {
    print_status "Setting up firewall..."
    
    # Allow SSH, HTTP, HTTPS
    ufw allow ssh
    ufw allow 80
    ufw allow 443
    
    # Enable firewall
    ufw --force enable
    
    print_status "Firewall configured"
}

# Setup automatic backups
setup_backups() {
    print_status "Setting up automatic backups..."
    
    # Create backup script
    cat > /usr/local/bin/backup-moha-weaves.sh << 'EOF'
#!/bin/bash

APP_NAME="moha-weaves"
APP_DIR="/opt/$APP_NAME"
BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Create database backup
docker exec moha_weaves_postgres pg_dump -U postgres moha_weaves > "$BACKUP_DIR/db_backup_$DATE.sql"

# Create application backup
tar -czf "$BACKUP_DIR/app_backup_$DATE.tar.gz" -C "$APP_DIR" uploads .env.prod

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "*.sql" -mtime +7 -delete
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
EOF
    
    chmod +x /usr/local/bin/backup-moha-weaves.sh
    
    # Add to crontab (daily at 2 AM)
    (crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-moha-weaves.sh") | crontab -
    
    print_status "Automatic backups configured"
}

# Main deployment function
main() {
    print_status "Starting Moha Weaves deployment..."
    
    check_root
    check_requirements
    create_app_directory
    setup_repository
    setup_environment
    setup_ssl
    deploy_application
    setup_firewall
    setup_backups
    
    print_status "Deployment completed successfully!"
    print_status "Your application should be accessible at: http://your-server-ip"
    print_status "Check logs with: docker-compose -f $APP_DIR/docker-compose.prod.yml logs -f"
}

# Run main function
main "$@"
