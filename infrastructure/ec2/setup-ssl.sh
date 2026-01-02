#!/bin/bash
# SSL Certificate Setup Script for ISMS Application
# This script sets up Let's Encrypt SSL certificates using Certbot
#
# Usage: sudo ./setup-ssl.sh <domain-name> <email>
# Example: sudo ./setup-ssl.sh trust.example.com admin@example.com

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_step() {
    echo -e "${BLUE}==>${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run as root or with sudo"
    exit 1
fi

# Check arguments
if [ $# -lt 2 ]; then
    print_error "Usage: $0 <domain-name> <email>"
    echo "Example: $0 trust.example.com admin@example.com"
    exit 1
fi

DOMAIN=$1
EMAIL=$2

print_step "Setting up SSL certificate for domain: $DOMAIN"
echo ""

# Check if certbot is installed
if ! command -v certbot &> /dev/null; then
    print_error "Certbot is not installed. Please run setup-ec2.sh first."
    exit 1
fi

# Check if Nginx is installed
if ! command -v nginx &> /dev/null; then
    print_error "Nginx is not installed. Please run setup-ec2.sh first."
    exit 1
fi

# Check if domain resolves to this server
print_step "Verifying domain DNS..."
SERVER_IP=$(curl -s ifconfig.me || curl -s ipinfo.io/ip)
DOMAIN_IP=$(dig +short "$DOMAIN" | tail -n1)

if [ -z "$DOMAIN_IP" ]; then
    print_warning "Could not resolve $DOMAIN. Make sure DNS is configured correctly."
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
elif [ "$DOMAIN_IP" != "$SERVER_IP" ]; then
    print_warning "Domain $DOMAIN resolves to $DOMAIN_IP, but this server's IP is $SERVER_IP"
    print_warning "Let's Encrypt validation may fail. Make sure the domain points to this server."
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    print_success "Domain DNS verified"
fi

# Create temporary Nginx config for ACME challenge
print_step "Creating temporary Nginx configuration for ACME challenge..."

# Determine Nginx config directory (Ubuntu uses sites-available, Amazon Linux uses conf.d)
if [ -d /etc/nginx/sites-available ]; then
    # Ubuntu/Debian style
    TEMP_NGINX_CONF="/etc/nginx/sites-available/acme-challenge"
    cat > "$TEMP_NGINX_CONF" <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}
EOF
    # Enable the temporary config
    if [ -d /etc/nginx/sites-enabled ]; then
        ln -sf "$TEMP_NGINX_CONF" /etc/nginx/sites-enabled/acme-challenge
    fi
else
    # Amazon Linux style (uses conf.d)
    # Note: The main nginx.conf already handles /.well-known/acme-challenge/
    # We just need to ensure the webroot exists and nginx is configured
    TEMP_NGINX_CONF="/etc/nginx/conf.d/acme-challenge.conf"
    # Create a minimal config that ensures ACME challenge works
    # The main nginx.conf should already handle this, but this ensures it works
    cat > "$TEMP_NGINX_CONF" <<EOF
# Temporary config for ACME challenge
# This ensures /.well-known/acme-challenge/ is served correctly
# The main nginx.conf should also handle this, but this provides a fallback
server {
    listen 80;
    server_name $DOMAIN;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
        access_log off;
    }
}
EOF
fi

# Ensure web root exists
mkdir -p /var/www/html

# Test and reload Nginx
nginx -t && systemctl reload nginx
print_success "Temporary Nginx configuration created"

# Obtain certificate
print_step "Obtaining SSL certificate from Let's Encrypt..."
certbot certonly \
    --webroot \
    --webroot-path=/var/www/html \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    --domains "$DOMAIN" \
    --non-interactive

if [ $? -eq 0 ]; then
    print_success "SSL certificate obtained"
else
    print_error "Failed to obtain SSL certificate"
    exit 1
fi

# Update Nginx SSL configuration
print_step "Updating Nginx SSL configuration..."
SSL_CONF="/etc/nginx/conf.d/ssl.conf"

# Create SSL config if it doesn't exist
if [ ! -f "$SSL_CONF" ]; then
    cat > "$SSL_CONF" <<'SSL_EOF'
# SSL Configuration for Let's Encrypt Certificates
# This file is included in nginx.conf when SSL is enabled

# SSL certificate paths (Let's Encrypt)
ssl_certificate /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/privkey.pem;

# SSL configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384';
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
ssl_session_tickets off;

# OCSP stapling
ssl_stapling on;
ssl_stapling_verify on;
ssl_trusted_certificate /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/chain.pem;

# Security: Disable SSLv3 and weak ciphers
ssl_dhparam /etc/nginx/dhparam.pem;
SSL_EOF
fi

# Replace domain placeholder
sed -i "s|DOMAIN_PLACEHOLDER|$DOMAIN|g" "$SSL_CONF"
print_success "SSL configuration updated"

# Update main Nginx config to include SSL and use domain
print_step "Updating main Nginx configuration..."
MAIN_NGINX_CONF="/etc/nginx/nginx.conf"

# Check if we need to update the server_name
if grep -q "server_name _" "$MAIN_NGINX_CONF"; then
    sed -i "s/server_name _;/server_name $DOMAIN;/g" "$MAIN_NGINX_CONF"
fi

# Uncomment SSL include if commented
if grep -q "# include /etc/nginx/conf.d/ssl.conf" "$MAIN_NGINX_CONF"; then
    sed -i "s|# include /etc/nginx/conf.d/ssl.conf|include /etc/nginx/conf.d/ssl.conf;|g" "$MAIN_NGINX_CONF"
fi

# Test Nginx configuration
nginx -t
if [ $? -eq 0 ]; then
    systemctl reload nginx
    print_success "Nginx configuration updated and reloaded"
else
    print_error "Nginx configuration test failed"
    exit 1
fi

# Set up automatic renewal
print_step "Setting up automatic certificate renewal..."
# Certbot creates a systemd timer by default, but let's verify it
if systemctl list-timers | grep -q "certbot"; then
    print_success "Certbot renewal timer is active"
else
    print_warning "Certbot renewal timer not found. Creating renewal script..."
    
    # Create renewal hook script
    cat > /etc/letsencrypt/renewal-hooks/deploy/nginx-reload.sh <<'HOOK_EOF'
#!/bin/bash
nginx -t && systemctl reload nginx
HOOK_EOF
    chmod +x /etc/letsencrypt/renewal-hooks/deploy/nginx-reload.sh
    
    # Test renewal (dry run)
    certbot renew --dry-run
    print_success "Certificate renewal configured"
fi

# Remove temporary ACME challenge config
if [ -f "$TEMP_NGINX_CONF" ]; then
    rm "$TEMP_NGINX_CONF"
    if [ -L /etc/nginx/sites-enabled/acme-challenge ]; then
        rm /etc/nginx/sites-enabled/acme-challenge
    fi
    nginx -t && systemctl reload nginx
    print_success "Temporary ACME challenge config removed"
fi

echo ""
print_success "SSL certificate setup completed!"
echo ""
echo "Certificate location: /etc/letsencrypt/live/$DOMAIN/"
echo "Certificate will auto-renew via Certbot timer"
echo ""
echo "Test SSL configuration:"
echo "  openssl s_client -connect $DOMAIN:443 -servername $DOMAIN"
echo ""
echo "Verify certificate:"
echo "  certbot certificates"



