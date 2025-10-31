using FastEndpoints;
using SqlRest.DTOs;
using SqlRest.Services;

namespace SqlRest.Endpoints;

/// <summary>
/// Factory for creating dynamic endpoint instances for database tables.
/// These endpoints are discovered at runtime by querying the database schema.
/// </summary>
public static class DynamicEndpointFactory
{
    private static readonly List<Type> _generatedEndpointTypes = new();

    public static IEnumerable<Type> GetGeneratedEndpointTypes() => _generatedEndpointTypes;

    public static void RegisterEndpointsForTable(string schema, string table)
    {
        // For each table, we create 5 concrete endpoint classes
        // FastEndpoints will discover these through assembly scanning
        
        // Note: We can't use dynamic type generation with Reflection.Emit because
        // FastEndpoints won't discover those types. Instead, we create concrete
        // classes that inherit from our base classes.
        
        // The actual registration happens through the concrete endpoint classes
        // that are created in the DynamicTableEndpoints.cs file
    }
}
