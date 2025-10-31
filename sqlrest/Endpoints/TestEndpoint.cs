using FastEndpoints;

namespace SqlRest.Endpoints;

public class TestEndpoint : EndpointWithoutRequest
{
    public override void Configure()
    {
        Get("/api/test");
        // Require authentication - removed AllowAnonymous()
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        await Send.OkAsync(new { message = "API is working!", timestamp = DateTime.UtcNow });
    }
}
