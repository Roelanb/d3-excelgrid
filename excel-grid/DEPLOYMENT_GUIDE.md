# Excel Grid Deployment Guide

## 🚀 Deploying Excel Grid to Cloudflare Workers

This guide shows how to deploy the Excel Grid to Cloudflare Workers and configure it to connect to your SQL REST API.

## 📋 Prerequisites

- Cloudflare account
- Wrangler CLI installed and authenticated
- SQL REST API already deployed
- Built Excel Grid application

## 🔧 Configuration

### 1. Set API Endpoint

Update the `VITE_API_BASE_URL` in your `wrangler.toml`:

```toml
[vars]
VITE_API_BASE_URL = "https://your-api-subdomain.workers.dev"
```

**Options:**

- **Production API**: Your deployed Workers API URL
- **Development API**: `http://localhost:8787` (for local testing)
- **Staging API**: Your staging environment URL

### 2. Environment-Specific Configuration

For different environments, you can use separate configurations:

```toml
# Production
[env.production.vars]
VITE_API_BASE_URL = "https://sqlrest-api-production.your-subdomain.workers.dev"

# Staging  
[env.staging.vars]
VITE_API_BASE_URL = "https://sqlrest-api-staging.your-subdomain.workers.dev"

# Development
[env.dev.vars]
VITE_API_BASE_URL = "http://localhost:8787"
```

## 📦 Deployment Steps

### 1. Build the Application

```bash
cd excel-grid
pnpm build
```

### 2. Deploy to Workers

```bash
# Deploy to production
wrangler deploy

# Deploy to specific environment
wrangler deploy --env production
wrangler deploy --env staging
```

### 3. Verify Deployment

```bash
# Check your deployed Workers
wrangler whoami
wrangler deployments list
```

## 🌐 Environment Configuration

### Production Deployment

1. **Deploy your SQL API first:**
```bash
cd sqlrest/workers
npm run deploy
```

2. **Get your API URL:**
```bash
# The deployment will show your URL
# Example: https://sqlrest-api-abc123.your-subdomain.workers.dev
```

3. **Update Excel Grid configuration:**
```toml
[vars]
VITE_API_BASE_URL = "https://sqlrest-api-abc123.your-subdomain.workers.dev"
```

4. **Deploy Excel Grid:**
```bash
cd excel-grid
pnpm build
wrangler deploy
```

### Development Setup

For local development with remote API:

```toml
[env.dev.vars]
VITE_API_BASE_URL = "https://your-production-api.workers.dev"
```

Deploy with:
```bash
wrangler deploy --env dev
```

## 🔍 Testing the Deployment

### 1. Health Check

```bash
curl https://your-excel-grid.workers.dev/api/health
```

### 2. API Connectivity

Check the browser console to verify API calls are working:
- Open your deployed Excel Grid
- Open browser dev tools (F12)
- Check Network tab for API requests
- Verify requests are going to the correct API endpoint

### 3. Authentication Test

Try logging in to verify the API connection:
1. Navigate to your deployed Excel Grid
2. Attempt to login with your API credentials
3. Check if authentication succeeds

## 🛠️ Common Issues

### CORS Errors

If you get CORS errors, update your API's CORS configuration:

```bash
cd sqlrest/workers
# Update wrangler.toml CORS_ORIGINS
CORS_ORIGINS = "https://your-excel-grid.workers.dev,https://your-excel-grid.pages.dev"

# Redeploy API
npm run deploy
```

### API Not Found

404 errors indicate incorrect API URL:

1. Verify your API is deployed and working
2. Check the URL in `wrangler.toml` matches your API URL
3. Ensure the API endpoint is accessible

### Environment Variables Not Working

If environment variables aren't being applied:

1. Check variables are in `[vars]` section of `wrangler.toml`
2. Redeploy after changing configuration
3. Verify with `wrangler secret list` or `wrangler kv:namespace list`

## 📊 Multiple Environments

### Setup

```bash
# Production
wrangler deploy --env production

# Staging
wrangler deploy --env staging  

# Development
wrangler deploy --env dev
```

### URLs

- **Production**: `https://excel-grid.your-subdomain.workers.dev`
- **Staging**: `https://excel-grid-staging.your-subdomain.workers.dev`
- **Development**: `https://excel-grid-dev.your-subdomain.workers.dev`

## 🔒 Security Configuration

### API Security

Ensure your API has proper authentication:

1. **JWT Secret**: Set strong JWT secret
2. **CORS**: Restrict to your Excel Grid domains
3. **Rate Limiting**: Consider adding rate limiting
4. **HTTPS**: Workers automatically provides HTTPS

### Environment Variables

For sensitive data, use secrets instead of variables:

```bash
# Set secrets (encrypted)
wrangler secret put VITE_API_SECRET_KEY
wrangler secret put VITE_DATABASE_URL
```

## 📈 Monitoring

### Logs

```bash
# View real-time logs
wrangler tail

# View logs for specific environment
wrangler tail --env production
```

### Analytics

```bash
# View usage analytics
wrangler analytics
```

## 🔄 CI/CD Integration

### GitHub Actions

```yaml
name: Deploy Excel Grid
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install pnpm
        run: npm install -g pnpm
      - name: Install dependencies
        run: pnpm install
      - name: Build
        run: pnpm build
      - name: Deploy to Workers
        run: wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

## 🎯 Best Practices

1. **Always test in staging first**
2. **Use environment-specific URLs**
3. **Keep API and Grid versions compatible**
4. **Monitor logs after deployment**
5. **Set up alerts for API failures**
6. **Use custom domains for production**

## 📝 Checklist Before Deployment

- [ ] API is deployed and working
- [ ] API URL is correctly configured
- [ ] CORS is properly set up
- [ ] Environment variables are set
- [ ] Application builds successfully
- [ ] Test authentication works
- [ ] Test API calls work
- [ ] Monitor for errors after deployment

---

Your Excel Grid is now ready for global deployment on Cloudflare Workers! 🚀
