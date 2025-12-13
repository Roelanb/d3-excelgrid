# Test File Generation Endpoint

This endpoint automatically generates `.http` test files with example CRUD operations for any table in your database.

## Usage

### 1. Generate Test File

Make a GET request to:
```
GET http://localhost:3200/api/tables/{schema}/{table}/generate-tests
```

Example:
```
GET http://localhost:3200/api/tables/production/products/generate-tests
```

### 2. Save the Response

The endpoint returns a complete `.http` file with:
- Authentication request
- GET all records (paginated)
- GET single record by ID
- POST (create new record)
- PUT (update existing record)
- DELETE record

### 3. Use the Generated File

1. Copy the response content
2. Save it as a new `.http` file (e.g., `products-test.http`)
3. Run the authentication request first to get a JWT token
4. Copy the token and update the `@token` variable
5. Run the other requests to test your API

## Features

- **Smart Example Data**: Generates realistic example values based on column names and types
  - Email columns get `test@example.com`
  - Name columns get `Example Name`
  - Price/Amount columns get numeric values
  - Date columns get current date
  - Boolean columns get `true`
  - And more...

- **Primary Key Detection**: Automatically identifies and excludes primary keys from INSERT operations

- **Type-Aware**: Generates appropriate JSON values based on SQL column types

- **Ready to Use**: Generated files work immediately with VS Code REST Client extension

## Example Output

```http
### CRUD Operations for production.products
### Generated on 2024-11-14 12:30:00 UTC

@baseUrl = http://localhost:3200
@token = YOUR_JWT_TOKEN_HERE

### 1. Get All Records (Paginated)
GET {{baseUrl}}/api/production/products?page=1&pageSize=10
Authorization: Bearer {{token}}

### 2. Get Record by ID
GET {{baseUrl}}/api/production/products/1
Authorization: Bearer {{token}}

### 3. Create New Record
POST {{baseUrl}}/api/production/products
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "Name": "Example Name",
  "Price": 99.99,
  "Description": "Sample description text"
}

... (and more)
```

## Tips

- Use the `example-test.http` file as a starting point
- Modify the generated example values to match your actual data
- The endpoint is unauthenticated for easy access during development
- Generated files include helpful comments and notes
