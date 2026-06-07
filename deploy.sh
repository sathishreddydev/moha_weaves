#!/bin/bash
# Moha Weaves VPS Deployment Script
# Usage: ./deploy.sh
# Pre-requisites:
#   - SSH key set up for VPS_USER@VPS_HOST on port VPS_PORT
#   - .env.vps populated with real values (never committed to git)

set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────────────
VPS_HOST="103.127.146.58"
VPS_PORT="7576"
VPS_USER="deploy"           # Use a dedicated non-root deploy user
PROJECT_NAME="moha_weaves"
DEPLOY_PATH="/opt/$PROJECT_NAME"
DOMAIN="urumibymounika.com"
ADMIN_DOMAIN="admin.urumibymounika.com"
CERTBOT_EMAIL="sathishreddy.k0337@gmail.com"

# ── Colors ─────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ── Cleanup trap ───────────────────────────────────────────────────────────────
ARCHIVE="moha_weaves_deploy.tar.gz"
cleanup() {
  if [[ -f "$ARCHIVE" ]]; then
    rm -f "$ARCHIVE"
    log_info "Cleaned up local archive."
  fi
}
trap cleanup EXIT

# ── SSH helper ─────────────────────────────────────────────────────────────────
ssh_run() {
  ssh -p "$VPS_PORT" -o StrictHostKeyChecking=accept-new "$VPS_USER@$VPS_HOST" "$@"
}

# ── 1. Check SSH connection ────────────────────────────────────────────────────
check_ssh_connection() {
  log_info "Checking SSH connection to VPS..."
  if ssh_run "echo 'SSH OK'" > /dev/null 2>&1; then
    log_info "SSH connection successful."
  else
    log_error "SSH connection failed. Check your key / host / port."
    exit 1
  fi
}

# ── 2. Setup VPS (idempotent) ──────────────────────────────────────────────────
setup_vps() {
  log_info "Setting up VPS environment (idempotent)..."

  ssh_run bash << 'REMOTE'
    set -euo pipefail

    # Install Docker if missing
    if ! command -v docker &> /dev/null; then
      apt-get update -qq
      curl -fsSL https://get.docker.com | sh
      systemctl enable --now docker
    fi

    # Install Docker Compose plugin if missing
    if ! docker compose version &> /dev/null; then
      apt-get update -qq
      apt-get install -y docker-compose-plugin
    fi

    # Install certbot (standalone mode — no host nginx needed, Docker handles it)
    apt-get update -qq
    apt-get install -y --no-install-recommends git certbot

    # Stop host nginx if running — Docker nginx handles port 80/443
    systemctl stop nginx 2>/dev/null || true
    systemctl disable nginx 2>/dev/null || true

    # Create a dedicated deploy user if it doesn't exist
    if ! id deploy &>/dev/null; then
      useradd -m -s /bin/bash deploy
      usermod -aG docker deploy
    fi

    # Create project directory owned by deploy user
    mkdir -p /opt/moha_weaves/nginx/ssl
    chown -R deploy:deploy /opt/moha_weaves

    # Minimal firewall rules
    ufw allow "$SSH_PORT"/tcp 2>/dev/null || true
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw --force enable

    echo "VPS setup completed."
REMOTE
}

# ── 3. Deploy application ──────────────────────────────────────────────────────
deploy_application() {
  log_info "Packaging application..."

  tar -czf "$ARCHIVE" \
    --exclude=node_modules \
    --exclude=dist \
    --exclude=.git \
    --exclude=uploads \
    --exclude='nginx/ssl' \
    --exclude='.env*' \
    .

  log_info "Copying archive to VPS..."
  scp -P "$VPS_PORT" "$ARCHIVE" "$VPS_USER@$VPS_HOST:$DEPLOY_PATH/"

  log_info "Copying populated .env.vps as .env.prod on VPS..."
  scp -P "$VPS_PORT" .env.vps "$VPS_USER@$VPS_HOST:$DEPLOY_PATH/.env.prod"

  log_info "Building and starting containers on VPS..."
  ssh_run bash << REMOTE
    set -euo pipefail
    cd "$DEPLOY_PATH"
    tar -xzf "$ARCHIVE"
    rm "$ARCHIVE"

    # Pull latest images for base layers
    docker compose pull --ignore-pull-failures || true

    # Build and restart
    docker compose down --remove-orphans
    docker compose build --no-cache
    docker compose up -d

    # Run database migrations once containers are healthy
    echo "Waiting for DB to be healthy..."
    sleep 15
    docker compose exec -T app npm run db:migrate || true

    docker compose ps
REMOTE

  log_info "Application deployed successfully."
}

# ── 4. Setup SSL ───────────────────────────────────────────────────────────────
setup_ssl() {
  log_info "Setting up SSL certificates for $DOMAIN and $ADMIN_DOMAIN..."

  ssh_run bash << REMOTE
    set -euo pipefail

    # Stop Docker containers temporarily to free port 80 for standalone certbot
    cd "$DEPLOY_PATH"
    docker compose stop nginx 2>/dev/null || true

    certbot certonly --standalone \
      --email "$CERTBOT_EMAIL" \
      --agree-tos \
      --no-eff-email \
      -d "$DOMAIN" \
      -d "$ADMIN_DOMAIN"

    # Copy certs for Docker nginx volume access
    cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem /opt/moha_weaves/nginx/ssl/cert.pem
    cp /etc/letsencrypt/live/$DOMAIN/privkey.pem   /opt/moha_weaves/nginx/ssl/key.pem
    chown -R deploy:deploy /opt/moha_weaves/nginx/ssl

    # Restart nginx container with valid certs
    docker compose up -d nginx

    # Auto-renewal cron — stops Docker nginx, renews, copies certs, restarts
    (crontab -l 2>/dev/null | grep -v 'certbot renew' ; echo "0 0,12 * * * certbot renew --quiet --pre-hook 'docker compose -f /opt/moha_weaves/docker-compose.yml stop nginx' --post-hook 'cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem /opt/moha_weaves/nginx/ssl/cert.pem && cp /etc/letsencrypt/live/$DOMAIN/privkey.pem /opt/moha_weaves/nginx/ssl/key.pem && docker compose -f /opt/moha_weaves/docker-compose.yml up -d nginx'") | crontab -

    echo "SSL setup complete."
REMOTE

  log_info "SSL certificates configured."
}

# ── 5. Health check ────────────────────────────────────────────────────────────
health_check() {
  log_info "Waiting 60s for services to settle..."
  sleep 60

  log_info "Running health checks..."

  # Verify TLS cert — do NOT use -k (insecure flag defeats the purpose)
  if curl --fail --silent --max-time 10 "https://$ADMIN_DOMAIN/api/health" > /dev/null; then
    log_info "✅ Backend health check passed (https://$ADMIN_DOMAIN/api/health)"
  else
    log_warn "⚠️  Backend health check failed — check container logs"
  fi

  if curl --fail --silent --max-time 10 "https://$DOMAIN" > /dev/null; then
    log_info "✅ Frontend health check passed (https://$DOMAIN)"
  else
    log_warn "⚠️  Frontend health check failed — check container logs"
  fi
}

# ── Main ───────────────────────────────────────────────────────────────────────
main() {
  log_info "Starting Moha Weaves VPS deployment..."

  # Safety check — refuse to deploy if .env.vps still has placeholder values
  if grep -q 'REPLACE_WITH' .env.vps; then
    log_error ".env.vps still contains REPLACE_WITH placeholder values."
    log_error "Fill in all real credentials before deploying."
    exit 1
  fi

  check_ssh_connection
  setup_vps
  deploy_application
  setup_ssl
  health_check

  log_info "🎉 Deployment completed successfully!"
  log_info "  Frontend : https://$DOMAIN"
  log_info "  Admin    : https://$ADMIN_DOMAIN"
  echo ""
  echo "Useful commands:"
  echo "  Logs    : ssh -p $VPS_PORT $VPS_USER@$VPS_HOST 'cd $DEPLOY_PATH && docker compose logs -f'"
  echo "  Restart : ssh -p $VPS_PORT $VPS_USER@$VPS_HOST 'cd $DEPLOY_PATH && docker compose restart'"
  echo "  Status  : ssh -p $VPS_PORT $VPS_USER@$VPS_HOST 'cd $DEPLOY_PATH && docker compose ps'"
}

main
