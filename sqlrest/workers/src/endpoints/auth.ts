import { Hono } from 'hono';
import { Context } from 'hono';
import { sign } from 'hono/jwt';
import { Env } from '../types.js';

export class AuthEndpoints {
  register(app: Hono<Env>) {
    // Login endpoint
    app.post('/api/auth/login', async (c: Context<Env>) => {
      try {
        const { username, password } = await c.req.json();
        
        // Validate credentials
        const validUsername = c.env.AUTH_USERNAME || 'admin';
        const validPassword = c.env.AUTH_PASSWORD || 'admin';
        
        if (username !== validUsername || password !== validPassword) {
          return c.json({
            statusCode: 401,
            message: 'Invalid credentials'
          }, 401);
        }
        
        // Generate JWT token
        const expiryMinutes = parseInt(c.env.JWT_EXPIRY_MINUTES) || 60;
        const expiresInSeconds = expiryMinutes * 60;
        
        const payload = {
          sub: username,
          username: username,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
          iss: c.env.JWT_ISSUER || 'SqlRestApi',
          aud: c.env.JWT_AUDIENCE || 'SqlRestApi'
        };
        
        const token = await sign(payload, c.env.JWT_KEY);
        
        return c.json({
          token: token,
          expiresIn: expiresInSeconds,
          tokenType: 'Bearer',
          expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString()
        });
        
      } catch (error) {
        console.error('Login error:', error);
        return c.json({
          statusCode: 400,
          message: 'Invalid request format',
          error: error instanceof Error ? error.message : 'Unknown error'
        }, 400);
      }
    });
    
    // Token validation endpoint
    app.get('/api/auth/validate', async (c: Context<Env>) => {
      try {
        const authHeader = c.req.header('Authorization');
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return c.json({
            statusCode: 401,
            message: 'No valid token provided'
          }, 401);
        }
        
        // The JWT middleware already validated the token
        const payload = c.get('jwtPayload');
        
        return c.json({
          valid: true,
          username: payload.username,
          expiresAt: new Date(payload.exp * 1000).toISOString()
        });
        
      } catch (error) {
        console.error('Token validation error:', error);
        return c.json({
          statusCode: 401,
          message: 'Invalid token',
          error: error instanceof Error ? error.message : 'Unknown error'
        }, 401);
      }
    });
  }
}
