# SSL/TLS Setup

Configure HTTPS for Discoverer Neo.

## Overview

Discoverer Neo serves HTTPS through Nginx (frontend proxy and API gateway). The backend runs on HTTP (Nginx handles encryption).

## Self-Signed Certificate (Development)

For local testing:

```bash
# Generate private key
openssl genrsa -out key.pem 2048

# Generate certificate (valid 365 days)
openssl req -new -x509 -key key.pem -out cert.pem -days 365 \
  -subj "/C=US/ST=State/L=City/O=Org/CN=localhost"

# Copy to frontend directory
cp cert.pem frontend/nginx.cert.pem
cp key.pem frontend/nginx.key.pem
```

## Production Certificate

### Using Let's Encrypt (Recommended)

Free SSL certificates via Certbot:

```bash
# Install Certbot
apt-get install certbot

# Generate certificate for domain
certbot certonly --standalone \
  -d yourdomain.com \
  -d www.yourdomain.com \
  --email admin@yourdomain.com

# Certificate saved to:
# /etc/letsencrypt/live/yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/yourdomain.com/privkey.pem
```

### Using Commercial CA

1. Generate CSR (Certificate Signing Request):
   ```bash
   openssl req -new -key key.pem -out csr.pem \
     -subj "/C=US/ST=State/L=City/O=Org/CN=yourdomain.com"
   ```

2. Submit CSR to CA (DigiCert, Comodo, etc.)

3. Receive certificate files

4. Combine certificate and chain:
   ```bash
   cat certificate.crt intermediate.crt root.crt > fullchain.pem
   ```

## Nginx Configuration

Update `frontend/nginx.conf`:

```nginx
upstream backend {
    server backend:3000;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    
    # SSL certificates
    ssl_certificate /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;
    
    # SSL security
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    root /usr/share/nginx/html;
    
    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
    
    # API proxy
    location /api/ {
        proxy_pass http://backend/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
    
    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}

# HTTP redirect to HTTPS
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

## Docker Deployment with SSL

### Mount Certificates

In `docker-compose.yml`:

```yaml
services:
  frontend:
    volumes:
      - /etc/letsencrypt/live/yourdomain.com/fullchain.pem:/etc/nginx/certs/fullchain.pem:ro
      - /etc/letsencrypt/live/yourdomain.com/privkey.pem:/etc/nginx/certs/privkey.pem:ro
    ports:
      - "443:443"
      - "80:80"
```

### Build & Start

```bash
docker compose up -d
```

## Certificate Renewal

### Let's Encrypt Auto-Renewal

Certbot auto-renews 30 days before expiration:

```bash
# Test renewal (dry-run)
certbot renew --dry-run

# Force renewal
certbot renew --force-renewal
```

### Manual Renewal in Docker

```bash
# Stop Nginx
docker compose stop frontend

# Renew certificate
certbot renew

# Start Nginx
docker compose up -d frontend
```

### Scheduled Renewal

Add cron job:

```bash
# Edit crontab
crontab -e

# Add renewal at 2 AM daily
0 2 * * * certbot renew --quiet && docker compose restart frontend
```

## Verification

Test SSL configuration:

```bash
# Check certificate
openssl x509 -in cert.pem -text -noout

# Test HTTPS connection
curl -I https://yourdomain.com

# SSL Labs test
# Visit: https://www.ssllabs.com/ssltest/analyze.html?d=yourdomain.com
```

## Performance Optimization

### HTTP/2 Push

Enable for critical assets:

```nginx
http2_push_preload on;
```

### Session Resumption

Reduce handshake overhead:

```nginx
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
```

### OCSP Stapling

Improve certificate validation:

```nginx
ssl_stapling on;
ssl_stapling_verify on;
ssl_trusted_certificate /etc/nginx/certs/chain.pem;
```

## Troubleshooting

### Mixed Content Warning

If browser shows "Not Secure":

1. Ensure all resources use HTTPS
2. Check API requests (should be /api, not http://...)
3. Update frontend config if needed

### Certificate Expired

```bash
# Check expiration
openssl x509 -in cert.pem -noout -dates

# Renew if needed
certbot renew
```

### Connection Timeout

1. Verify port 443 is open in firewall
2. Check DNS points to correct IP
3. Verify certificate is accessible to Nginx

## Cost-Effective HTTPS

**Let's Encrypt:** Free, automated, recommended  
**Self-signed:** Free, but browser warns (development only)  
**Commercial CA:** $50–200/year (not necessary for most)

## What's Next?

- **[Docker Deployment](docker.md)** — Container setup
- **[Configuration](configuration.md)** — Environment variables
- **[Monitoring](monitoring.md)** — Health and metrics

---

**See Also:** [Deployment Guide](../deployment/), [Docker Deployment](docker.md)
