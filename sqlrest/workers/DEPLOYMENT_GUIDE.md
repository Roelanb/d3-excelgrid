# SQL REST API - Cloudflare Workers Deployment Guide

This guide walks you through deploying your SQL REST API from .NET to Cloudflare Workers.

## Overview

The original .NET SQL REST API has been successfully converted to TypeScript for Cloudflare Workers. This migration provides:

- **Global Edge Deployment**: Automatic scaling across 275+ cities
- **Serverless Architecture**: No servers to manage or patch
- **Cost Efficiency**: Pay-per-request with generous free tier
- **Performance**: Sub-50ms cold starts, 10-50ms request processing
- **D1 Database**: Built-in SQLite with automatic backups

## Prerequisites

1. **Cloudflare Account**: Free account at https://cloudflare.com
2. **Node.js 18+**: Download from https://nodejs.org
3. **Wrangler CLI**: Cloudflare's command-line tool
4. **Git**: For version control

## Quick Start

### 1. Setup Development Environment

```bash
# Navigate to workers directory
cd sqlrest/workers

# Run the development setup script
./setup-dev.sh

# Start development server
./dev-start.sh
```

### 2. Test Locally

```bash
# Run API tests
./dev-test.sh

# Or use the test.http file with VS Code REST Client
```

### 3. Deploy to Production

```bash
# Deploy to Cloudflare Workers
./deploy.sh
```

## Manual Deployment Steps

If you prefer manual setup instead of the automated scripts:

### Step 1: Install Dependencies

```bash
cd workers
npm install
```

### Step 2: Configure Wrangler

Edit `wrangler.toml`:

```toml
name = "sqlrest-api"
main = "src/index.ts"
compatibility_date = "2023-12-18"

[vars]
JWT_ISSUER = "SqlRestApi"
JWT_AUDIENCE = "SqlRestApi"
JWT_EXPIRY_MINUTES = "60"
CORS_ORIGINS = "https://yourapp.com"

# For D1 database
[[d1_databases]]
binding = "DB"
database_name = "sqlrest-db"
database_id = "your-database-id"
```

### Step 3: Create D1 Database

```bash
# Create database
wrangler d1 create sqlrest-db

# Note the database ID and update wrangler.toml

# Apply schema
wrangler d1 execute sqlrest-db --file=./schema.sql
```

### Step 4: Set Secrets

```bash
# Generate secure JWT secret
openssl rand -base64 32

# Set secrets
wrangler secret put JWT_KEY
wrangler secret put AUTH_USERNAME
wrangler secret put AUTH_PASSWORD

# Optional: External database connection
wrangler secret put DB_CONNECTION_STRING
```

### Step 5: Deploy

```bash
# Deploy to Workers
wrangler deploy

# Test deployment
curl https://your-worker.your-subdomain.workers.dev/api/health
```

## Database Migration

### Option 1: Start Fresh with D1 (Recommended)

Use the provided `schema.sql` to create a new database with sample data.

### Option 2: Migrate from SQL Server

1. **Export Data**:
```bash
# Export from SQL Server to CSV
sqlcmd -S your-server -d your-database -Q "SELECT * FROM your_table" -o your_table.csv -s","
```

2. **Convert to SQLite**:
```bash
# Use conversion tools or write migration scripts
# Consider using SQLite conversion tools or custom scripts
```

3. **Import to D1**:
```bash
# Create import SQL
wrangler d1 execute sqlrest-db --file=./import.sql
```

## Environment Configuration

### Development

Use `wrangler.dev.toml` for development settings:

```toml
name = "sqlrest-api-dev"
# Development-specific settings
```

### Production

Use `wrangler.toml` for production:

```toml
name = "sqlrest-api"
# Production-specific settings
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_ISSUER` | JWT token issuer | `SqlRestApi` |
| `JWT_AUDIENCE` | JWT token audience | `SqlRestApi` |
| `JWT_EXPIRY_MINUTES` | Token expiration in minutes | `60` |
| `CORS_ORIGINS` | Allowed CORS origins | `localhost URLs` |

### Secrets

| Secret | Description | Required |
|--------|-------------|----------|
| `JWT_KEY` | JWT signing secret (32+ chars) | ✅ |
| `AUTH_USERNAME` | API username | ✅ |
| `AUTH_PASSWORD` | API password | ✅ |
| `DB_CONNECTION_STRING` | External SQL connection | ❌ (if using D1) |

## API Endpoint Mapping

The Workers version maintains the same API structure:

| .NET Endpoint | Workers Endpoint | Status |
|---------------|------------------|--------|
| `GET /api/health` | `GET /api/health` | ✅ |
| `POST /api/auth/login` | `POST /api/auth/login` | ✅ |
| `GET /api/tables` | `GET /api/tables` | ✅ |
| `GET /api/{schema}/{table}` | `GET /api/{schema}/{table}` | ✅ |
| `POST /api/{schema}/{table}` | `POST /api/{schema}/{table}` | ✅ |
| `PUT /api/{schema}/{table}/{id}` | `PUT /api/{schema}/{table}/{id}` | ✅ |
| `DELETE /api/{schema}/{table}/{id}` | `DELETE /api/{schema}/{table}/{id}` | ✅ |

## Testing

### Local Testing

```bash
# Start dev server
wrangler dev

# Test endpoints
curl http://localhost:8787/api/health

# Run test suite
./dev-test.sh
```

### Production Testing

```bash
# Test health
curl https://your-worker.workers.dev/api/health

# Get JWT token
curl -X POST https://your-worker.workers.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"your_user","password":"your_pass"}'

# Test protected endpoint
curl https://your-worker.workers.dev/api/tables \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Monitoring and Debugging

### View Logs

```bash
# Real-time logs
wrangler tail

# Filter logs
wrangler tail --format=json | jq '.level == "error"'
```

### Performance Monitoring

```bash
# View analytics
wrangler analytics

# Check response times
curl -w "@curl-format.txt" https://your-worker.workers.dev/api/health
```

## Security Considerations

1. **JWT Security**: Use strong secrets (32+ characters)
2. **CORS Configuration**: Restrict to your domains in production
3. **Database Access**: Use least-privilege database users
4. **HTTPS**: Workers automatically handles HTTPS
5. **Rate Limiting**: Consider adding rate limiting middleware

## Troubleshooting

### Common Issues

1. **JWT Token Errors**:
   - Check JWT_KEY secret
   - Verify token expiration
   - Ensure correct issuer/audience

2. **Database Connection Issues**:
   - Verify D1 database binding
   - Check external connection string
   - Test with `wrangler d1 execute`

3. **CORS Errors**:
   - Update CORS_ORIGINS variable
   - Check preflight requests
   - Verify allowed headers

4. **Deployment Failures**:
   - Check wrangler authentication
   - Verify wrangler.toml syntax
   - Review deployment logs

### Debug Mode

Add debugging to your Workers:

```typescript
// In src/index.ts
app.use('/*', async (c, next) => {
  console.log('Request:', c.req.method, c.req.url);
  await next();
  console.log('Response:', c.res.status);
});
```

## Performance Optimization

1. **Database Indexing**: Add indexes to frequently queried columns
2. **Caching**: Implement edge caching for read-heavy endpoints
3. **Pagination**: Always use pagination for large datasets
4. **Query Optimization**: Use efficient SQL queries

## Scaling and Costs

### Free Tier Limits

- **Requests**: 100,000 requests/day
- **CPU Time**: 10ms CPU time per request
- **Memory**: 128MB per request
- **D1**: 5GB storage, 25M reads/day

### Scaling Beyond Free Tier

- **Workers Paid**: $5/month for 10M requests
- **D1 Paid**: $0.75 per million reads, $0.50 per GB storage
- **Bundled**: Workers Paid includes D1 usage

## Migration Checklist

- [ ] Install Wrangler CLI
- [ ] Create Cloudflare account
- [ ] Set up development environment
- [ ] Create D1 database
- [ ] Apply database schema
- [ ] Configure environment variables
- [ ] Set secrets
- [ ] Deploy to Workers
- [ ] Test all endpoints
- [ ] Update client applications
- [ ] Monitor production logs
- [ ] Set up alerts and monitoring

## Support Resources

- **Cloudflare Workers Documentation**: https://developers.cloudflare.com/workers/
- **D1 Documentation**: https://developers.cloudflare.com/d1/
- **Wrangler CLI Reference**: https://developers.cloudflare.com/workers/wrangler/
- **Hono Framework**: https://hono.dev/

## Next Steps

1. **Monitor Performance**: Set up monitoring and alerting
2. **Add Features**: Implement additional endpoints as needed
3. **Optimize**: Add caching and performance optimizations
4. **Scale**: Configure additional environments (staging, etc.)
5. **Documentation**: Update API documentation for your users

Congratulations! Your SQL REST API is now running on Cloudflare Workers with global edge deployment and automatic scaling.
