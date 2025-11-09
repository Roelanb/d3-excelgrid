# SQL REST API - Cloudflare Workers

A secure TypeScript REST API for Cloudflare Workers that provides dynamic CRUD operations for SQL databases.

## 🚀 Features

- **🌐 Global Edge Deployment** - Automatic scaling across 275+ cities
- **🔐 JWT Authentication** - Secure API access with Bearer token authentication
- **🛡️ SQL Injection Protection** - Parameterized queries and input validation
- **📊 Dynamic Endpoints** - Automatically discovers database tables and generates CRUD endpoints
- **🗄️ D1 Database Support** - Built-in SQLite database with automatic backups
- **📱 Pagination & Search** - Built-in pagination and search functionality
- **🔍 Swagger Documentation** - Auto-generated API documentation
- **⚡ High Performance** - Sub-50ms cold starts, 10-50ms request processing

## 📁 Project Structure

```
sqlrest/
├── workers/                    # Cloudflare Workers implementation
│   ├── src/
│   │   ├── index.ts           # Main Workers application
│   │   ├── types.ts           # Shared TypeScript types
│   │   ├── services/
│   │   │   └── database.ts    # Database service with D1/SQL support
│   │   └── endpoints/
│   │       ├── auth.ts        # JWT authentication endpoints
│   │       └── dynamic-crud.ts# Dynamic CRUD endpoints
│   ├── schema.sql             # Sample database schema
│   ├── test.http              # API test file
│   ├── wrangler.toml          # Cloudflare Workers configuration
│   └── package.json           # Dependencies and scripts
├── .env                       # Environment variables
└── .env.example               # Environment variables template
```

## 🛠️ Quick Start

### 1. Prerequisites

- Node.js 18+
- Cloudflare account (free)
- Wrangler CLI

### 2. Setup Development Environment

```bash
cd sqlrest/workers
npm install
./setup-dev.sh
```

### 3. Start Development Server

```bash
# Start Workers API
npm run dev

# Start Excel Grid (in another terminal)
cd ../excel-grid
pnpm dev
```

### 4. Test the API

```bash
# Health check
curl http://localhost:8787/api/health

# Login
curl -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'

# Get tables (with token)
curl http://localhost:8787/api/tables \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 📚 API Documentation

### Authentication

All endpoints (except health and login) require JWT authentication.

**Login Endpoint:**
```bash
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 3600,
  "tokenType": "Bearer"
}
```

### Dynamic CRUD Endpoints

For each database table, the following endpoints are automatically generated:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/{schema}/{table}` | Get paginated records |
| GET | `/api/{schema}/{table}/{id}` | Get specific record |
| POST | `/api/{schema}/{table}` | Create new record |
| PUT | `/api/{schema}/{table}/{id}` | Update record |
| DELETE | `/api/{schema}/{table}/{id}` | Delete record |

### Query Parameters

- `page` (default: 1) - Page number
- `pageSize` (default: 100, max: 1000) - Records per page
- `search` - Search across text columns

### Example Requests

```bash
# Get all customers with pagination
GET /api/main/customers?page=1&pageSize=10

# Search customers
GET /api/main/customers?search=john

# Create new customer
POST /api/main/customers
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "555-1234"
}

# Update customer
PUT /api/main/customers/1
{
  "phone": "555-9999"
}
```

## 🗄️ Database Setup

### Option 1: Cloudflare D1 (Recommended)

```bash
# Create D1 database
wrangler d1 create sqlrest-db

# Apply schema
wrangler d1 execute sqlrest-db --file=./schema.sql
```

### Option 2: External SQL Server

Set the `DB_CONNECTION_STRING` secret to connect to external SQL Server.

## 🔧 Configuration

### Environment Variables

Create `.dev.vars` for local development:

```bash
# JWT Secret Key (32+ characters)
JWT_KEY=your-secure-secret-key-here

# Authentication
AUTH_USERNAME=your_username
AUTH_PASSWORD=your_password

# Optional: External database
# DB_CONNECTION_STRING=Server=...;Database=...;
```

### wrangler.toml

```toml
name = "sqlrest-api"
main = "src/index.ts"
compatibility_date = "2023-12-18"

[vars]
JWT_ISSUER = "SqlRestApi"
JWT_AUDIENCE = "SqlRestApi"
JWT_EXPIRY_MINUTES = "60"
CORS_ORIGINS = "http://localhost:5173"

[[d1_databases]]
binding = "DB"
database_name = "sqlrest-db"
database_id = "your-database-id"
```

## 🚀 Deployment

### Development

```bash
npm run dev
```

### Production

```bash
# Deploy to Workers
npm run deploy

# Set production secrets
wrangler secret put JWT_KEY
wrangler secret put AUTH_USERNAME
wrangler secret put AUTH_PASSWORD
```

### Automated Deployment

```bash
# Use the automated deployment script
./deploy.sh
```

## 🧪 Testing

### Using REST Client

Use the provided `test.http` file with VS Code REST Client extension:

1. Open `test.http`
2. Run the login request to get a token
3. Replace `YOUR_TOKEN_HERE` with the actual token
4. Run other requests to test the API

### Manual Testing

```bash
# Test all endpoints
curl http://localhost:8787/api/health
curl -X POST http://localhost:8787/api/auth/login -d '{"username":"admin","password":"admin"}'
curl http://localhost:8787/api/tables -H "Authorization: Bearer TOKEN"
```

## 🔍 Monitoring

### View Logs

```bash
# Real-time logs
wrangler tail

# Filter errors
wrangler tail --format=json | jq '.level == "error"'
```

### Performance Monitoring

```bash
# View analytics
wrangler analytics
```

## 🔒 Security

- **JWT Authentication** with configurable expiration
- **Parameterized Queries** prevent SQL injection
- **CORS Configuration** for cross-origin requests
- **Input Validation** on all endpoints
- **HTTPS Only** in production

## 📈 Performance

- **Cold Start**: ~50ms
- **Request Processing**: 10-50ms
- **Global Latency**: Edge deployment reduces latency worldwide
- **Auto-scaling**: Handles traffic spikes automatically

## 💰 Pricing

### Free Tier (Monthly)
- 100,000 requests
- 10ms CPU time per request
- 5GB D1 storage
- 25M D1 reads

### Paid Tier
- $5/month for 10M requests
- $0.50 per million additional requests
- D1: $0.75 per million reads, $0.50 per GB storage

## 🆘 Support

### Common Issues

1. **JWT Token Invalid**: Check JWT_KEY secret and token expiration
2. **Database Connection**: Verify D1 binding or connection string
3. **CORS Errors**: Update CORS_ORIGINS environment variable
4. **Deployment Failures**: Check wrangler authentication and configuration

### Debug Mode

Add logging to Workers:
```typescript
console.log('Request:', c.req.url);
console.log('Response:', c.res.status);
```

### Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [D1 Database Documentation](https://developers.cloudflare.com/d1/)
- [Hono Framework Documentation](https://hono.dev/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)

## 📝 License

MIT License - See LICENSE file for details.

---

**Ready to go!** Your SQL REST API is now running on Cloudflare Workers with global edge deployment and automatic scaling.
