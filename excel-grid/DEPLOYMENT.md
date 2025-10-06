# Cloudflare Pages Deployment Guide

This project is configured to deploy to Cloudflare Pages using Wrangler.

## Prerequisites

- A Cloudflare account
- Wrangler CLI installed (included in devDependencies)
- Node.js and pnpm installed

## Setup

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Login to Cloudflare:**
   ```bash
   pnpm wrangler login
   ```

## Deployment Methods

### Method 1: Manual Deployment

Deploy directly from your local machine:

```bash
pnpm run deploy
```

This will:
1. Build the project (`pnpm run build`)
2. Deploy the `dist` folder to Cloudflare Pages

### Method 2: GitHub Integration (Recommended)

1. **Push your code to GitHub**

2. **Connect to Cloudflare Pages:**
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
   - Navigate to **Workers & Pages** → **Pages**
   - Click **Connect to Git**
   - Select your repository
   - Configure build settings:
     - **Build command:** `pnpm run build`
     - **Build output directory:** `dist`
     - **Root directory:** `excel-grid` (if deploying from monorepo)

3. **Automatic deployments:** Every push to your main branch will trigger a new deployment

### Method 3: GitHub Actions (CI/CD)

Use the included GitHub Actions workflow (`.github/workflows/deploy.yml`) for automated deployments.

**Setup:**
1. Get your Cloudflare API token:
   - Go to Cloudflare Dashboard → My Profile → API Tokens
   - Create token with "Cloudflare Pages — Edit" permissions

2. Add secrets to your GitHub repository:
   - `CLOUDFLARE_API_TOKEN`: Your Cloudflare API token
   - `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare Account ID (found in dashboard)

3. Push to `main` branch to trigger deployment

## Local Development with Wrangler

Test your built site locally with Cloudflare Pages environment:

```bash
pnpm run build
pnpm run pages:dev
```

## Configuration

### wrangler.toml
The `wrangler.toml` file contains your deployment configuration:
- Project name
- Build output directory (`dist`)
- Compatibility date

### Custom Headers and Redirects
Cloudflare Pages uses special files in the `public/` directory:
- `public/_headers` - Custom HTTP headers for security and caching
- `public/_redirects` - URL redirects (create if needed)

These files are automatically copied to the build output and processed by Cloudflare Pages.

## Environment Variables

If your app needs environment variables:

1. **Local development:** Create a `.dev.vars` file (not tracked in git)
2. **Production:** Set in Cloudflare Dashboard under Pages → Settings → Environment Variables

## Custom Domain

To add a custom domain:
1. Go to Cloudflare Dashboard → Workers & Pages → Your Project
2. Click **Custom domains** → **Set up a custom domain**
3. Follow the instructions to configure DNS

## Troubleshooting

- **Build fails:** Check build logs in Cloudflare dashboard or local terminal
- **Deployment fails:** Ensure you're logged in with `pnpm wrangler login`
- **Assets not loading:** Check the `base` path in `vite.config.ts` if deploying to a subdirectory

## Resources

- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html)
