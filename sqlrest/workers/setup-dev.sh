#!/bin/bash

# SQL REST API - Development Setup Script
# This script sets up the development environment

set -e

echo "🛠️ Setting up SQL REST API development environment..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+ first."
    exit 1
fi

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "📦 Installing Wrangler CLI..."
    npm install -g wrangler
fi

# Install project dependencies
echo "📦 Installing project dependencies..."
npm install

# Create development D1 database
echo "🗄️ Creating development D1 database..."
DEV_DB_NAME="sqlrest-dev-db"

if ! wrangler d1 list | grep -q "$DEV_DB_NAME"; then
    echo "Creating development D1 database: $DEV_DB_NAME"
    wrangler d1 create $DEV_DB_NAME
    
    # Get the database ID
    DB_ID=$(wrangler d1 list | grep "$DEV_DB_NAME" | jq -r '.[0].uuid')
    
    # Create development wrangler.toml
    cat > wrangler.dev.toml << EOF
name = "sqlrest-api-dev"
main = "src/index.ts"
compatibility_date = "2023-12-18"

[[d1_databases]]
binding = "DB"
database_name = "$DEV_DB_NAME"
database_id = "$DB_ID"

[vars]
JWT_ISSUER = "SqlRestApi"
JWT_AUDIENCE = "SqlRestApi"
JWT_EXPIRY_MINUTES = "60"
CORS_ORIGINS = "http://localhost:5173,http://localhost:3000,http://localhost:5174"
EOF
    
    echo "✅ Created wrangler.dev.toml"
else
    echo "✅ Development D1 database already exists"
fi

# Set development secrets
echo "🔑 Setting development secrets..."

# Generate a random JWT secret for development
DEV_JWT_KEY=$(openssl rand -base64 32 2>/dev/null || date +%s | sha256sum | base64 | head -c 32)
echo "Setting development JWT key..."
wrangler secret put JWT_KEY --env development <<< "$DEV_JWT_KEY"

wrangler secret put AUTH_USERNAME --env development <<< "admin"
wrangler secret put AUTH_PASSWORD --env development <<< "admin"

# Run database schema
echo "🏗️ Applying database schema to development database..."
wrangler d1 execute $DEV_DB_NAME --file=./schema.sql

# Create development scripts
echo "📜 Creating development scripts..."

cat > dev-start.sh << 'EOF'
#!/bin/bash
echo "🚀 Starting SQL REST API in development mode..."
wrangler dev --env development
EOF

cat > dev-test.sh << 'EOF'
#!/bin/bash
echo "🧪 Testing SQL REST API development endpoints..."

BASE_URL="http://localhost:8787"

echo "1. Testing health endpoint..."
curl -s "$BASE_URL/api/health" | jq .

echo ""
echo "2. Getting JWT token..."
TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin"}' | jq -r .token)

echo "Token: $TOKEN"

echo ""
echo "3. Testing tables endpoint..."
curl -s "$BASE_URL/api/tables" \
    -H "Authorization: Bearer $TOKEN" | jq .

echo ""
echo "4. Testing customers endpoint..."
curl -s "$BASE_URL/api/main/customers" \
    -H "Authorization: Bearer $TOKEN" | jq .

echo ""
echo "5. Creating a new customer..."
curl -s -X POST "$BASE_URL/api/main/customers" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"name":"Test User","email":"test@example.com","phone":"555-9999"}' | jq .
EOF

chmod +x dev-start.sh dev-test.sh

echo ""
echo "🎉 Development setup complete!"
echo ""
echo "📋 Available commands:"
echo "  ./dev-start.sh    - Start development server"
echo "  ./dev-test.sh     - Test API endpoints"
echo "  wrangler tail     - View logs"
echo ""
echo "🌐 Development server will run on: http://localhost:8787"
echo "📖 API documentation: http://localhost:8787/swagger (if enabled)"
echo ""
echo "🚀 Start development with: ./dev-start.sh"
