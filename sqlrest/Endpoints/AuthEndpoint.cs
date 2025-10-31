using FastEndpoints;
using FastEndpoints.Swagger;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace SqlRest.Endpoints;

/// <summary>
/// Endpoint for JWT authentication
/// Route: POST /api/auth/login
/// </summary>
public class AuthEndpoint : Endpoint<AuthRequest, AuthResponse>
{
    private readonly IConfiguration _configuration;

    public AuthEndpoint(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public override void Configure()
    {
        Post("/api/auth/login");
        AllowAnonymous(); // This endpoint must be anonymous to allow login
        Summary(s =>
        {
            s.Summary = "Authenticate user and get JWT token";
            s.Description = "Provides JWT token for API access";
        });
    }

    public override async Task HandleAsync(AuthRequest req, CancellationToken ct)
    {
        try
        {
            // For development, accept any non-empty username/password
            // In production, implement proper user authentication against a user store
            var validUsername = _configuration["Auth:Username"] ?? "admin";
            var validPassword = _configuration["Auth:Password"] ?? "admin";

            if (string.IsNullOrEmpty(req.Username) || string.IsNullOrEmpty(req.Password))
            {
                await Send.UnauthorizedAsync();
                return;
            }

            // Simple authentication - in production, use proper password hashing and user validation
            if (req.Username != validUsername || req.Password != validPassword)
            {
                await Send.UnauthorizedAsync();
                return;
            }

            // Generate JWT token
            var jwtKey = _configuration["Jwt:Key"] ?? "DefaultSecretKeyForDevelopmentOnly123456789";
            var jwtIssuer = _configuration["Jwt:Issuer"] ?? "SqlRestApi";
            var jwtAudience = _configuration["Jwt:Audience"] ?? "SqlRestApi";
            var jwtExpiryMinutes = Convert.ToInt32(_configuration["Jwt:ExpiryMinutes"] ?? "60");

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
            var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
                new Claim(ClaimTypes.Name, req.Username),
                new Claim(ClaimTypes.Role, "User"),
                new Claim("jti", Guid.NewGuid().ToString())
            };

            var token = new JwtSecurityToken(
                issuer: jwtIssuer,
                audience: jwtAudience,
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(jwtExpiryMinutes),
                signingCredentials: credentials
            );

            var tokenString = new JwtSecurityTokenHandler().WriteToken(token);

            var response = new AuthResponse
            {
                Token = tokenString,
                ExpiresIn = jwtExpiryMinutes * 60, // seconds
                TokenType = "Bearer"
            };

            await Send.OkAsync(response);
        }
        catch (Exception)
        {
            await Send.ErrorsAsync(500);
        }
    }
}

public class AuthRequest
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class AuthResponse
{
    public string Token { get; set; } = string.Empty;
    public int ExpiresIn { get; set; }
    public string TokenType { get; set; } = string.Empty;
}
