# Single EC2 Instance Deployment Guide

This guide covers deploying the ISMS application on a single EC2 instance for cost-effective, low-volume production deployments.

## Overview

This deployment bundle runs all application components on a single EC2 instance:
- **Backend** (Node.js/Express API)
- **Frontend** (React/Vite)
- **Document Service** (PDF conversion microservice)
- **AI Service** (Embeddings microservice)
- **Ollama** (LLM service)
- **PostgreSQL** (Database)
- **Nginx** (Reverse proxy and SSL termination)

### Cost Comparison

**Current AWS ECS Deployment:**
- ECS Fargate: ~$30-50/month
- Aurora Serverless v2: ~$50-100/month
- ALB: ~$20/month
- **Total: ~$100-170/month**

**Single EC2 Deployment:**
- EC2 t3.medium: ~$30/month
- EBS volume (50GB): ~$5/month
- CloudFront (optional): ~$1-5/month
- CloudWatch Logs: ~$1-2/month
- **Total: ~$35-50/month**

**Savings: ~$50-120/month (50-70% reduction)**

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **EC2 Key Pair** for SSH access
3. **Domain Name** (optional, for SSL certificates)
4. **AWS CLI** configured locally
5. **Git** access to the repository

## Architecture

```
Internet
  ↓
CloudFront (ACM SSL) - Optional
  ↓
EC2 Instance (t3.medium/t3.large)
  ├── Nginx (reverse proxy, SSL termination)
  ├── Docker Compose Stack:
  │   ├── Frontend (React/Vite) - Port 80
  │   ├── Backend (Node.js/Express) - Port 4000
  │   ├── Document Service - Port 4001
  │   ├── AI Service - Port 4002
  │   ├── Ollama - Port 11434
  │   └── PostgreSQL - Port 5432
  └── CloudWatch Agent (monitoring)
```

## Deployment Steps

### Step 1: Launch EC2 Instance

#### Option A: Using CloudFormation (Recommended)

```bash
aws cloudformation create-stack \
  --stack-name isms-ec2-production \
  --template-body file://infrastructure/templates/ec2-single-instance.yaml \
  --parameters \
    ParameterKey=Environment,ParameterValue=production \
    ParameterKey=InstanceType,ParameterValue=t3.medium \
    ParameterKey=KeyPairName,ParameterValue=mark.braybrook-sandbox \
    ParameterKey=AllowedSSHCIDR,ParameterValue=51.7.243.135/32 \
    ParameterKey=VolumeSize,ParameterValue=50 \
  --capabilities CAPABILITY_NAMED_IAM \
  --region eu-west-2 \
  --profile pt-sandbox
```

**Updating SSH IP Address When It Changes:**

If your IP address changes, you can update the security group without recreating the stack by using `update-stack`. You can automatically fetch your current IP address and use it in the command:

**Option 1: Automatic IP Detection (Recommended)**

```bash
MY_IP=$(curl -s https://checkip.amazonaws.com)
aws cloudformation update-stack \
  --stack-name isms-ec2-production \
  --template-body file://infrastructure/templates/ec2-single-instance.yaml \
  --parameters \
    ParameterKey=Environment,ParameterValue=production \
    ParameterKey=InstanceType,ParameterValue=t3.medium \
    ParameterKey=KeyPairName,ParameterValue=mark.braybrook-sandbox \
    ParameterKey=AllowedSSHCIDR,ParameterValue=${MY_IP}/32 \
    ParameterKey=VolumeSize,ParameterValue=50 \
  --capabilities CAPABILITY_NAMED_IAM \
  --region eu-west-2 \
  --profile pt-sandbox
```

**Option 2: Using the Helper Script (Recommended)**

For convenience, use the `update-ssh-ip.sh` helper script which automates the entire process:

```bash
# Basic usage (uses defaults: isms-ec2-production, eu-west-2, pt-sandbox)
./infrastructure/ec2/update-ssh-ip.sh

# With custom options
./infrastructure/ec2/update-ssh-ip.sh \
  --stack-name isms-ec2-production \
  --region eu-west-2 \
  --profile pt-sandbox

# Dry run to see what would change
./infrastructure/ec2/update-ssh-ip.sh --dry-run

# Use alternative IP service
./infrastructure/ec2/update-ssh-ip.sh --ip-service https://checkip.amazonaws.com

# Show help
./infrastructure/ec2/update-ssh-ip.sh --help
```

The script automatically:
- Detects your current public IP address
- Retrieves current stack parameters
- Compares IP addresses (skips update if unchanged)
- Updates only the `AllowedSSHCIDR` parameter
- Waits for the stack update to complete
- Provides clear status messages

**Note:** The `/32` suffix means "this specific IP address only" (single host CIDR block). The `-s` flag in curl suppresses progress output.

**Alternative IP services** (if `api.ipify.org` is unavailable):
- `curl -s ifconfig.me`
- `curl -s https://icanhazip.com`
- `curl -s https://checkip.amazonaws.com`

#### Option B: Manual EC2 Launch

1. Launch EC2 instance:
   - **AMI**: Amazon Linux 2023 or Ubuntu 22.04 LTS
   - **Instance Type**: t3.medium (2 vCPU, 4GB RAM) or t3.large (2 vCPU, 8GB RAM)
   - **Storage**: 20GB root volume + 50GB data volume
   - **Security Group**: Allow SSH (22), HTTP (80), HTTPS (443)
   - **Key Pair**: Select your key pair

2. Attach IAM role with permissions for:
   - CloudWatch Logs
   - S3 (for backups)

### Step 2: Initial Server Setup

SSH into the EC2 instance:

```bash
ssh -i your-key.pem ec2-user@<EC2_PUBLIC_IP>
```

Run the setup script:

```bash
# Download or copy setup-ec2.sh to the instance
sudo bash setup-ec2.sh
```

This script installs:
- Docker and Docker Compose
- Nginx
- Certbot (for Let's Encrypt)
- AWS CLI
- Creates application directories
- Configures firewall
- Sets up automatic security updates

### Step 3: Deploy Application Code

Copy application files to the EC2 instance:

```bash
# From your local machine
scp -i your-key.pem -r \
  docker-compose.ec2.yml \
  backend \
  frontend \
  services \
  infrastructure/ec2/*.sh \
  ec2-user@<EC2_PUBLIC_IP>:/tmp/

# On EC2 instance
sudo mv /tmp/* /opt/isms/
sudo chown -R isms:isms /opt/isms
```

Or clone from Git:

```bash
# On EC2 instance
cd /opt/isms
sudo -u isms git clone <repository-url> .
```

### Step 4: Configure Environment Variables

```bash
cd /opt/isms
sudo -u isms cp infrastructure/ec2/env.template .env
sudo -u isms nano .env
```

Fill in all required values (see `env.template` for documentation):
- Database credentials
- Azure AD authentication
- CORS origins
- Service tokens
- Frontend build variables

**Important**: Generate strong secrets:
```bash
# Generate JWT secret
openssl rand -base64 32

# Generate internal service token
openssl rand -base64 32
```

### Step 5: Configure Nginx

Copy Nginx configuration:

```bash
sudo cp /opt/isms/infrastructure/ec2/nginx/nginx.conf /etc/nginx/nginx.conf
sudo nginx -t
sudo systemctl reload nginx
```

### Step 6: Set Up SSL Certificate

#### Option A: Let's Encrypt (Recommended - Free)

```bash
sudo bash /opt/isms/infrastructure/ec2/setup-ssl.sh your-domain.com admin@example.com
```

This script:
- Obtains Let's Encrypt certificate
- Configures Nginx with SSL
- Sets up automatic renewal

#### Option B: CloudFront + ACM

If using CloudFront distribution:
1. Request ACM certificate in us-east-1 region
2. Configure CloudFront to use the certificate
3. Update DNS to point to CloudFront distribution

### Step 7: Deploy Application

```bash
cd /opt/isms
sudo -u isms ./infrastructure/ec2/deploy.sh
```

This script:
- Backs up database (if exists)
- Builds Docker images
- Runs database migrations
- Starts all services
- Verifies health checks

### Step 8: Set Up Monitoring (Optional)

```bash
sudo bash /opt/isms/infrastructure/ec2/setup-monitoring.sh --region eu-west-2
```

This sets up:
- CloudWatch agent
- Log groups for all services
- Basic metrics collection

### Step 9: Configure Backups

Set up automated database backups:

```bash
# Add to crontab
sudo crontab -e

# Daily backup at 2 AM
0 2 * * * /opt/isms/infrastructure/ec2/backup.sh --s3-bucket your-backup-bucket
```

Or use AWS Systems Manager:

```bash
aws ssm create-document \
  --name isms-backup \
  --document-type "Command" \
  --content file://backup-ssm-document.json
```

## Post-Deployment

### Verify Deployment

1. **Check service health:**
   ```bash
   docker compose -f docker-compose.ec2.yml ps
   curl http://localhost/api/health
   curl http://localhost/health
   ```

2. **Check logs:**
   ```bash
   docker compose -f docker-compose.ec2.yml logs -f
   ```

3. **Test SSL:**
   ```bash
   curl https://your-domain.com/api/health
   ```

### Enable Systemd Service (Optional)

To auto-start services on boot:

```bash
sudo systemctl enable isms
sudo systemctl start isms
```

## Maintenance

### Publishing a New Version

The `deploy.sh` script can run in two modes:
1. **Local Mode** (Recommended): Run from your local machine - automatically copies files and deploys
2. **Remote Mode**: Run directly on EC2 instance

#### Method 1: Automated Deployment from Local Machine (Recommended)

The easiest way to deploy is to run the script from your local machine. It will automatically:
- Copy all necessary files to EC2
- Copy files from `/tmp` to final locations on EC2
- Build Docker images
- Deploy the application

**Usage:**

```bash
# From your local machine (in the project root)
cd /home/developer/dev/ISMS-Documentation

# Set EC2 connection details (or use command-line arguments)
export EC2_HOST=18.171.58.205
export EC2_USER=ec2-user
export EC2_SSH_KEY=~/.ssh/mark.braybrook-sandbox.pem

# Run deployment (automatically uses --no-cache for fresh builds)
./infrastructure/ec2/deploy.sh --no-cache
```

**Or use command-line arguments:**

```bash
./infrastructure/ec2/deploy.sh \
  --ec2-host 18.171.58.205 \
  --ec2-user ec2-user \
  --ec2-ssh-key ~/.ssh/mark.braybrook-sandbox.pem \
  --no-cache
```

**What it does:**
1. Prepares files locally (excludes node_modules, .git, etc.)
2. Transfers files to EC2 `/tmp/isms-deploy/` directory
3. Copies files from `/tmp` to `/opt/isms/` on EC2
4. Runs the deployment script on EC2
5. Builds Docker images without cache
6. Deploys the application

**Options:**
```bash
# Skip database backup
./infrastructure/ec2/deploy.sh --ec2-host 18.171.58.205 --skip-backup --no-cache

# Skip migrations
./infrastructure/ec2/deploy.sh --ec2-host 18.171.58.205 --skip-migrate --no-cache

# Skip building (use existing images)
./infrastructure/ec2/deploy.sh --ec2-host 18.171.58.205 --no-build
```

#### Method 2: Manual Copy Files via SCP/rsync

**Most EC2 instances don't have Git access to private repositories.** Use this method:

1. **From your local machine, copy updated files to EC2:**
   ```bash
   # Copy all application files
   scp -i your-key.pem -r \
     docker-compose.ec2.yml \
     backend \
     frontend \
     services \
     infrastructure/ec2/*.sh \
     ec2-user@<EC2_PUBLIC_IP>:/tmp/
   ```

2. **SSH into the EC2 instance:**
   ```bash
   ssh -i your-key.pem ec2-user@<EC2_PUBLIC_IP>
   ```

3. **Move files to the application directory:**
   ```bash
   cd /opt/isms
   sudo cp -r /tmp/backend ./
   sudo cp -r /tmp/frontend ./
   sudo cp -r /tmp/services ./
   sudo cp /tmp/docker-compose.ec2.yml ./
   sudo chown -R isms:isms /opt/isms
   ```

4. **Run the deployment script with `--no-cache` flag:**
   ```bash
   sudo -u isms ./infrastructure/ec2/deploy.sh --no-cache
   ```

   This will:
   - **Rebuild images without cache** (ensures all changes are included)
   - Read the VERSION file and update VITE_APP_VERSION in .env
   - Create a database backup (automatic)
   - Build new Docker images
   - Run database migrations
   - Restart all services
   - Verify health checks

   **Alternative: Using rsync (more efficient for updates):**
   ```bash
   # From your local machine - sync only changed files
   rsync -avz --exclude 'node_modules' --exclude '.git' \
     -e "ssh -i your-key.pem" \
     ./backend/ \
     ./frontend/ \
     ./services/ \
     docker-compose.ec2.yml \
     infrastructure/ec2/*.sh \
     ec2-user@<EC2_PUBLIC_IP>:/opt/isms/
   
   # Then on EC2, run deploy
   ssh -i your-key.pem ec2-user@<EC2_PUBLIC_IP>
   cd /opt/isms
   sudo chown -R isms:isms /opt/isms
   sudo -u isms ./infrastructure/ec2/deploy.sh --no-cache
   ```

#### Method 3: Git-Based Deployment (Only if Git is Configured)

**Note:** This only works if your EC2 instance has Git access to the repository (e.g., public repo, SSH keys configured, or GitHub token).

1. **SSH into the EC2 instance:**
   ```bash
   ssh -i your-key.pem ec2-user@<EC2_PUBLIC_IP>
   ```

2. **Navigate to the application directory:**
   ```bash
   cd /opt/isms
   ```

3. **Run the deployment script with `--pull` flag:**
   ```bash
   sudo -u isms ./infrastructure/ec2/deploy.sh --pull
   ```

   This will:
   - Attempt to pull the latest code from Git (fails gracefully if Git isn't available)
   - **Automatically rebuild images without cache** (ensures all changes are included)
   - Read the VERSION file and update VITE_APP_VERSION in .env
   - Create a database backup (automatic)
   - Build new Docker images
   - Run database migrations
   - Restart all services
   - Verify health checks

   **Important:** The `--pull` flag automatically uses `--no-cache` to ensure Docker doesn't use cached layers. If Git pull fails (no access), the script continues and still rebuilds without cache.

#### Method 4: Manual Code Update (Alternative)

This is the same as Method 1 above. Use SCP/rsync to copy files, then run deploy with `--no-cache`.

#### Deployment Options

The `deploy.sh` script supports several options and can run in two modes:

**Local Mode (Recommended - from your machine):**
```bash
# Automated deployment from local machine (copies files and deploys)
./infrastructure/ec2/deploy.sh \
  --ec2-host 18.171.58.205 \
  --ec2-user ec2-user \
  --ec2-ssh-key ~/.ssh/mark.braybrook-sandbox.pem \
  --no-cache

# Or use environment variables
export EC2_HOST=18.171.58.205
export EC2_USER=ec2-user
export EC2_SSH_KEY=~/.ssh/mark.braybrook-sandbox.pem
./infrastructure/ec2/deploy.sh --no-cache
```

**Remote Mode (on EC2 instance):**
```bash
# After copying files via SCP/rsync, rebuild without cache
sudo -u isms ./infrastructure/ec2/deploy.sh --no-cache

# If Git is configured, pull and deploy (automatically rebuilds without cache)
sudo -u isms ./infrastructure/ec2/deploy.sh --pull

# Force rebuild without cache (useful if changes aren't appearing)
sudo -u isms ./infrastructure/ec2/deploy.sh --no-cache

# Skip database backup (not recommended for production)
sudo -u isms ./infrastructure/ec2/deploy.sh --skip-backup

# Skip database migrations (use only if no schema changes)
sudo -u isms ./infrastructure/ec2/deploy.sh --skip-migrate

# Skip building images (use existing images)
sudo -u isms ./infrastructure/ec2/deploy.sh --no-build

# Combine options
sudo -u isms ./infrastructure/ec2/deploy.sh --pull --skip-backup
```

**Important Notes:**
- **Most EC2 instances don't have Git access** - Use Method 1 (SCP/rsync) instead
- The `--pull` flag only works if Git is configured and has repository access
- Both `--pull` and `--no-cache` force fresh builds without Docker cache
- If you copy files via SCP/rsync, use `--no-cache` (not `--pull`)
- If you're not seeing expected changes, always use `--no-cache` to force a fresh build

#### What Happens During Deployment

The deployment script performs these steps in order:

1. **Pull Latest Code** (if `--pull` flag is used and Git is available)
   - Attempts to update code from Git repository
   - Fails gracefully if Git isn't configured or accessible
   - **Note:** Most deployments use SCP/rsync instead (see Method 1 above)

2. **Database Backup** (unless `--skip-backup`)
   - Creates timestamped backup: `backups/backup-YYYYMMDD-HHMMSS.sql.gz`
   - Keeps last 7 backups, removes older ones

3. **Build Docker Images** (unless `--no-build`)
   - Builds all services: backend, frontend, document-service, ai-service
   - Uses Docker Compose with buildx

4. **Stop Services**
   - Gracefully stops all running containers

5. **Database Migrations** (unless `--skip-migrate`)
   - Starts PostgreSQL container
   - Waits for database to be ready
   - Runs Prisma migrations

6. **Start Services**
   - Starts all containers in detached mode

7. **Health Checks**
   - Verifies backend health endpoint
   - Verifies frontend health endpoint
   - Reloads Nginx configuration

#### Verifying the Deployment

After deployment, verify everything is working:

```bash
# Check service status
docker-compose -f docker-compose.ec2.yml ps

# Check service health
curl http://localhost/api/health
curl http://localhost/health

# View logs
docker-compose -f docker-compose.ec2.yml logs -f

# Check specific service logs
docker-compose -f docker-compose.ec2.yml logs -f backend
docker-compose -f docker-compose.ec2.yml logs -f frontend
```

#### Rolling Back a Deployment

If a deployment fails or causes issues:

1. **Stop the services:**
   ```bash
   cd /opt/isms
   docker compose -f docker-compose.ec2.yml down
   ```

2. **Restore from backup:**
   ```bash
   # List available backups
   ls -lh backups/
   
   # Restore database (replace with actual backup filename)
   gunzip < backups/backup-YYYYMMDD-HHMMSS.sql.gz | \
     docker exec -i isms-postgres-ec2 pg_restore -U postgres -d isms_db -c
   ```

3. **Revert code changes:**
   ```bash
   # If using Git
   cd /opt/isms
   git checkout <previous-commit-hash>
   sudo -u isms ./infrastructure/ec2/deploy.sh --no-build
   ```

4. **Or rebuild from previous code:**
   ```bash
   cd /opt/isms
   sudo -u isms ./infrastructure/ec2/deploy.sh
   ```

#### Best Practices

1. **Always backup before deploying:**
   - The script does this automatically, but verify backups exist

2. **Test in staging first:**
   - Deploy to a staging environment before production

3. **Monitor during deployment:**
   - Watch logs in another terminal: `docker-compose -f docker-compose.ec2.yml logs -f`

4. **Deploy during low-traffic periods:**
   - Services will be briefly unavailable during restart

5. **Keep deployment window small:**
   - The entire process typically takes 5-10 minutes

6. **Verify health checks:**
   - Ensure all services pass health checks before considering deployment complete

### Database Backups

Manual backup:
```bash
cd /opt/isms
sudo -u isms ./infrastructure/ec2/backup.sh --s3-bucket your-bucket
```

Restore from backup:
```bash
# Stop services
docker-compose -f docker-compose.ec2.yml down

# Restore database
gunzip < backups/backup-YYYYMMDD-HHMMSS.sql.gz | \
  docker exec -i isms-postgres-ec2 pg_restore -U postgres -d isms_db -c

# Start services
docker-compose -f docker-compose.ec2.yml up -d
```

### Viewing Logs

```bash
# All services
docker compose -f docker-compose.ec2.yml logs -f

# Specific service
docker compose -f docker-compose.ec2.yml logs -f backend

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Monitoring

View CloudWatch logs:
```bash
aws logs tail /ecs/isms-ec2-backend --follow --region eu-west-2
```

## Troubleshooting

### Services Not Starting

1. **Check Docker logs:**
   ```bash
   docker-compose -f docker-compose.ec2.yml logs
   ```

2. **Check resource usage:**
   ```bash
   docker stats
   free -h
   df -h
   ```

3. **Check health endpoints:**
   ```bash
   curl http://localhost:4000/api/health
   curl http://localhost/health
   ```

### Database Connection Issues

1. **Check PostgreSQL container:**
   ```bash
   docker ps | grep postgres
   docker logs isms-postgres-ec2
   ```

2. **Test connection:**
   ```bash
   docker exec -it isms-postgres-ec2 psql -U postgres -d isms_db
   ```

### SSL Certificate Issues

1. **Check certificate status:**
   ```bash
   sudo certbot certificates
   ```

2. **Test renewal:**
   ```bash
   sudo certbot renew --dry-run
   ```

3. **Check Nginx SSL config:**
   ```bash
   sudo nginx -t
   sudo cat /etc/nginx/conf.d/ssl.conf
   ```

### High Resource Usage

1. **Check resource limits in docker-compose.ec2.yml**
2. **Monitor with:**
   ```bash
   docker stats
   htop
   ```
3. **Consider upgrading instance type** (t3.medium → t3.large)

### Out of Disk Space

The deployment script now automatically checks disk space and cleans up before deployment. However, if you're still running out of space:

1. **Check disk usage:**
   ```bash
   df -h
   docker system df
   ```

2. **Manual cleanup:**
   ```bash
   # Remove old backups (keeping last 3)
   ls -t /opt/isms/backups/backup-*.sql.gz | tail -n +4 | xargs rm -f
   
   # Clean Docker (removes unused containers, images, build cache, volumes)
   docker system prune -a --volumes -f
   
   # Remove old images for services (keeps latest)
   docker images --format "{{.Repository}}:{{.Tag}}" | \
     grep -E "isms-(backend|frontend|document-service|ai-service)" | \
     grep -v "latest" | xargs docker rmi -f
   
   # Clean build cache (frees significant space)
   docker builder prune -f
   ```

**Automatic Cleanup:**
The deployment script automatically:
- Checks disk usage before deployment
- Cleans up if usage is ≥80%
- Removes old backups (keeps last 5)
- Removes old Docker images before building
- Cleans build cache after no-cache builds
- Removes dangling images after builds

**Disk Space Optimization Tips:**
1. **Use `--no-cache` sparingly**: It uses more space during builds but cleans up after
2. **Monitor backups**: Old backups can accumulate - the script keeps last 5
3. **Check Docker images**: Old image versions can take significant space

## Scaling Considerations

### When to Scale Up

Consider upgrading to ECS deployment if:
- **Traffic**: > 1000 requests/minute consistently
- **Users**: > 50 concurrent users
- **Uptime**: Need 99.9%+ SLA
- **Features**: Need auto-scaling, blue/green deployments

### Migration Path to ECS

1. Export database from EC2 PostgreSQL
2. Import to Aurora Serverless v2
3. Build and push images to ECR
4. Deploy ECS services using existing CloudFormation templates
5. Update DNS to point to ALB
6. Decommission EC2 instance

## Security Best Practices

1. **Restrict SSH access:**
   - Update security group to allow only your IP
   - Use SSH key pairs (no passwords)

2. **Keep system updated:**
   - Automatic security updates are enabled
   - Monitor for security advisories

3. **Secrets management:**
   - Use AWS Secrets Manager for production
   - Rotate secrets regularly
   - Never commit .env files

4. **Network security:**
   - Use security groups to restrict access
   - Enable VPC flow logs
   - Monitor CloudWatch for suspicious activity

5. **Backup encryption:**
   - Enable S3 bucket encryption
   - Use IAM policies to restrict backup access

## Cost Optimization Tips

1. **Use Reserved Instances:**
   - 30-40% savings for 1-year commitment
   - 50-60% savings for 3-year commitment

2. **Use Spot Instances (non-critical):**
   - Up to 90% savings
   - Not recommended for production

3. **Optimize CloudWatch Logs:**
   - Set retention policies (7 days)
   - Use log filters to reduce volume

4. **S3 Backup Lifecycle:**
   - Move old backups to Glacier
   - Delete backups older than retention policy

5. **Right-size instance:**
   - Start with t3.medium
   - Monitor and adjust based on usage
   - Use CloudWatch metrics to guide decisions

## Support and Resources

- **Application Documentation**: See main README.md
- **Infrastructure Documentation**: See infrastructure/README.md
- **Docker Compose**: See docker-compose.ec2.yml
- **AWS Documentation**: https://docs.aws.amazon.com/

## Common Issues and Solutions

### Issue: Docker Compose command not found or requires buildx

**Solution:**

For Amazon Linux 2023:
```bash
# Install standalone docker-compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install buildx (required for Docker Compose v5)
sudo mkdir -p /usr/libexec/docker/cli-plugins
sudo curl -SL https://github.com/docker/buildx/releases/download/v0.17.1/buildx-v0.17.1.linux-amd64 -o /usr/libexec/docker/cli-plugins/docker-buildx
sudo chmod +x /usr/libexec/docker/cli-plugins/docker-buildx
sudo systemctl restart docker

# Create builder instance
docker buildx create --name builder
docker buildx use builder
docker buildx inspect --bootstrap builder
```

For Ubuntu:
```bash
# Install Docker Compose plugin
sudo apt-get install docker-compose-plugin docker-buildx-plugin
```

### Issue: Permission denied errors

**Solution:**
```bash
# Ensure user is in docker group
sudo usermod -aG docker isms
# Log out and back in
```

### Issue: SSL certificate renewal fails

**Solution:**
- Ensure domain DNS points to EC2 instance
- Check firewall allows HTTP (port 80) for ACME challenge
- Verify Nginx is running and accessible

### Issue: Database migrations fail

**Solution:**
- Ensure PostgreSQL container is running
- Check DATABASE_URL in .env file
- Verify database credentials
- Check container logs: `docker logs isms-postgres-ec2`

## Next Steps

1. Set up automated deployments (GitHub Actions or CodePipeline)
2. Configure CloudWatch dashboards
3. Set up alerting (SNS topics for critical alarms)
4. Document runbooks for common issues
5. Plan scaling strategy if traffic grows



