import type { ExportedHandler, Request as WorkerRequest, Response as WorkerResponse } from '@cloudflare/workers-types';

interface Env {
  ASSETS: { fetch(request: WorkerRequest): Promise<WorkerResponse> };
  VITE_API_BASE_URL: string;
}

export default {
  async fetch(request: WorkerRequest, env: Env): Promise<WorkerResponse> {
    // Serve static assets (e.g., /, /assets/index-*.js)
    const url = new URL(request.url);
    
    // Handle root path - inject runtime config
    if (url.pathname === '/') {
      const response = await env.ASSETS.fetch(request);
      
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
    }
    
    // Handle other assets
    if (url.pathname.startsWith('/assets/')) {
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

    // Fallback: 404 for other paths
    return new Response('Not Found', { status: 404 }) as unknown as WorkerResponse;
  },
} satisfies ExportedHandler<Env>;
