#!/bin/bash

# Script to update API endpoint URL for Excel Grid deployment
# Usage: ./set-api-url.sh <API_URL>

set -e

API_URL="$1"

if [ -z "$API_URL" ]; then
    echo "Usage: $0 <API_URL>"
    echo ""
    echo "Examples:"
    echo "  $0 https://sqlrest-api-abc123.your-subdomain.workers.dev"
    echo "  $0 http://localhost:8787"
    echo "  $0 https://your-staging-api.workers.dev"
    exit 1
fi

echo "Updating API URL to: $API_URL"

# Update wrangler.toml
sed -i.bak "s|VITE_API_BASE_URL = \".*\"|VITE_API_BASE_URL = \"$API_URL\"|" wrangler.toml

echo "✅ Updated wrangler.toml"
echo "📦 Backup saved as wrangler.toml.bak"

# Show the updated configuration
echo ""
echo "Current configuration:"
grep "VITE_API_BASE_URL" wrangler.toml

echo ""
echo "🚀 Ready to deploy with:"
echo "   wrangler deploy"
echo ""
echo "🔍 Test locally with:"
echo "   pnpm dev"
