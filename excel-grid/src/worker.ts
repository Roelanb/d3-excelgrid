import type { ExportedHandler, Request as WorkerRequest, Response as WorkerResponse } from '@cloudflare/workers-types';

interface Env {
  ASSETS: { fetch(request: WorkerRequest): Promise<WorkerResponse> };
}

export default {
  async fetch(request: WorkerRequest, env: Env): Promise<WorkerResponse> {
    // Serve static assets (e.g., /, /assets/index-*.js)
    const url = new URL(request.url);
    if (url.pathname === '/' || url.pathname.startsWith('/assets/')) {
      // Note: Inside ASSETS.fetch, use the global Request if needed, or cast if issues arise
      return env.ASSETS.fetch(request);
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
