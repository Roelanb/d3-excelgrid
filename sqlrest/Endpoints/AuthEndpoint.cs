using FastEndpoints;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace SqlRest.Endpoints;

public class LoginRequest
{
    public required string Username { get; set; }
    public required string Password { get; set; }
}

public class LoginResponse
{
    public required string Token { get; set; }
    public required int ExpiresIn { get; set; }
    public required string TokenType { get; set; }
}

public class AuthEndpoint : Endpoint<LoginRequest, LoginResponse>
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthEndpoint> _logger;

    public AuthEndpoint(IConfiguration configuration, ILogger<AuthEndpoint> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public override void Configure()
    {
        Post("/auth/login");
        AllowAnonymous();
        Options(x => x
            .Accepts<LoginRequest>("application/json")
            .Produces<LoginResponse>(200, "application/json")
            .ProducesProblemDetails(400)
            .ProducesProblemDetails(401));
    }

    public override async Task HandleAsync(LoginRequest req, CancellationToken ct)
    {
        try
        {
            _logger.LogInformation("Login attempt for user: {Username}", req?.Username ?? "null");
            
            if (req == null || string.IsNullOrEmpty(req.Username) || string.IsNullOrEmpty(req.Password))
            {
                _logger.LogWarning("Invalid login request - missing username or password");
                ThrowError("Username and password are required");
            }

            var validUsername = _configuration["AUTH_USERNAME"] ?? "admin";
            var validPassword = _configuration["AUTH_PASSWORD"] ?? "admin";

            if (req.Username != validUsername || req.Password != validPassword)
            {
                _logger.LogWarning("Login failed for user: {Username} - invalid credentials", req.Username);
                await SendUnauthorizedAsync(ct);
                return;
            }

        var jwtKey = _configuration["JWT_KEY"] ?? throw new InvalidOperationException("JWT_KEY not configured");
        var jwtIssuer = _configuration["JWT_ISSUER"] ?? "SqlRestApi";
        var jwtAudience = _configuration["JWT_AUDIENCE"] ?? "SqlRestApi";
        var jwtExpiryMinutes = int.Parse(_configuration["JWT_EXPIRY_MINUTES"] ?? "60");

        var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, req.Username),
            new Claim("username", req.Username),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var token = new JwtSecurityToken(
            issuer: jwtIssuer,
            audience: jwtAudience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(jwtExpiryMinutes),
            signingCredentials: credentials
        );

        var tokenString = new JwtSecurityTokenHandler().WriteToken(token);

            _logger.LogInformation("Login successful for user: {Username}", req.Username);
            await SendAsync(new LoginResponse
            {
                Token = tokenString,
                ExpiresIn = jwtExpiryMinutes * 60,
                TokenType = "Bearer"
            }, cancellation: ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during login");
            ThrowError(ex.Message);
        }
    }
}

public class HealthEndpoint : EndpointWithoutRequest
{
    public override void Configure()
    {
        Get("/health");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        await SendAsync(new
        {
            Status = "healthy",
            Timestamp = DateTime.UtcNow
        }, cancellation: ct);
    }
}
