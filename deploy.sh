#!/bin/bash

# Moha Weaves VPS Deployment Script
# This script automates the deployment process on the VPS

set -e

echo "🚀 Starting Moha Weaves VPS Deployment..."

# Configuration
VPS_HOST="103.127.146.58"
VPS_PORT="7576"
VPS_USER="root"
PROJECT_NAME="moha_weaves"
DEPLOY_PATH="/opt/$PROJECT_NAME"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if SSH connection works
check_ssh_connection() {
    log_info "Checking SSH connection to VPS..."
    if ssh -p $VPS_PORT -o ConnectTimeout=10 $VPS_USER@$VPS_HOST "echo 'SSH connection successful'" > /dev/null 2>&1; then
        log_info "SSH connection successful"
    else
        log_error "SSH connection failed. Please check your SSH configuration."
        exit 1
    fi
}

# Setup VPS environment
setup_vps() {
    log_info "Setting up VPS environment..."
    
    ssh -p $VPS_PORT $VPS_USER@$VPS_HOST << 'EOF'
        # Update system
        apt update && apt upgrade -y
        
        # Install Docker and Docker Compose
        if ! command -v docker &> /dev/null; then
            curl -fsSL https://get.docker.com -o get-docker.sh
            sh get-docker.sh
            usermod -aG docker $USER
            systemctl enable docker
            systemctl start docker
        fi
        
        if ! command -v docker-compose &> /dev/null; then
            curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
            chmod +x /usr/local/bin/docker-compose
        fi
        
        # Install other utilities
        apt install -y git nginx certbot python3-certbot-nginx
        
        # Create project directory
        mkdir -p /opt/moha_weaves
        mkdir -p /opt/moha_weaves/nginx/ssl
        
        # Setup firewall
        ufw allow 22/tcp
        ufw allow 80/tcp
        ufw allow 443/tcp
        ufw --force enable
        
        echo "VPS setup completed"
EOF
}

# Deploy application
deploy_application() {
    log_info "Deploying application to VPS..."
    
    # Create a temporary archive
    tar -czf moha_weaves_deploy.tar.gz \
        --exclude=node_modules \
        --exclude=dist \
        --exclude=.git \
        --exclude=uploads \
        --exclude=nginx/ssl \
        .
    
    # Copy files to VPS
    scp -P $VPS_PORT moha_weaves_deploy.tar.gz $VPS_USER@$VPS_HOST:$DEPLOY_PATH/
    
    # Extract and setup on VPS
    ssh -p $VPS_PORT $VPS_USER@$VPS_HOST << EOF
        cd $DEPLOY_PATH
        tar -xzf moha_weaves_deploy.tar.gz --strip-components=1
        rm moha_weaves_deploy.tar.gz
        
        # Copy environment file
        cp .env.vps .env
        
        # Build and start containers
        docker-compose down
        docker-compose build --no-cache
        docker-compose up -d
        
        # Wait for containers to start
        sleep 30
        
        # Check container status
        docker-compose ps
EOF
    
    # Clean up local archive
    rm moha_weaves_deploy.tar.gz
    
    log_info "Application deployed successfully"
}

# Setup SSL certificates
setup_ssl() {
    log_info "Setting up SSL certificates..."
    
    ssh -p $VPS_PORT $VPS_USER@$VPS_HOST << EOF
        # Stop nginx to free up port 80
        docker-compose stop frontend
        
        # Get SSL certificate
        certbot certonly --standalone \
            --email sathishreddy.k0337@gmail.com \
            --agree-tos \
            --no-eff-email \
            -d vps.sathish.com \
            -d admin.vps.sathish.com
        
        # Copy certificates to nginx directory
        cp /etc/letsencrypt/live/vps.sathish.com/fullchain.pem /opt/moha_weaves/nginx/ssl/cert.pem
        cp /etc/letsencrypt/live/vps.sathish.com/privkey.pem /opt/moha_weaves/nginx/ssl/key.pem
        
        # Set up auto-renewal
        echo "0 12 * * * /usr/bin/certbot renew --quiet && docker-compose restart frontend" | crontab -
        
        # Restart frontend
        docker-compose start frontend
EOF
    
    log_info "SSL certificates setup completed"
}

# Health check
health_check() {
    log_info "Performing health check..."
    
    # Wait for application to start
    sleep 60
    
    # Check if services are running
    if curl -k -s https://vps.sathish.com/api/health > /dev/null; then
        log_info "✅ Backend health check passed"
    else
        log_warn "⚠️ Backend health check failed"
    fi
    
    if curl -k -s https://vps.sathish.com > /dev/null; then
        log_info "✅ Frontend health check passed"
    else
        log_warn "⚠️ Frontend health check failed"
    fi
}

# Main deployment flow
main() {
    log_info "Starting deployment process..."
    
    check_ssh_connection
    setup_vps
    deploy_application
    setup_ssl
    health_check
    
    log_info "🎉 Deployment completed successfully!"
    log_info "Your application is now available at: https://vps.sathish.com"
    log_info "Admin panel: https://admin.vps.sathish.com"
    
    echo ""
    echo "📋 Useful commands:"
    echo "View logs: ssh -p $VPS_PORT $VPS_USER@$VPS_HOST 'cd $DEPLOY_PATH && docker-compose logs -f'"
    echo "Restart services: ssh -p $VPS_PORT $VPS_USER@$VPS_HOST 'cd $DEPLOY_PATH && docker-compose restart'"
    echo "Update application: ssh -p $VPS_PORT $VPS_USER@$VPS_HOST 'cd $DEPLOY_PATH && git pull && docker-compose build && docker-compose up -d'"
}

# Run the deployment
main
