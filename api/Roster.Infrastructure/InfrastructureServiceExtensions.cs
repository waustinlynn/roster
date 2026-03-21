namespace Roster.Infrastructure;

using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Roster.Application.Interfaces;
using Roster.Domain.Interfaces;
using Roster.Infrastructure.EventStore;
using Roster.Infrastructure.InMemory;
using Roster.Infrastructure.Security;

public static class InfrastructureServiceExtensions
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.Configure<RedpandaOptions>(configuration.GetSection("Redpanda"));

        // InMemoryStore is singleton shared across all components
        services.AddSingleton<InMemoryStore>();
        services.AddSingleton<ITeamRepository>(sp => sp.GetRequiredService<InMemoryStore>());
        services.AddSingleton<IInMemoryStore>(sp => sp.GetRequiredService<InMemoryStore>());

        // Background service for aggregate replay
        services.AddSingleton<AggregateReplayService>();
        services.AddHostedService(sp => sp.GetRequiredService<AggregateReplayService>());

        // Event store
        services.AddSingleton<IEventStore, RedpandaEventStore>();

        // Access secret service
        services.AddSingleton<AccessSecretService>();

        return services;
    }
}
