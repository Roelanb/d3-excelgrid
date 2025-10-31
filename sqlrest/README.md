# SQL REST API

A secure C# ASP.NET Core application that provides a **fully dynamic** REST CRUD API for querying SQL Server databases and returning results as JSON objects.

## Features

- **🚀 Fully Dynamic**: Automatically discovers ALL tables in your database at runtime and generates endpoints
- **🔐 JWT Authentication**: Secure API access with Bearer token authentication
- **🛡️ SQL Injection Protection**: Comprehensive parameterized queries and input validation
- **Zero Configuration**: No need to manually create endpoint classes - just connect to your database
- **Pagination**: Built-in pagination support for large datasets
- **Sorting**: Flexible sorting on any column with validation
- **Search**: Parameterized search across common text columns
- **FastEndpoints**: High-performance API framework
- **Dapper**: Efficient database access
- **Swagger Documentation**: Auto-generated API documentation
- **Schema Filtering**: Configure which schemas and tables to expose
- **CORS Support**: Configurable cross-origin resource sharing

## Security Features

### 🔐 Authentication & Authorization
- **JWT Bearer Token Authentication** - All endpoints (except health and auth) require valid JWT tokens
- **Configurable Token Expiration** - Default 60 minutes, customizable via configuration
- **Secure Token Generation** - Uses HMAC-SHA256 signing algorithm

### 🛡️ SQL Injection Protection
- **Parameterized Queries** - All user input passed as SQL parameters, never concatenated
- **Schema/Table Validation** - Validates against `INFORMATION_SCHEMA` before executing queries
- **Column Name Whitelisting** - ORDER BY and search columns validated against table schema
- **Input Sanitization** - Strict validation on all query parameters
- **Defense in Depth** - Multiple layers of protection at endpoint and database service levels

### 🔒 Additional Security
- **CORS Policy** - Configurable allowed origins (default: localhost development ports)
- **HTTPS Redirection** - Automatic redirect to secure connections
- **Request Validation** - Pagination limits (max 1000 records per page)

## How It Works

The API automatically discovers your database schema at startup and generates CRUD endpoints for every table:

1. **Database Discovery**: Queries `INFORMATION_SCHEMA.TABLES` to find all tables
2. **Schema Validation**: Validates table and schema existence before queries
3. **Dynamic Endpoint Generation**: Creates endpoints for discovered tables
4. **Automatic Registration**: FastEndpoints discovers and registers all endpoints
5. **Secure Query Execution**: All queries use parameterized statements

**No manual endpoint creation required!** Just add a table to your database and restart the application.

## Authentication

### Getting a Token

**Endpoint**: `POST /api/auth/login`

**Default Credentials**:
- Username: `admin`
- Password: `admin`

⚠️ **Change these credentials in production!**

**Request**:
```bash
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin"
}
```

**Response**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600,
  "tokenType": "Bearer"
}
```

### Using the Token

Include the token in the `Authorization` header for all API requests:

```bash
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## API Endpoints

### Public Endpoints (No Authentication Required)
- `GET /api/health` - Health check
- `POST /api/auth/login` - Login and get JWT token

### Protected Endpoints (Authentication Required)

For each table, the following endpoints are automatically generated:

#### CRUD Operations
- `GET /api/{schema}/{table}` - Get paginated list of records
- `GET /api/{schema}/{table}/{id}` - Get specific record by ID
- `POST /api/{schema}/{table}` - Create new record
- `PUT /api/{schema}/{table}/{id}` - Update existing record
- `DELETE /api/{schema}/{table}/{id}` - Delete record

#### Discovery
- `GET /api/tables` - List all available tables and schemas

## Query Parameters

### Pagination
- `page` (default: 1) - Page number
- `pageSize` (default: 100, max: 1000) - Number of records per page

### Search
- `search` - Search across common text columns (FirstName, LastName, Name, Title, Email, Description)
  - Uses parameterized LIKE queries
  - Only searches columns that exist in the table
  - Automatically validated against table schema

## Example Requests

### Login
```bash
curl -X POST "http://localhost:5000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'
```

### Get Available Tables
```bash
curl -X GET "http://localhost:5000/api/tables" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Get All Products with Pagination
```bash
curl -X GET "http://localhost:5000/api/production/product?page=1&pageSize=10" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Search Products
```bash
curl -X GET "http://localhost:5000/api/production/product?search=mountain&page=1&pageSize=10" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Create a New Product
```bash
curl -X POST "http://localhost:5000/api/production/product" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "Name": "New Product",
    "ProductNumber": "NP-001",
    "ListPrice": 199.99,
    "SafetyStockLevel": 10,
    "ReorderPoint": 5
  }'
```

### Update a Product
```bash
curl -X PUT "http://localhost:5000/api/production/product/1" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "ListPrice": 299.99,
    "SafetyStockLevel": 15
  }'
```

### Delete a Product
```bash
curl -X DELETE "http://localhost:5000/api/production/product/1" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Response Format

### Paginated Response
```json
{
  "data": [
    {
      "ProductID": 1,
      "Name": "Adjustable Race",
      "ProductNumber": "AR-5381",
      "ListPrice": 0.0000
    }
  ],
  "totalCount": 504,
  "page": 1,
  "pageSize": 10,
  "totalPages": 51,
  "hasPrevious": false,
  "hasNext": true
}
```

### Single Record Response
```json
{
  "ProductID": 1,
  "Name": "Adjustable Race",
  "ProductNumber": "AR-5381",
  "ListPrice": 0.0000
}
```

### Tables Response
```json
{
  "tables": [
    {
      "schema": "dbo",
      "name": "Customer",
      "fullName": "dbo.Customer"
    },
    {
      "schema": "production",
      "name": "Product",
      "fullName": "production.Product"
    }
  ],
  "totalCount": 2
}
```

### Error Response
```json
{
  "statusCode": 400,
  "message": "One or more errors occurred!",
  "errors": {
    "generalErrors": ["Invalid column name in ORDER BY: InvalidColumn"]
  }
}
```

## Configuration

Update `appsettings.json` with your database connection, authentication, and endpoint filtering preferences:

```json
{
  "ConnectionStrings": {
    "AdventureWorks": "Server=your_server;Database=AdventureWorks2022;TrustServerCertificate=true;Integrated Security=false;User Id=your_user;Password=your_password;"
  },
  "Jwt": {
    "Key": "YourSecureSecretKeyHere_MinimumLength32Characters_ChangeInProduction!",
    "Issuer": "SqlRestApi",
    "Audience": "SqlRestApi",
    "ExpiryMinutes": 60
  },
  "Auth": {
    "Username": "admin",
    "Password": "admin"
  },
  "DynamicEndpoints": {
    "AllowedSchemas": [],
    "ExcludedSchemas": ["sys", "INFORMATION_SCHEMA"],
    "ExcludedTables": []
  },
  "Cors": {
    "AllowedOrigins": ["http://localhost:5173", "http://localhost:3000"]
  }
}
```

### Configuration Options

#### Connection Strings
- **AdventureWorks**: Your SQL Server connection string

#### JWT Settings
- **Key**: Secret key for JWT signing (minimum 32 characters) - **CHANGE IN PRODUCTION!**
- **Issuer**: Token issuer identifier
- **Audience**: Token audience identifier
- **ExpiryMinutes**: Token expiration time in minutes (default: 60)

#### Authentication
- **Username**: Login username (default: admin) - **CHANGE IN PRODUCTION!**
- **Password**: Login password (default: admin) - **CHANGE IN PRODUCTION!**

#### Dynamic Endpoints
- **AllowedSchemas**: If specified (non-empty), ONLY these schemas will be exposed. Leave empty `[]` to allow all schemas.
- **ExcludedSchemas**: Schemas to exclude from endpoint generation. Defaults to system schemas.
- **ExcludedTables**: Specific table names to exclude from endpoint generation.

#### CORS
- **AllowedOrigins**: List of allowed origins for cross-origin requests

### Environment Variables

You can also configure using environment variables:

```bash
ConnectionStrings__AdventureWorks="Server=..."
Jwt__Key="YourSecretKey"
Auth__Username="your_username"
Auth__Password="your_password"
Cors__AllowedOrigins="http://localhost:5173,https://yourapp.com"
```

## Running the Application

1. Install dependencies:
```bash
dotnet restore
```

2. Update configuration in `appsettings.json` or set environment variables

3. Run the application:
```bash
dotnet run
```

4. Access Swagger documentation at: `http://localhost:5000/swagger`

## Testing with HTTP Files

The `test/` directory contains `.http` files for testing endpoints with the REST Client extension:

1. Open `test/auth.http` and run the login request
2. Copy the token from the response
3. Update `@token` variable in other test files
4. Run any test request

See [test/README.md](test/README.md) for detailed instructions.

## Requirements

- .NET 9.0 (or .NET 8.0)
- SQL Server with a database (e.g., AdventureWorks2022)
- Visual Studio 2022, VS Code, or Rider

## Architecture

The application uses a **secure, fully dynamic runtime approach**:

1. **Database Discovery**: At startup, queries `INFORMATION_SCHEMA.TABLES` to discover all tables
2. **Schema Validation**: Validates all schema/table names before query execution
3. **Dynamic Endpoint Generation**: Creates endpoints for discovered tables
4. **Parameterized Queries**: All queries use parameters, never string concatenation
5. **Column Validation**: ORDER BY and search columns validated against table schema
6. **FastEndpoints Auto-Discovery**: Automatically finds and registers endpoints
7. **JWT Authentication**: Secures all endpoints with token-based auth

### Key Components

- **DatabaseService**: Queries SQL Server schema and executes parameterized SQL
- **GenericTableEndpoints**: Provides CRUD operations with validation
- **AuthEndpoint**: Handles JWT token generation
- **Input Validators**: Validate schema, table, and column names
- **Configuration Filtering**: Controls which schemas/tables are exposed

### Security Architecture

```
Request → CORS Check → JWT Validation → Input Validation → Schema Validation → Parameterized Query → Response
```

Every layer provides defense against unauthorized access and SQL injection attacks.

## Security Best Practices

### Before Deploying to Production

1. **Change Default Credentials**
   ```json
   "Auth": {
     "Username": "your_secure_username",
     "Password": "your_secure_password"
   }
   ```

2. **Generate Strong JWT Secret** (32+ characters)
   ```bash
   # Use a cryptographically secure random generator
   openssl rand -base64 32
   ```

3. **Use HTTPS Only**
   - Configure SSL certificate
   - Enable HSTS headers

4. **Restrict CORS Origins**
   ```json
   "Cors": {
     "AllowedOrigins": ["https://yourapp.com"]
   }
   ```

5. **Use Proper Database Credentials**
   - Use least-privilege database user
   - Never use `sa` or database owner accounts
   - Grant only necessary permissions (SELECT, INSERT, UPDATE, DELETE on specific tables)

6. **Store Secrets Securely**
   - Use Azure Key Vault, AWS Secrets Manager, or similar
   - Use User Secrets for local development
   - Never commit secrets to version control

7. **Enable Logging and Monitoring**
   - Log all authentication attempts
   - Monitor for suspicious query patterns
   - Set up alerts for errors

8. **Implement Rate Limiting**
   - Add rate limiting middleware
   - Prevent brute force attacks on login endpoint

## License

MIT License - See LICENSE file for details

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## Support

For issues, questions, or contributions, please open an issue on GitHub.
