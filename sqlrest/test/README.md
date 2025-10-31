# SQL REST API - HTTP Test Files

This directory contains HTTP test files for testing the SQL REST API endpoints using the REST Client extension for VS Code or similar tools.

## Prerequisites

- **VS Code Extension**: Install [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) extension
- **Alternative**: Use IntelliJ IDEA HTTP Client, or tools like Postman/Insomnia
- **API Running**: Ensure the SQL REST API is running on `http://localhost:5000`

## Authentication

Most endpoints require JWT authentication. Follow these steps:

### Step 1: Get a Bearer Token

1. Open `auth.http`
2. Run the **Login to get Bearer Token** request (click "Send Request" above the request)
3. Copy the `token` value from the response

**Example Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA1LzA1L2lkZW50aXR5L2NsYWltcy9uYW1lIjoiYWRtaW4iLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJVc2VyIiwianRpIjoiMTIzNDU2NzgtOTBhYi1jZGVmLTEyMzQtNTY3ODkwYWJjZGVmIiwiZXhwIjoxNzA5MjM0NTY3LCJpc3MiOiJTcWxSZXN0QXBpIiwiYXVkIjoiU3FsUmVzdEFwaSJ9.abcdef1234567890",
  "expiresIn": 3600,
  "tokenType": "Bearer"
}
```

### Step 2: Set the Token in Test Files

In each test file that requires authentication, replace the `@token` variable:

```http
@token = your_token_here
```

With your actual token:

```http
@token = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA1LzA1L2lkZW50aXR5L2NsYWltcy9uYW1lIjoiYWRtaW4i...
```

### Step 3: Run Requests

Click "Send Request" above any HTTP request to execute it with your token.

## Default Credentials

- **Username**: `admin`
- **Password**: `admin`

⚠️ **Security Warning**: Change these credentials in production!

## Test Files Overview

### `auth.http`
- **Purpose**: Authentication and token management
- **Endpoints**: Login
- **Authentication**: None required (this generates the token)

### `health.http`
- **Purpose**: API health checks and basic connectivity tests
- **Endpoints**: Health, Test
- **Authentication**: None required

### `tables.http`
- **Purpose**: List available database tables and schemas
- **Endpoints**: GET /api/tables
- **Authentication**: Required

### `person.http`
- **Purpose**: Test Person schema endpoints (Person, Address, StateProvince)
- **Endpoints**: GET /api/person/* (with pagination, filtering, sorting)
- **Authentication**: Required

### `production.http`
- **Purpose**: Test Production schema endpoints (Product, Category, Location, etc.)
- **Endpoints**: GET /api/production/* (with pagination, filtering, sorting)
- **Authentication**: Required

### `error-handling.http`
- **Purpose**: Test error scenarios and edge cases
- **Endpoints**: Various invalid requests
- **Authentication**: Required (includes tests for missing/invalid tokens)

## Usage Examples

### Using REST Client Extension (VS Code)

1. Open any `.http` file
2. Click on "Send Request" link that appears above each request
3. View the response in the right panel

### Using curl

```bash
# Get a token
TOKEN=$(curl -X POST "http://localhost:5000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' \
  | jq -r '.token')

# Use the token
curl -X GET "http://localhost:5000/api/tables" \
  -H "Authorization: Bearer $TOKEN"
```

### Using PowerShell

```powershell
# Get a token
$response = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"username":"admin","password":"admin"}'
$token = $response.token

# Use the token
$headers = @{ "Authorization" = "Bearer $token" }
Invoke-RestMethod -Uri "http://localhost:5000/api/tables" -Headers $headers
```

## Token Expiration

- Tokens expire after **60 minutes** (default)
- When a token expires, you'll receive a **401 Unauthorized** response
- Simply run the login request again to get a new token

## Tips

### REST Client Extension Features

- **Variables**: Use `@variable = value` to define reusable variables
- **Multiple Environments**: Create `rest-client.env.json` for dev/prod environments
- **History**: View request history with `Ctrl+Alt+H`
- **Code Generation**: Right-click and select "Generate Code Snippet" for curl, JavaScript, etc.

### Troubleshooting

1. **401 Unauthorized**: Your token is expired or invalid - get a new token from `auth.http`
2. **500 Internal Server Error**: Check if the database connection is working
3. **404 Not Found**: Verify the schema/table name exists in the database
4. **Connection Refused**: Ensure the API is running on `http://localhost:5000`

## Environment Variables

You can create a `rest-client.env.json` file in this directory for different environments:

```json
{
  "development": {
    "base": "http://localhost:5000",
    "token": "your_dev_token_here"
  },
  "production": {
    "base": "https://api.yourapp.com",
    "token": "your_prod_token_here"
  }
}
```

Then use: `{{base}}` and `{{token}}` in your requests, and switch environments with the REST Client extension.

## Contributing

When adding new test files:
1. Include authentication instructions at the top
2. Add the `@token` variable for authenticated endpoints
3. Include example responses in comments
4. Document the purpose and endpoints being tested
5. Update this README with the new file

## Security Notes

- **Never commit real tokens** to version control
- Keep `@token = your_token_here` as placeholder in committed files
- Use `.gitignore` to exclude files with real credentials
- For production testing, use environment-specific configuration

## Additional Resources

- [REST Client Extension Documentation](https://marketplace.visualstudio.com/items?itemName=humao.rest-client)
- [HTTP Request Format Specification](https://www.rfc-editor.org/rfc/rfc7231)
- [JWT.io - JWT Token Inspector](https://jwt.io/)
