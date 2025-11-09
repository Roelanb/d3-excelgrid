export type Bindings = {
  JWT_KEY: string;
  DB_CONNECTION_STRING: string;
  AUTH_USERNAME: string;
  AUTH_PASSWORD: string;
  JWT_ISSUER: string;
  JWT_AUDIENCE: string;
  JWT_EXPIRY_MINUTES: string;
  CORS_ORIGINS: string;
  // Optional D1 binding
  DB?: D1Database;
};

export type Env = {
  Bindings: Bindings;
};
