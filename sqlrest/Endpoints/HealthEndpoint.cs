using FastEndpoints;

namespace SqlRest.Endpoints;

public class HealthEndpoint : EndpointWithoutRequest
{
    public override void Configure()
    {
        Get("/api/health");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        await Send.OkAsync(new { 
            status = "healthy", 
            timestamp = DateTime.UtcNow,
            endpoints = new[] {
                "/api/person/address",
                "/api/person/person", 
                "/api/person/stateprovince",
                "/api/production/product",
                "/api/production/productcategory",
                "/api/production/productsubcategory",
                "/api/production/location",
                "/api/production/billofmaterials",
                "/api/production/workorder"
            }
        });
    }
}
