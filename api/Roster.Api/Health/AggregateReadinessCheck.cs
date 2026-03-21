namespace Roster.Api.Health;

using Microsoft.Extensions.Diagnostics.HealthChecks;
using Roster.Infrastructure.InMemory;

public class AggregateReadinessCheck : IHealthCheck
{
    private readonly AggregateReplayService _replayService;

    public AggregateReadinessCheck(AggregateReplayService replayService)
    {
        _replayService = replayService;
    }

    public Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        var result = _replayService.IsReady
            ? HealthCheckResult.Healthy("Aggregate replay complete.")
            : HealthCheckResult.Unhealthy("Aggregate replay in progress.");

        return Task.FromResult(result);
    }
}
