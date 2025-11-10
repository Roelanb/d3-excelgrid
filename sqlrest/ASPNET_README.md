# SQL REST API - ASP.NET Core

A secure ASP.NET Core REST API that provides dynamic CRUD operations for SQL Server databases with JWT authentication.

## Features

- **JWT Authentication** - Secure API access with Bearer token authentication
- **Dynamic CRUD Endpoints** - Automatically generates endpoints for all database tables
- **SQL Server Support** - Direct connection to Azure SQL or SQL Server databases
- **FastEndpoints** - High-performance endpoint routing
- **Swagger Documentation** - Auto-generated API documentation
- **CORS Support** - Configurable cross-origin resource sharing

## Project Structure

```
sqlrest/
├── Program.cs                      # Application entry point
├── SqlRest.csproj                  # Project configuration
├── Services/
│   └── DatabaseService.cs          # Database operations service
├── Endpoints/
│   ├── AuthEndpoint.cs             # Authentication endpoints
│   └── DynamicCrudEndpoints.cs     # CRUD endpoints
├── appsettings.example.json        # Configuration template
└── .env                            # Environment variables (gitignored)
```

## Quick Start

### 1. Prerequisites

- .NET 9.0 SDK
- SQL Server or Azure SQL Database
- Visual Studio Code or Visual Studio

### 2. Configuration

Copy `.env.example` to `.env` and configure your database:

```bash
DB_SERVER=your-server.database.windows.net
DB_NAME=AdventureWorks2022
DB_USER=sqladmin
DB_PASSWORD=your-password
DB_TRUST_CERT=true

JWT_KEY=your-secret-jwt-key-at-least-32-characters-long
JWT_ISSUER=SqlRestApi
JWT_AUDIENCE=SqlRestApi
JWT_EXPIRY_MINUTES=60

AUTH_USERNAME=admin
AUTH_PASSWORD=admin

CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,https://excel-grid.bart-c9c.workers.dev
```

### 3. Run Locally

```bash
cd sqlrest
dotnet restore
dotnet run
```

The API will be available at `http://localhost:5000`

### 4. Test the API

```bash
# Health check
curl http://localhost:5000/api/health

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'

# Get tables (with token from login)
curl http://localhost:5000/api/tables \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## API Endpoints

### Authentication

**POST /api/auth/login**
```json
{
  "username": "admin",
  "password": "admin"
}
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 3600,
  "tokenType": "Bearer"
}
```

### Dynamic CRUD Endpoints

For each database table, the following endpoints are automatically available:

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
- `search` - Search across columns

## Deployment to Azure

### Using GitHub Actions

The project includes a GitHub Actions workflow (`.github/workflows/deploy-azure.yml`) that automatically deploys to Azure Web Apps when you push to the `master` branch.

#### Required GitHub Secrets

Configure these in GitHub → Repository Settings → Secrets:

| Secret | Description |
|--------|-------------|
| `AZURE_CLIENT_ID` | Azure Service Principal Client ID |
| `AZURE_TENANT_ID` | Azure Tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Azure Subscription ID |
| `DB_SERVER` | SQL Server address |
| `DB_NAME` | Database name |
| `DB_USER` | Database username |
| `DB_PASSWORD` | Database password |
| `DB_TRUST_CERT` | Trust server certificate (`true`) |
| `JWT_KEY` | JWT signing secret (32+ characters) |
| `AUTH_USERNAME` | API admin username |
| `AUTH_PASSWORD` | API admin password |

### Manual Deployment

```bash
# Build for production
dotnet publish --configuration Release --output ./publish

# Deploy to Azure (requires Azure CLI)
az webapp deploy --resource-group your-rg \
  --name restapi-excelgrid \
  --src-path ./publish
```

## Development

### Build

```bash
dotnet build
```

### Run with hot reload

```bash
dotnet watch run
```

### View Swagger Documentation

Navigate to `http://localhost:5000/swagger` when running locally.

## Security

- **JWT Authentication** with configurable expiration
- **Parameterized Queries** prevent SQL injection
- **CORS Configuration** for cross-origin requests
- **HTTPS Only** in production (enforced by Azure)
- **Environment Variables** for sensitive configuration

## Troubleshooting

### Database Connection Issues

1. Verify database server address and credentials
2. Check firewall rules allow connections from your IP
3. Ensure `TrustServerCertificate=true` for Azure SQL

### JWT Token Invalid

1. Check `JWT_KEY` is at least 32 characters
2. Verify token hasn't expired
3. Ensure `JWT_ISSUER` and `JWT_AUDIENCE` match configuration

### CORS Errors

Update `CORS_ALLOWED_ORIGINS` to include your frontend URL.

## Production URL

Once deployed to Azure, your API will be available at:
`https://restapi-excelgrid.azurewebsites.net`

## License

MIT License
