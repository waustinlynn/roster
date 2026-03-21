namespace Roster.Api.Middleware;

using System.Security.Cryptography;
using System.Text;
using Roster.Domain.Interfaces;

public class TeamAccessMiddleware
{
    private readonly RequestDelegate _next;

    // Routes that do NOT require authentication
    private static readonly HashSet<string> ExemptPaths = new(StringComparer.OrdinalIgnoreCase)
    {
        "/health",
    };

    public TeamAccessMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, ITeamRepository teamRepository)
    {
        var path = context.Request.Path.Value ?? string.Empty;
        var method = context.Request.Method;

        // POST /teams is unauthenticated (creates a new team)
        bool isExempt = ExemptPaths.Contains(path) ||
                        (method.Equals("POST", StringComparison.OrdinalIgnoreCase) &&
                         path.Equals("/teams", StringComparison.OrdinalIgnoreCase));

        if (!isExempt)
        {
            var secret = context.Request.Headers["X-Team-Secret"].FirstOrDefault();

            if (string.IsNullOrWhiteSpace(secret))
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await context.Response.WriteAsJsonAsync(new { error = "X-Team-Secret header is required." });
                return;
            }

            var hash = ComputeHash(secret);
            var team = teamRepository.GetBySecretHash(hash);

            if (team is null)
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await context.Response.WriteAsJsonAsync(new { error = "Invalid team secret." });
                return;
            }

            // Store resolved TeamId for downstream use
            context.Items["TeamId"] = team.TeamId;
        }

        await _next(context);
    }

    private static string ComputeHash(string plaintext)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(plaintext));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}
