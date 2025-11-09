#!/bin/bash

# SQL REST API - Cloudflare Workers Deployment Script
# This script automates the deployment process

set -e

echo "🚀 Starting SQL REST API deployment to Cloudflare Workers..."

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Installing..."
    npm install -g wrangler
fi

# Check if user is logged in to Cloudflare
echo "🔐 Checking Cloudflare authentication..."
if ! wrangler whoami &> /dev/null; then
    echo "Please login to Cloudflare:"
    wrangler auth
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create D1 database if it doesn't exist
echo "🗄️ Setting up D1 database..."
DB_NAME="sqlrest-db"

if ! wrangler d1 list | grep -q "$DB_NAME"; then
    echo "Creating D1 database: $DB_NAME"
    wrangler d1 create $DB_NAME
    
    # Get the database ID and update wrangler.toml
    DB_ID=$(wrangler d1 list | grep "$DB_NAME" | jq -r '.[0].uuid')
    echo "Database ID: $DB_ID"
    
    # Update wrangler.toml with database ID
    sed -i "s/database_id = \"your-d1-database-id\"/database_id = \"$DB_ID\"/" wrangler.toml
    echo "✅ Updated wrangler.toml with database ID"
else
    echo "✅ D1 database already exists"
fi

# Run database schema
echo "🏗️ Applying database schema..."
wrangler d1 execute $DB_NAME --file=./schema.sql

# Set secrets (interactive)
echo "🔑 Setting up secrets..."

echo "Please enter your JWT secret key (32+ characters):"
read -s JWT_KEY
wrangler secret put JWT_KEY <<< "$JWT_KEY"

echo "Please enter your admin username:"
read -s AUTH_USERNAME
wrangler secret put AUTH_USERNAME <<< "$AUTH_USERNAME"

echo "Please enter your admin password:"
read -s AUTH_PASSWORD
wrangler secret put AUTH_PASSWORD <<< "$AUTH_PASSWORD"

echo "Enter your database connection string (optional, leave empty if using D1):"
read -s DB_CONNECTION_STRING
if [ ! -z "$DB_CONNECTION_STRING" ]; then
    wrangler secret put DB_CONNECTION_STRING <<< "$DB_CONNECTION_STRING"
fi

# Deploy to Workers
echo "🚀 Deploying to Cloudflare Workers..."
wrangler deploy

# Test deployment
echo "🧪 Testing deployment..."
WORKER_URL=$(wrangler whoami | jq -r '.api_url' | sed 's/api\/v4\/user//' | sed 's/$/sqlrest-api/')
echo "Testing health endpoint at: $WORKER_URL/api/health"

if curl -s "$WORKER_URL/api/health" | grep -q "healthy"; then
    echo "✅ Health check passed!"
else
    echo "❌ Health check failed"
    exit 1
fi

# Show next steps
echo ""
echo "🎉 Deployment successful!"
echo ""
echo "📍 Your API is available at: $WORKER_URL"
echo ""
echo "📋 Next steps:"
echo "1. Get your JWT token:"
echo "   curl -X POST $WORKER_URL/api/auth/login \\"
echo "     -H \"Content-Type: application/json\" \\"
echo "     -d '{\"username\":\"'$AUTH_USERNAME'\",\"password\":\"'$AUTH_PASSWORD'\"}'"
echo ""
echo "2. Test the tables endpoint:"
echo "   curl $WORKER_URL/api/tables \\"
echo "     -H \"Authorization: Bearer YOUR_TOKEN_HERE\""
echo ""
echo "3. View logs:"
echo "   wrangler tail"
echo ""
echo "4. For more commands, see README.md"
