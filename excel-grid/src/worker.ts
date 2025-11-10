import type { ExportedHandler, Request as WorkerRequest, Response as WorkerResponse } from '@cloudflare/workers-types';

interface Env {
  ASSETS: { fetch(request: WorkerRequest): Promise<WorkerResponse> };
  VITE_API_BASE_URL: string;
}

export default {
  async fetch(request: WorkerRequest, env: Env): Promise<WorkerResponse> {
    // Serve static assets (e.g., /, /assets/index-*.js)
    const url = new URL(request.url);

    // Handle static assets first (before HTML injection)
    if (url.pathname.startsWith('/assets/') || url.pathname.endsWith('.svg') || url.pathname.endsWith('.ico')) {
      return env.ASSETS.fetch(request);
    }

    // Debug endpoint to check environment variables
    if (url.pathname === '/debug-env') {
      return new Response(JSON.stringify({
        VITE_API_BASE_URL: env.VITE_API_BASE_URL,
        hasEnv: !!env.VITE_API_BASE_URL
      }), {
        headers: { 'Content-Type': 'application/json' },
      }) as unknown as WorkerResponse;
    }

    // Add dynamic logic here, e.g., API endpoints
    if (url.pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ message: 'Hello from Worker API!' }), {
        headers: { 'Content-Type': 'application/json' },
      }) as unknown as WorkerResponse;
    }

    // For all other paths (including SPA routes), serve index.html with injected config
    // Create a new request for index.html
    const indexUrl = new URL(request.url);
    indexUrl.pathname = '/index.html';
    
    // Convert headers to plain object to avoid type incompatibility
    const headersInit: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headersInit[key] = value;
    });
    
    const indexRequest = new Request(indexUrl.toString(), {
      method: request.method,
      headers: headersInit,
    });
    const response = await env.ASSETS.fetch(indexRequest as unknown as WorkerRequest);

    // Check if it's HTML
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      const html = await response.text();

      // Inject runtime config script in the <head> section
      const runtimeConfig = `<script>window.__RUNTIME_CONFIG__={VITE_API_BASE_URL:"${env.VITE_API_BASE_URL || ''}"}</script>`;

      // Try multiple injection points
      let modifiedHtml = html;
      if (html.includes('</head>')) {
        modifiedHtml = html.replace('</head>', `${runtimeConfig}</head>`);
      } else if (html.includes('<head>')) {
        modifiedHtml = html.replace('<head>', `<head>${runtimeConfig}`);
      } else if (html.includes('<body>')) {
        modifiedHtml = html.replace('<body>', `<body>${runtimeConfig}`);
      }

      // Copy headers to plain object
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      return new Response(modifiedHtml, {
        status: response.status,
        statusText: response.statusText,
        headers,
      }) as unknown as WorkerResponse;
    }

    return response;
  },
} satisfies ExportedHandler<Env>;
