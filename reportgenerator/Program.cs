using FastEndpoints;
using FastEndpoints.Swagger;
using QuestPDF.Infrastructure;
using ReportGenerator.Services;

var builder = WebApplication.CreateBuilder(args);

// Configure QuestPDF license (Community license for open source)
QuestPDF.Settings.License = LicenseType.Community;

// Configure logging
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.AddDebug();
builder.Logging.SetMinimumLevel(LogLevel.Information);

// Load configuration from environment variables
builder.Configuration.AddEnvironmentVariables();

// Add services
builder.Services.AddFastEndpoints();
builder.Services.SwaggerDocument(o =>
{
    o.DocumentSettings = s =>
    {
        s.Title = "Report Generator API";
        s.Version = "v1";
        s.Description = "REST API for generating PDF reports from report definitions";
    };
});

// Register application services
builder.Services.AddSingleton<ParameterSubstitutionService>();
builder.Services.AddSingleton<BarcodeService>();
builder.Services.AddSingleton<ImageService>();
builder.Services.AddScoped<PdfGeneratorService>();

// Configure CORS
var corsOrigins = builder.Configuration["CORS_ALLOWED_ORIGINS"]?.Split(',')
    ?? new[] { "http://localhost:5173", "http://localhost:3000", "http://localhost:5174" };

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(corsOrigins)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

var app = builder.Build();

// Configure middleware
app.UseCors();

app.UseFastEndpoints(c =>
{
    c.Endpoints.RoutePrefix = "api";
});

app.UseSwaggerGen();

app.Run();
