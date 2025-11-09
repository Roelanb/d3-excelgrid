export interface ColumnInfo {
  name: string;
  type: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
}

export interface TableInfo {
  schema: string;
  name: string;
  fullName: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export class DatabaseService {
  private connectionString: string = '';

  constructor(connectionString?: string) {
    this.connectionString = connectionString || '';
  }

  async connect(env: any): Promise<void> {
    this.connectionString = env.DB_CONNECTION_STRING;
  }

  async testConnection(env: any): Promise<boolean> {
    try {
      this.connectionString = env.DB_CONNECTION_STRING;
      
      // For external SQL Server, we'd use TCP sockets
      // For now, return true if connection string exists
      return !!this.connectionString;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  async getAllSchemasAndTables(env: any): Promise<Map<string, string[]>> {
    try {
      await this.connect(env);
      
      // If using D1 database
      if (env.DB) {
        const result = await env.DB.prepare(`
          SELECT 
            CASE 
              WHEN name LIKE 'sqlite_%' THEN 'sqlite'
              ELSE 'main'
            END as schema,
            name as table_name
          FROM sqlite_master 
          WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
          ORDER BY schema, table_name
        `).all();
        
        const schemasAndTables = new Map<string, string[]>();
        
        for (const row of result.results) {
          const schema = row.schema;
          const table = row.table_name;
          
          if (!schemasAndTables.has(schema)) {
            schemasAndTables.set(schema, []);
          }
          schemasAndTables.get(schema)!.push(table);
        }
        
        return schemasAndTables;
      }
      
      // For external SQL Server (placeholder - would need external service)
      return new Map();
    } catch (error) {
      console.error('Failed to get schemas and tables:', error);
      throw error;
    }
  }

  async getTableColumns(env: any, schema: string, table: string): Promise<ColumnInfo[]> {
    try {
      await this.connect(env);
      
      // If using D1 database
      if (env.DB) {
        const result = await env.DB.prepare(`
          PRAGMA table_info(${table})
        `).all();
        
        return result.results.map((row: any) => ({
          name: row.name,
          type: this.mapSQLiteTypeToSQLType(row.type),
          isNullable: row.notnull === 0,
          isPrimaryKey: row.pk === 1
        }));
      }
      
      // For external SQL Server (placeholder)
      return [];
    } catch (error) {
      console.error(`Failed to get columns for ${schema}.${table}:`, error);
      throw error;
    }
  }

  async executeQuery(
    env: any,
    schema: string,
    table: string,
    operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE',
    params: any = {}
  ): Promise<any> {
    try {
      await this.connect(env);
      
      // Validate table exists
      const schemasAndTables = await this.getAllSchemasAndTables(env);
      const tables = schemasAndTables.get(schema);
      if (!tables || !tables.includes(table)) {
        throw new Error(`Table ${schema}.${table} not found`);
      }
      
      switch (operation) {
        case 'SELECT':
          return await this.executeSelectQuery(env, schema, table, params);
        case 'INSERT':
          return await this.executeInsertQuery(env, schema, table, params);
        case 'UPDATE':
          return await this.executeUpdateQuery(env, schema, table, params);
        case 'DELETE':
          return await this.executeDeleteQuery(env, schema, table, params);
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }
    } catch (error) {
      console.error(`Query execution failed:`, error);
      throw error;
    }
  }

  private async executeSelectQuery(env: any, schema: string, table: string, params: any): Promise<PaginatedResponse<any>> {
    const page = parseInt(params.page) || 1;
    const pageSize = Math.min(parseInt(params.pageSize) || 100, 1000);
    const search = params.search || '';
    const offset = (page - 1) * pageSize;
    
    let whereClause = '';
    let countWhereClause = '';
    const queryParams: any[] = [];
    
    if (search) {
      whereClause = ` WHERE name LIKE ? OR CAST(id AS TEXT) LIKE ?`;
      countWhereClause = ` WHERE name LIKE ? OR CAST(id AS TEXT) LIKE ?`;
      queryParams.push(`%${search}%`, `%${search}%`);
    }
    
    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM ${table}${countWhereClause}`;
    const countResult = await env.DB.prepare(countQuery).bind(...queryParams).first();
    const totalCount = countResult?.total || 0;
    
    // Get data
    const dataQuery = `SELECT * FROM ${table}${whereClause} LIMIT ? OFFSET ?`;
    const dataResult = await env.DB.prepare(dataQuery)
      .bind(...queryParams, pageSize, offset)
      .all();
    
    const totalPages = Math.ceil(totalCount / pageSize);
    
    return {
      data: dataResult.results,
      totalCount,
      page,
      pageSize,
      totalPages,
      hasPrevious: page > 1,
      hasNext: page < totalPages
    };
  }

  private async executeInsertQuery(env: any, schema: string, table: string, params: any): Promise<any> {
    const columns = Object.keys(params).filter(key => params[key] !== undefined);
    const values = columns.map(col => params[col]);
    const placeholders = columns.map(() => '?').join(', ');
    
    const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
    const result = await env.DB.prepare(query).bind(...values).run();
    
    if (result.success && result.meta.last_row_id) {
      // Return the inserted record
      const insertedRecord = await env.DB.prepare(`SELECT * FROM ${table} WHERE rowid = ?`)
        .bind(result.meta.last_row_id)
        .first();
      return insertedRecord;
    }
    
    throw new Error('Insert operation failed');
  }

  private async executeUpdateQuery(env: any, schema: string, table: string, params: any): Promise<any> {
    const { id, ...updateData } = params;
    
    if (!id) {
      throw new Error('ID is required for update operation');
    }
    
    const columns = Object.keys(updateData).filter(key => updateData[key] !== undefined);
    const values = columns.map(col => updateData[col]);
    
    if (columns.length === 0) {
      throw new Error('No fields to update');
    }
    
    const setClause = columns.map(col => `${col} = ?`).join(', ');
    const query = `UPDATE ${table} SET ${setClause} WHERE id = ?`;
    
    const result = await env.DB.prepare(query).bind(...values, id).run();
    
    if (result.success && result.changes > 0) {
      // Return the updated record
      const updatedRecord = await env.DB.prepare(`SELECT * FROM ${table} WHERE id = ?`)
        .bind(id)
        .first();
      return updatedRecord;
    }
    
    throw new Error('Update operation failed or no records affected');
  }

  private async executeDeleteQuery(env: any, schema: string, table: string, params: any): Promise<void> {
    const { id } = params;
    
    if (!id) {
      throw new Error('ID is required for delete operation');
    }
    
    const query = `DELETE FROM ${table} WHERE id = ?`;
    const result = await env.DB.prepare(query).bind(id).run();
    
    if (!result.success || result.changes === 0) {
      throw new Error('Delete operation failed or no records affected');
    }
  }

  private mapSQLiteTypeToSQLType(sqliteType: string): string {
    const type = sqliteType.toUpperCase();
    if (type.includes('INT')) return 'integer';
    if (type.includes('TEXT') || type.includes('CHAR') || type.includes('VARCHAR')) return 'string';
    if (type.includes('REAL') || type.includes('FLOAT') || type.includes('DOUBLE')) return 'decimal';
    if (type.includes('BLOB')) return 'binary';
    return 'string';
  }
}
