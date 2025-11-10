import type { ExportedHandler, Request as WorkerRequest, Response as WorkerResponse } from '@cloudflare/workers-types';

interface Env {
  ASSETS: { fetch(request: WorkerRequest): Promise<WorkerResponse> };
  VITE_API_BASE_URL: string;
}

export default {
  async fetch(request: WorkerRequest, env: Env): Promise<WorkerResponse> {
    // Serve static assets (e.g., /, /assets/index-*.js)
    const url = new URL(request.url);
    if (url.pathname === '/' || url.pathname.startsWith('/assets/')) {
      // Fetch the asset from the static files
      const response = await env.ASSETS.fetch(request);
      
      // If it's the HTML page, inject runtime environment variables
      if (url.pathname === '/' && response.headers.get('content-type')?.includes('text/html')) {
        // Clone the response so we can modify it
        const html = await response.text();
        
        // Inject runtime config script before the closing </head> tag
        const runtimeConfig = `
          <script>
            window.__RUNTIME_CONFIG__ = {
              VITE_API_BASE_URL: "${env.VITE_API_BASE_URL}"
            };
          </script>
        `;
        const modifiedHtml = html.replace('</head>', `${runtimeConfig}</head>`);
        
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
    }

    // Add dynamic logic here, e.g., API endpoints
    if (url.pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ message: 'Hello from Worker API!' }), {
        headers: { 'Content-Type': 'application/json' },
      }) as unknown as WorkerResponse;
    }

    // Fallback: 404 for other paths
    return new Response('Not Found', { status: 404 }) as unknown as WorkerResponse;
  },
} satisfies ExportedHandler<Env>;
