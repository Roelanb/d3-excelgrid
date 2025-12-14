import { getSqlRestBaseUrl } from './runtimeConfig';

function getApiBaseUrl(): string {
    return `${getSqlRestBaseUrl()}/api`;
}

interface LoginResponse {
    token: string;
    expiresIn: number;
    tokenType: string;
}

export const api = {
    token: localStorage.getItem('auth_token'),

    async ensureToken() {
        if (!this.token) {
            await this.login();
        }
    },

    async executeQuery(sql: string): Promise<any> {
        await this.ensureToken();

        try {
            const response = await fetch(`${getApiBaseUrl()}/query`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ sql }),
            });

            if (response.status === 401) {
                await this.login();
                return this.executeQuery(sql);
            }

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || 'Failed to execute query');
            }

            return await response.json();
        } catch (error) {
            console.error('Execute query error:', error);
            return null;
        }
    },

    async getQueryResultSchema(sql: string): Promise<any[][]> {
        await this.ensureToken();

        try {
            const response = await fetch(`${getApiBaseUrl()}/query/result-schema`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ sql }),
            });

            if (response.status === 401) {
                await this.login();
                return this.getQueryResultSchema(sql);
            }

            if (!response.ok) {
                return [];
            }

            const data = await response.json();
            return data.resultSets || data.ResultSets || [];
        } catch (error) {
            console.error('Get query result schema error:', error);
            return [];
        }
    },

    async login() {
        try {
            const response = await fetch(`${getApiBaseUrl()}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: 'admin',
                    password: 'admin',
                }),
            });

            if (!response.ok) {
                throw new Error('Login failed');
            }

            const data: LoginResponse = await response.json();
            this.token = data.token;
            localStorage.setItem('auth_token', data.token);
            return data.token;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    },

    async getTables(): Promise<string[]> {
        await this.ensureToken();

        try {
            const response = await fetch(`${getApiBaseUrl()}/tables`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                },
            });

            if (response.status === 401) {
                // Token might be expired, try logging in again
                await this.login();
                return this.getTables();
            }

            if (!response.ok) {
                throw new Error('Failed to fetch tables');
            }

            const data = await response.json();
            return data.tables.map((t: any) => t.fullName);
        } catch (error) {
            console.error('Get tables error:', error);
            return [];
        }
    },

    async getViews(): Promise<string[]> {
        await this.ensureToken();

        try {
            const response = await fetch(`${getApiBaseUrl()}/views`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                },
            });

            if (response.status === 401) {
                await this.login();
                return this.getViews();
            }

            if (!response.ok) {
                throw new Error('Failed to fetch views');
            }

            const data = await response.json();
            return (data.views || []).map((v: any) => v.fullName);
        } catch (error) {
            console.error('Get views error:', error);
            return [];
        }
    },

    async getStoredProcedures(): Promise<string[]> {
        await this.ensureToken();

        try {
            const response = await fetch(`${getApiBaseUrl()}/stored-procedures`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                },
            });

            if (response.status === 401) {
                await this.login();
                return this.getStoredProcedures();
            }

            if (!response.ok) {
                throw new Error('Failed to fetch stored procedures');
            }

            const data = await response.json();
            return (data.storedProcedures || []).map((p: any) => p.fullName);
        } catch (error) {
            console.error('Get stored procedures error:', error);
            return [];
        }
    },

    async getData(tableName: string): Promise<any> {
        await this.ensureToken();

        try {
            let schema = 'dbo';
            let table = tableName;

            if (tableName.includes('.')) {
                [schema, table] = tableName.split('.');
            }

            const response = await fetch(`${getApiBaseUrl()}/${schema}/${table}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                },
            });

            if (response.status === 401) {
                await this.login();
                return this.getData(tableName);
            }

            if (!response.ok) {
                throw new Error(`Failed to fetch data for ${tableName}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`Get data error for ${tableName}:`, error);
            return null;
        }
    },

    async executeStoredProcedure(schema: string, procedure: string, parameters: Record<string, string> = {}): Promise<any> {
        await this.ensureToken();

        try {
            const qs = new URLSearchParams();
            Object.entries(parameters).forEach(([k, v]) => {
                if (v !== undefined && v !== null) qs.set(k, String(v));
            });

            const queryString = qs.toString();
            const url = `${getApiBaseUrl()}/stored-procedures/${schema}/${procedure}${queryString ? `?${queryString}` : ''}`;

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                },
            });

            if (response.status === 401) {
                await this.login();
                return this.executeStoredProcedure(schema, procedure, parameters);
            }

            if (!response.ok) {
                throw new Error(`Failed to execute stored procedure ${schema}.${procedure}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`Execute stored procedure error for ${schema}.${procedure}:`, error);
            return null;
        }
    },

    async getStoredProcedureParameters(schema: string, procedure: string): Promise<any[]> {
        await this.ensureToken();

        try {
            const response = await fetch(`${getApiBaseUrl()}/stored-procedures/${schema}/${procedure}/parameters`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                },
            });

            if (response.status === 401) {
                await this.login();
                return this.getStoredProcedureParameters(schema, procedure);
            }

            if (!response.ok) {
                throw new Error(`Failed to fetch stored procedure parameters for ${schema}.${procedure}`);
            }

            const data = await response.json();
            return data.parameters || [];
        } catch (error) {
            console.error(`Get stored procedure parameters error for ${schema}.${procedure}:`, error);
            return [];
        }
    },

    async getStoredProcedureResultSchema(schema: string, procedure: string, parameters: Record<string, string> = {}): Promise<any[][]> {
        await this.ensureToken();

        try {
            const qs = new URLSearchParams();
            Object.entries(parameters).forEach(([k, v]) => {
                if (v !== undefined && v !== null) qs.set(k, String(v));
            });
            const queryString = qs.toString();
            const url = `${getApiBaseUrl()}/stored-procedures/${schema}/${procedure}/result-schema${queryString ? `?${queryString}` : ''}`;

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                },
            });

            if (response.status === 401) {
                await this.login();
                return this.getStoredProcedureResultSchema(schema, procedure, parameters);
            }

            if (!response.ok) {
                throw new Error(`Failed to fetch stored procedure result schema for ${schema}.${procedure}`);
            }

            const data = await response.json();
            return data.resultSets || [];
        } catch (error) {
            console.error(`Get stored procedure result schema error for ${schema}.${procedure}:`, error);
            return [];
        }
    },

    async getColumns(tableName: string): Promise<string[]> {
        // Schema endpoint is public, no token needed
        try {
            let schema = 'dbo';
            let table = tableName;

            if (tableName.includes('.')) {
                [schema, table] = tableName.split('.');
            }

            const response = await fetch(`${getApiBaseUrl()}/tables/${schema}/${table}/schema`);

            if (!response.ok) {
                return [];
            }

            const data = await response.json();
            return data.columns.map((c: any) => c.name);
        } catch (error) {
            console.error(`Get columns error for ${tableName}:`, error);
            return [];
        }
    }
};
