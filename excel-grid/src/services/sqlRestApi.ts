// SQL REST API service
import { authService } from './authService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
const SWAGGER_URL = `${API_BASE_URL}/swagger/v1/swagger.json`;

export interface PaginatedResponse<T> {
  data: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export interface SchemaTable {
  schema: string;
  table: string;
  displayName: string;
}

export interface TableInfo {
  schema: string;
  name: string;
  fullName: string;
}

export interface TablesResponse {
  tables: TableInfo[];
  totalCount: number;
}

interface SwaggerSpec {
  paths: {
    [path: string]: any;
  };
}

// Cache for discovered schemas and tables
let cachedSchemasTables: SchemaTable[] | null = null;

/**
 * Clears the cached schemas and tables, forcing a fresh discovery on next call
 */
export function clearSchemaCache(): void {
  cachedSchemasTables = null;
}

/**
 * Fetches available tables directly from the /api/tables endpoint
 * This is the preferred method as it returns the actual available tables
 * Requires authentication
 */
export async function fetchTablesFromApi(): Promise<SchemaTable[]> {
  try {
    const authHeader = authService.getAuthHeader();
    if (!authHeader.Authorization) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${API_BASE_URL}/api/tables`, {
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
      },
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        // Token expired, clear it and throw auth error
        authService.logout();
        throw new Error('Authentication expired. Please log in again.');
      }
      throw new Error(`Failed to fetch tables: ${response.statusText}`);
    }

    const tablesResponse: TablesResponse = await response.json();
    
    // Convert TableInfo to SchemaTable format
    const schemasTables: SchemaTable[] = tablesResponse.tables.map((table) => ({
      schema: table.schema,
      table: table.name,
      displayName: `${table.schema.charAt(0).toUpperCase() + table.schema.slice(1)}.${table.name.charAt(0).toUpperCase() + table.name.slice(1)}`,
    })).sort((a, b) => a.displayName.localeCompare(b.displayName));

    return schemasTables;
  } catch (error) {
    console.error('Failed to fetch tables from API:', error);
    // Re-throw authentication errors for handling by UI
    if (error instanceof Error && error.message.includes('Authentication')) {
      throw error;
    }
    // Return empty array on other errors
    return [];
  }
}

/**
 * Discovers available schemas and tables from the Swagger endpoint
 * Falls back to this method if /api/tables endpoint is not available
 * Parses paths like /api/{schema}/{table} to extract schema and table names
 * Results are cached to avoid repeated API calls
 */
export async function discoverSchemasAndTables(): Promise<SchemaTable[]> {
  // Return cached result if available
  if (cachedSchemasTables) {
    return cachedSchemasTables;
  }

  // First try to get tables from the /api/tables endpoint
  try {
    const tablesFromApi = await fetchTablesFromApi();
    if (tablesFromApi.length > 0) {
      // Cache the result
      cachedSchemasTables = tablesFromApi;
      return tablesFromApi;
    }
  } catch (error) {
    console.warn('Failed to fetch tables from /api/tables, falling back to Swagger parsing:', error);
  }

  // Fallback to Swagger parsing
  try {
    const response = await fetch(SWAGGER_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch Swagger spec: ${response.statusText}`);
    }

    const swagger: SwaggerSpec = await response.json();
    const schemaTableSet = new Set<string>();

    // Parse all paths to find schema/table combinations
    Object.keys(swagger.paths).forEach((path) => {
      // Match paths like /api/{schema}/{table} or /api/schema/table
      const match = path.match(/^\/api\/([^/]+)\/([^/{}]+)$/);
      if (match) {
        const schema = match[1];
        const table = match[2];
        
        // Skip generic parameter paths and special endpoints
        if (schema !== '{schema}' && table !== '{table}' && schema !== 'health' && schema !== 'tables' && schema !== 'test') {
          schemaTableSet.add(`${schema}:${table}`);
        }
      }
    });

    // Convert to SchemaTable array
    const schemasTables: SchemaTable[] = Array.from(schemaTableSet)
      .map((key) => {
        const [schema, table] = key.split(':');
        return {
          schema,
          table,
          displayName: `${schema.charAt(0).toUpperCase() + schema.slice(1)}.${table.charAt(0).toUpperCase() + table.slice(1)}`,
        };
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName));

    // Cache the result
    cachedSchemasTables = schemasTables;
    return schemasTables;
  } catch (error) {
    console.error('Failed to discover schemas and tables:', error);
    // Return empty array on error
    return [];
  }
}

export async function fetchTableData(
  schema: string,
  table: string,
  page: number = 1,
  pageSize: number = 100
): Promise<PaginatedResponse<Record<string, any>>> {
  const url = `${API_BASE_URL}/api/${schema}/${table}?page=${page}&pageSize=${pageSize}`;

  const authHeader = authService.getAuthHeader();
  if (!authHeader.Authorization) {
    throw new Error('Authentication required');
  }

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      authService.logout();
      throw new Error('Authentication expired. Please log in again.');
    }
    throw new Error(`Failed to fetch data: ${response.statusText}`);
  }

  return response.json();
}

export async function testConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    return response.ok;
  } catch (error) {
    return false;
  }
}

export function getUniqueSchemas(schemasTables: SchemaTable[]): string[] {
  const schemas = new Set(schemasTables.map(st => st.schema));
  return Array.from(schemas).sort();
}

export function getTablesForSchema(schema: string, schemasTables: SchemaTable[]): SchemaTable[] {
  return schemasTables.filter(st => st.schema === schema);
}
