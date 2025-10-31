using FastEndpoints;
using FastEndpoints.Swagger;
using SqlRest.Services;
using SqlRest.Endpoints;

var builder = WebApplication.CreateBuilder(args);

// Add environment variables support
builder.Configuration.AddEnvironmentVariables();

// Add services to the container
builder.Services.AddFastEndpoints();
builder.Services.SwaggerDocument();

// Add JWT Authentication
builder.Services.AddAuthentication("Bearer")
    .AddJwtBearer("Bearer", options =>
    {
        var jwtKey = builder.Configuration["Jwt:Key"] ?? "DefaultSecretKeyForDevelopmentOnly123456789";
        var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "SqlRestApi";
        var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "SqlRestApi";
        
        options.TokenValidationParameters = new Microsoft.IdentityModel.Tokens.TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(
                System.Text.Encoding.UTF8.GetBytes(jwtKey))
        };
    });

builder.Services.AddAuthorization();

// Register database service
builder.Services.AddScoped<IDatabaseService, DatabaseService>();

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("RestrictedPolicy", policy =>
    {
        // Try to get origins from configuration, fallback to environment variable, then defaults
        var configOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>();
        var envOrigins = builder.Configuration["Cors:AllowedOrigins"]?.Split(',', StringSplitOptions.RemoveEmptyEntries);

        var allowedOrigins = configOrigins
            ?? envOrigins
            ?? new[] { "http://localhost:5173", "http://localhost:3000", "http://localhost:5174" };

        policy.WithOrigins(allowedOrigins)
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();

// Log available tables at startup (optional)
try
{
    using var scope = app.Services.CreateScope();
    var dbService = scope.ServiceProvider.GetRequiredService<IDatabaseService>();
    var configuration = scope.ServiceProvider.GetRequiredService<IConfiguration>();

    Console.WriteLine("Discovering database tables...");
    var schemasAndTables = await dbService.GetAllSchemasAndTablesAsync();

    // Get filtering configuration
    var allowedSchemas = configuration.GetSection("DynamicEndpoints:AllowedSchemas").Get<string[]>() ?? Array.Empty<string>();
    var excludedSchemas = configuration.GetSection("DynamicEndpoints:ExcludedSchemas").Get<string[]>() ?? new[] { "sys", "INFORMATION_SCHEMA" };
    var excludedTables = configuration.GetSection("DynamicEndpoints:ExcludedTables").Get<string[]>() ?? Array.Empty<string>();

    int totalTables = 0;

    foreach (var schema in schemasAndTables)
    {
        // Skip excluded schemas
        if (excludedSchemas.Contains(schema.Key, StringComparer.OrdinalIgnoreCase))
            continue;

        // If allowedSchemas is specified, only include those schemas
        if (allowedSchemas.Length > 0 && !allowedSchemas.Contains(schema.Key, StringComparer.OrdinalIgnoreCase))
            continue;

        Console.WriteLine($"Schema: {schema.Key}");
        foreach (var table in schema.Value)
        {
            // Skip excluded tables
            if (excludedTables.Contains(table, StringComparer.OrdinalIgnoreCase))
                continue;

            Console.WriteLine($"  - {schema.Key}.{table}");
            totalTables++;
        }
    }

    Console.WriteLine($"\nGeneric endpoints will handle CRUD operations for all {totalTables} tables");
    Console.WriteLine("Access any table via: GET/POST/PUT/DELETE /api/{{schema}}/{{table}}");
}
catch (Exception ex)
{
    Console.WriteLine($"Warning: Failed to discover database tables: {ex.Message}");
}

// Configure the HTTP request pipeline
app.UseHttpsRedirection();
app.UseCors("RestrictedPolicy");

app.UseAuthentication();
app.UseAuthorization();

app.UseFastEndpoints();
app.UseSwaggerGen();

app.Run();
