# SQL REST API - Cloudflare Workers

A TypeScript implementation of the SQL REST API for Cloudflare Workers, providing dynamic CRUD endpoints for SQL databases.

## Features

- **🚀 Dynamic Endpoints**: Automatically discovers database tables and generates CRUD endpoints
- **🔐 JWT Authentication**: Secure API access with Bearer token authentication
- **🛡️ SQL Injection Protection**: Parameterized queries and input validation
- **📱 Cloudflare Native**: Built for Cloudflare Workers with D1 database support
- **📄 Pagination**: Built-in pagination support for large datasets
- **🔍 Search**: Parameterized search across text columns
- **🌐 CORS Support**: Configurable cross-origin resource sharing

## Architecture

This Workers version maintains the same API structure as the original .NET version:

- **DatabaseService**: Handles SQL operations and schema discovery
- **AuthEndpoints**: JWT token generation and validation
- **DynamicCrudEndpoints**: Dynamic CRUD endpoint generation
- **Hono Framework**: Fast web framework for Cloudflare Workers

## Database Options

### Option 1: Cloudflare D1 (Recommended)
- Built-in SQLite database
- No external dependencies
- Automatic scaling
- Free tier available

### Option 2: External SQL Server
- Connect to existing SQL Server databases
- Requires TCP socket connections (may need additional setup)
- Better for existing databases

## Setup

### 1. Install Dependencies
```bash
cd workers
npm install
```

### 2. Configure Environment
Copy `wrangler.toml.example` to `wrangler.toml` and update:

```toml
name = "sqlrest-api"
main = "src/index.ts"
compatibility_date = "2023-12-18"

[vars]
JWT_ISSUER = "SqlRestApi"
JWT_AUDIENCE = "SqlRestApi"
JWT_EXPIRY_MINUTES = "60"
CORS_ORIGINS = "http://localhost:5173,https://yourapp.com"
```

### 3. Set Secrets
```bash
# Set JWT secret (32+ characters)
wrangler secret put JWT_KEY

# Set database connection string (if using external SQL)
wrangler secret put DB_CONNECTION_STRING

# Set authentication credentials
wrangler secret put AUTH_USERNAME
wrangler secret put AUTH_PASSWORD
```

### 4. Setup D1 Database (Optional)
```bash
# Create D1 database
wrangler d1 create sqlrest-db

# Add to wrangler.toml
[[d1_databases]]
binding = "DB"
database_name = "sqlrest-db"
database_id = "your-database-id"

# Run migrations (create tables)
wrangler d1 execute sqlrest-db --file=./schema.sql
```

## Database Schema

Create a `schema.sql` file for D1:

```sql
-- Example schema for D1
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price DECIMAL(10,2),
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample data
INSERT INTO customers (name, email, phone) VALUES 
    ('John Doe', 'john@example.com', '555-0101'),
    ('Jane Smith', 'jane@example.com', '555-0102');

INSERT INTO products (name, price, description) VALUES 
    ('Product A', 19.99, 'Description for Product A'),
    ('Product B', 29.99, 'Description for Product B');
```

## Development

### Local Development
```bash
# Start development server
npm run dev

# Test with D1 database
wrangler d1 execute sqlrest-db --command="SELECT * FROM customers"
```

### Testing API Endpoints

1. **Health Check** (Public):
```bash
curl https://your-worker.your-subdomain.workers.dev/api/health
```

2. **Login** (Public):
```bash
curl -X POST https://your-worker.your-subdomain.workers.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"your_username","password":"your_password"}'
```

3. **Get Tables** (Protected):
```bash
curl https://your-worker.your-subdomain.workers.dev/api/tables \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

4. **Get Records** (Protected):
```bash
curl https://your-worker.your-subdomain.workers.dev/api/main/customers \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

5. **Create Record** (Protected):
```bash
curl -X POST https://your-worker.your-subdomain.workers.dev/api/main/customers \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"name":"New Customer","email":"new@example.com","phone":"555-0103"}'
```

## Deployment

### Deploy to Production
```bash
# Deploy to Workers
npm run deploy

# View logs
npm run tail
```

### Environment-Specific Deployment
```bash
# Deploy to production environment
wrangler deploy --env production

# Deploy to staging environment  
wrangler deploy --env staging
```

## API Endpoints

### Public Endpoints
- `GET /api/health` - Health check
- `POST /api/auth/login` - Get JWT token
- `GET /api/auth/validate` - Validate JWT token

### Protected Endpoints (Require JWT)
- `GET /api/tables` - List all available tables
- `GET /api/tables/{schema}/{table}/schema` - Get table schema
- `GET /api/{schema}/{table}` - Get paginated records
- `GET /api/{schema}/{table}/{id}` - Get specific record
- `POST /api/{schema}/{table}` - Create new record
- `PUT /api/{schema}/{table}/{id}` - Update record
- `DELETE /api/{schema}/{table}/{id}` - Delete record

## Query Parameters

### Pagination
- `page` (default: 1) - Page number
- `pageSize` (default: 100, max: 1000) - Records per page

### Search
- `search` - Search across text columns

## Response Format

### Paginated Response
```json
{
  "data": [...],
  "totalCount": 100,
  "page": 1,
  "pageSize": 10,
  "totalPages": 10,
  "hasPrevious": false,
  "hasNext": true
}
```

### Error Response
```json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Detailed error message"
}
```

## Security

- JWT authentication with configurable expiration
- Parameterized queries prevent SQL injection
- CORS configuration for cross-origin requests
- Input validation on all endpoints
- Environment-based configuration

## Migration from .NET Version

1. **Database**: Export data from SQL Server and import to D1 or external SQL
2. **Authentication**: Update JWT secrets and credentials
3. **Configuration**: Migrate appsettings.json to wrangler.toml and secrets
4. **Client Updates**: Update base URL to Workers endpoint

## Performance

- **Cold Start**: ~50ms
- **Request Processing**: ~10-50ms depending on query complexity
- **Concurrent Requests**: Handles thousands of requests automatically
- **Global Distribution**: Edge deployment reduces latency

## Monitoring

```bash
# View real-time logs
wrangler tail

# Check analytics
wrangler analytics

# Monitor errors
wrangler tail --format=json | jq '.level == "error"'
```

## Troubleshooting

### Common Issues

1. **JWT Token Invalid**: Check JWT_KEY secret and token expiration
2. **Database Connection**: Verify DB_CONNECTION_STRING or D1 binding
3. **CORS Errors**: Update CORS_ORIGINS environment variable
4. **Table Not Found**: Ensure tables exist in D1 database

### Debug Mode

Add logging to your Workers:

```typescript
console.log('Request received:', c.req.url);
console.log('Database result:', result);
```

View logs with `wrangler tail`.

## Support

For issues and questions:
1. Check Cloudflare Workers documentation
2. Review D1 database limits and pricing
3. Monitor logs with `wrangler tail`
4. Test locally with `npm run dev`
