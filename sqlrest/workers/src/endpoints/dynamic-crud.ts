import { Hono } from 'hono';
import { Context } from 'hono';
import { Env } from '../types.js';
import { DatabaseService, PaginatedResponse } from '../services/database.js';

export class DynamicCrudEndpoints {
  constructor(private dbService: DatabaseService) {}

  register(app: Hono<Env>) {
    // Get all available tables
    app.get('/api/tables', async (c: Context<Env>) => {
      try {
        const schemasAndTables = await this.dbService.getAllSchemasAndTables(c.env);
        const tables: Array<{ schema: string; name: string; fullName: string }> = [];
        
        let totalCount = 0;
        for (const [schema, tableList] of schemasAndTables) {
          for (const table of tableList) {
            tables.push({
              schema,
              name: table,
              fullName: `${schema}.${table}`
            });
            totalCount++;
          }
        }
        
        return c.json({
          tables,
          totalCount
        });
      } catch (error) {
        console.error('Error getting tables:', error);
        return c.json({
          statusCode: 500,
          message: 'Failed to retrieve tables',
          error: error instanceof Error ? error.message : 'Unknown error'
        }, 500);
      }
    });

    // Get table schema information
    app.get('/api/tables/:schema/:table/schema', async (c: Context<Env>) => {
      try {
        const schema = c.req.param('schema');
        const table = c.req.param('table');
        
        const columns = await this.dbService.getTableColumns(c.env, schema, table);
        
        return c.json({
          schema,
          table,
          columns
        });
      } catch (error) {
        console.error('Error getting table schema:', error);
        return c.json({
          statusCode: 500,
          message: 'Failed to retrieve table schema',
          error: error instanceof Error ? error.message : 'Unknown error'
        }, 500);
      }
    });

    // GET /api/{schema}/{table} - Get paginated list of records
    app.get('/api/:schema/:table', async (c: Context<Env>) => {
      try {
        const schema = c.req.param('schema');
        const table = c.req.param('table');
        const page = parseInt(c.req.query('page') || '1');
        const pageSize = Math.min(parseInt(c.req.query('pageSize') || '100'), 1000);
        const search = c.req.query('search') || '';
        
        const result = await this.dbService.executeQuery(
          c.env,
          schema,
          table,
          'SELECT',
          { page, pageSize, search }
        );
        
        return c.json(result);
      } catch (error) {
        console.error('Error getting records:', error);
        return c.json({
          statusCode: 500,
          message: 'Failed to retrieve records',
          error: error instanceof Error ? error.message : 'Unknown error'
        }, 500);
      }
    });

    // GET /api/{schema}/{table}/{id} - Get specific record by ID
    app.get('/api/:schema/:table/:id', async (c: Context<Env>) => {
      try {
        const schema = c.req.param('schema');
        const table = c.req.param('table');
        const id = c.req.param('id');
        
        // For D1, we need to query by id
        if (c.env.DB) {
          const result = await c.env.DB.prepare(`
            SELECT * FROM ${table} WHERE id = ? LIMIT 1
          `).bind(id).first();
          
          if (!result) {
            return c.json({
              statusCode: 404,
              message: 'Record not found'
            }, 404);
          }
          
          return c.json(result);
        }
        
        // For external databases, use the service
        const records = await this.dbService.executeQuery(
          c.env,
          schema,
          table,
          'SELECT',
          { page: 1, pageSize: 1, search: '', id }
        );
        
        if (!records.data || records.data.length === 0) {
          return c.json({
            statusCode: 404,
            message: 'Record not found'
          }, 404);
        }
        
        return c.json(records.data[0]);
      } catch (error) {
        console.error('Error getting record:', error);
        return c.json({
          statusCode: 500,
          message: 'Failed to retrieve record',
          error: error instanceof Error ? error.message : 'Unknown error'
        }, 500);
      }
    });

    // POST /api/{schema}/{table} - Create new record
    app.post('/api/:schema/:table', async (c: Context<Env>) => {
      try {
        const schema = c.req.param('schema');
        const table = c.req.param('table');
        const data = await c.req.json();
        
        // Validate input
        if (!data || typeof data !== 'object') {
          return c.json({
            statusCode: 400,
            message: 'Invalid request body. Expected JSON object.'
          }, 400);
        }
        
        const result = await this.dbService.executeQuery(
          c.env,
          schema,
          table,
          'INSERT',
          data
        );
        
        return c.json(result, 201);
      } catch (error) {
        console.error('Error creating record:', error);
        return c.json({
          statusCode: 500,
          message: 'Failed to create record',
          error: error instanceof Error ? error.message : 'Unknown error'
        }, 500);
      }
    });

    // PUT /api/{schema}/{table}/{id} - Update existing record
    app.put('/api/:schema/:table/:id', async (c: Context<Env>) => {
      try {
        const schema = c.req.param('schema');
        const table = c.req.param('table');
        const id = c.req.param('id');
        const data = await c.req.json();
        
        // Validate input
        if (!data || typeof data !== 'object') {
          return c.json({
            statusCode: 400,
            message: 'Invalid request body. Expected JSON object.'
          }, 400);
        }
        
        // Add ID to data for the update operation
        const updateData = { ...data, id };
        
        const result = await this.dbService.executeQuery(
          c.env,
          schema,
          table,
          'UPDATE',
          updateData
        );
        
        if (!result) {
          return c.json({
            statusCode: 404,
            message: 'Record not found or no changes made'
          }, 404);
        }
        
        return c.json(result);
      } catch (error) {
        console.error('Error updating record:', error);
        return c.json({
          statusCode: 500,
          message: 'Failed to update record',
          error: error instanceof Error ? error.message : 'Unknown error'
        }, 500);
      }
    });

    // DELETE /api/{schema}/{table}/{id} - Delete record
    app.delete('/api/:schema/:table/:id', async (c: Context<Env>) => {
      try {
        const schema = c.req.param('schema');
        const table = c.req.param('table');
        const id = c.req.param('id');
        
        await this.dbService.executeQuery(
          c.env,
          schema,
          table,
          'DELETE',
          { id }
        );
        
        return c.json({
          message: 'Record deleted successfully',
          id: id
        });
      } catch (error) {
        console.error('Error deleting record:', error);
        return c.json({
          statusCode: 500,
          message: 'Failed to delete record',
          error: error instanceof Error ? error.message : 'Unknown error'
        }, 500);
      }
    });
  }
}
