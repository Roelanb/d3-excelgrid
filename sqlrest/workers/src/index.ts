import { Hono } from 'hono';
import { Context, Next } from 'hono';
import { jwt, sign } from 'hono/jwt';
import { Env } from './types.js';
import { DatabaseService } from './services/database.js';
import { AuthEndpoints } from './endpoints/auth.js';
import { DynamicCrudEndpoints } from './endpoints/dynamic-crud.js';

const app = new Hono<Env>();

// CORS configuration
app.use('/*', async (c: Context<Env>, next: Next) => {
  const origins = c.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'];
  const origin = c.req.header('Origin');
  
  if (origin && origins.includes(origin)) {
    c.header('Access-Control-Allow-Origin', origin);
  }
  
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  c.header('Access-Control-Allow-Credentials', 'true');
  
  if (c.req.method === 'OPTIONS') {
    return c.text('', 200);
  }
  
  await next();
});

// Health check endpoint (public)
app.get('/api/health', (c: Context<Env>) => {
  return c.json({ status: 'healthy', timestamp: new Date().toISOString(),
    dbConnectionString: c.env.DB_CONNECTION_STRING || 'N/A',
    jwtKey: c.env.JWT_KEY || 'N/A',
    authUsername: c.env.AUTH_USERNAME || 'N/A',
    authPassword: c.env.AUTH_PASSWORD || 'N/A',
    corsOrigins: c.env.CORS_ORIGINS || 'N/A',
    jwtIssuer: c.env.JWT_ISSUER || 'N/A',
    jwtAudience: c.env.JWT_AUDIENCE || 'N/A',
    jwtExpiryMinutes: c.env.JWT_EXPIRY_MINUTES || 'N/A' });
});

// JWT middleware for protected routes
app.use('/api/*', async (c: Context<Env>, next: Next) => {
  // Skip auth for health check and login
  if (c.req.path === '/api/health' || c.req.path === '/api/auth/login') {
    return next();
  }
  
  const jwtMiddleware = jwt({
    secret: c.env.JWT_KEY,
  });
  
  return jwtMiddleware(c, next);
});

// Initialize services
const dbService = new DatabaseService();
const authEndpoints = new AuthEndpoints();
const crudEndpoints = new DynamicCrudEndpoints(dbService);

// Register endpoints
authEndpoints.register(app);
crudEndpoints.register(app);

// 404 handler
app.notFound((c: Context<Env>) => {
  return c.json({ 
    statusCode: 404, 
    message: 'Endpoint not found' 
  }, 404);
});

// Error handler
app.onError((err: Error, c: Context<Env>) => {
  console.error('Error:', err);
  return c.json({
    statusCode: 500,
    message: 'Internal server error',
    error: err.message
  }, 500);
});

export default {
  fetch: app.fetch,
};
