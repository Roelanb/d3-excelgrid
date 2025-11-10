# API Migration Summary: Cloudflare Workers → Azure ASP.NET Core

## Changes Made

Successfully switched the Excel Grid application from using Cloudflare Workers API to Azure ASP.NET Core API.

### Files Modified

1. **`excel-grid/wrangler.toml`**
   - Changed `VITE_API_BASE_URL` from `https://sqlrest.bart-c9c.workers.dev` to `https://restapi-excelgrid.azurewebsites.net`

2. **`excel-grid/src/services/authService.ts`**
   - Updated development URL from `http://localhost:8787` (Workers) to `http://localhost:5000` (ASP.NET Core)

3. **`excel-grid/src/services/sqlRestApi.ts`**
   - Updated development URL from `http://localhost:8787` (Workers) to `http://localhost:5000` (ASP.NET Core)

4. **`sqlrest/workers/src/index.ts`**
   - Removed debug code that was exposing environment variables in health endpoint

5. **`sqlrest/workers/src/endpoints/dynamic-crud.ts`**
   - Removed debug code that was exposing environment variables in tables endpoint

## Why the Switch?

**Problem:** Cloudflare Workers cannot directly connect to external SQL Server databases (like Azure SQL) because:
- Workers don't support TCP socket connections
- Workers don't have native SQL Server drivers
- The Workers implementation was designed for Cloudflare D1 (SQLite-based) only

**Solution:** Use the ASP.NET Core API deployed to Azure, which:
- ✅ Can connect directly to Azure SQL Server
- ✅ Has full SQL Server driver support
- ✅ Already deployed and configured with database credentials
- ✅ Has the same API endpoints and authentication

## Production URLs

- **Excel Grid:** `https://excel-grid.bart-c9c.workers.dev` or `https://d3-excel.hideterms.com`
- **API (ASP.NET Core):** `https://restapi-excelgrid.azurewebsites.net`

## Development Setup

### Running Locally

1. **Start ASP.NET Core API:**
   ```bash
   cd sqlrest
   dotnet run
   # API runs on http://localhost:5000
   ```

2. **Start Excel Grid:**
   ```bash
   cd excel-grid
   pnpm dev
   # Grid runs on http://localhost:5173
   # Automatically connects to http://localhost:5000
   ```

## Deployment

### Excel Grid (Cloudflare Pages)
- **Trigger:** Push to `main` branch
- **Workflow:** `.github/workflows/deploy.yml`
- **Deploys to:** `https://excel-grid.bart-c9c.workers.dev`

### ASP.NET Core API (Azure Web App)
- **Trigger:** Push to `master` branch
- **Workflow:** `.github/workflows/deploy-azure.yml`
- **Deploys to:** `https://restapi-excelgrid.azurewebsites.net`

### Required GitHub Secrets (Azure Deployment)

Configure these in GitHub → Repository Settings → Secrets:

| Secret | Description |
|--------|-------------|
| `AZURE_CLIENT_ID` | Azure Service Principal Client ID |
| `AZURE_TENANT_ID` | Azure Tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Azure Subscription ID |
| `DB_SERVER` | SQL Server address (e.g., `server.database.windows.net`) |
| `DB_NAME` | Database name (e.g., `AdventureWorks2022`) |
| `DB_USER` | Database username |
| `DB_PASSWORD` | Database password |
| `DB_TRUST_CERT` | Trust server certificate (`true`) |
| `JWT_KEY` | JWT signing secret (32+ characters) |
| `AUTH_USERNAME` | API admin username |
| `AUTH_PASSWORD` | API admin password |

## Testing the API

Test the Azure API is working:

```bash
# Health check
curl https://restapi-excelgrid.azurewebsites.net/api/health

# Login
curl -X POST https://restapi-excelgrid.azurewebsites.net/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'

# Get tables (with token from login)
curl https://restapi-excelgrid.azurewebsites.net/api/tables \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Next Steps

1. **Deploy Excel Grid** - Push changes to `main` branch to deploy updated configuration
2. **Verify Azure API** - Ensure Azure Web App is running and database is accessible
3. **Test End-to-End** - Login to Excel Grid and verify table data loads correctly

## Cloudflare Workers Status

The Cloudflare Workers API (`sqlrest/workers/`) is still in the repository but:
- Not used by the Excel Grid in production
- Can be used for D1 database scenarios in the future
- Deployment workflow exists but is not triggered automatically
