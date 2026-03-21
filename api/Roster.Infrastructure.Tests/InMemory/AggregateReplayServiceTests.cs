namespace Roster.Infrastructure.Tests.InMemory;

using Confluent.Kafka;
using Confluent.Kafka.Admin;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Roster.Domain.Events;
using Roster.Infrastructure.EventStore;
using Roster.Infrastructure.InMemory;
using Testcontainers.Redpanda;

[Trait("Category", "Integration")]
public class AggregateReplayServiceTests : IAsyncLifetime
{
    private readonly RedpandaContainer _container = new RedpandaBuilder().Build();

    public Task InitializeAsync() => _container.StartAsync();
    public Task DisposeAsync() => _container.DisposeAsync().AsTask();

    [Fact]
    public async Task Replay_WithPublishedEvents_BuildsInMemoryState()
    {
        var bootstrapServers = _container.GetBootstrapAddress();
        var topic = "roster-events-test";

        // Create topic
        using var adminClient = new AdminClientBuilder(new AdminClientConfig { BootstrapServers = bootstrapServers }).Build();
        await adminClient.CreateTopicsAsync([new TopicSpecification { Name = topic, NumPartitions = 1, ReplicationFactor = 1 }]);

        // Publish known events
        var options = new RedpandaOptions { BootstrapServers = bootstrapServers, Topic = topic };
        var eventStore = new RedpandaEventStore(
            Options.Create(options),
            NullLogger<RedpandaEventStore>.Instance);

        var teamId = Guid.NewGuid();
        await eventStore.AppendAsync([
            new TeamCreated { TeamId = teamId, Name = "Tigers", SportName = "Softball", AccessSecretHash = "hash" },
            new PlayerAdded { TeamId = teamId, PlayerId = Guid.NewGuid(), Name = "Alice" },
            new PlayerAdded { TeamId = teamId, PlayerId = Guid.NewGuid(), Name = "Bob" },
            new PlayerAdded { TeamId = teamId, PlayerId = Guid.NewGuid(), Name = "Carol" },
            new PlayerAdded { TeamId = teamId, PlayerId = Guid.NewGuid(), Name = "Dave" },
        ]);

        // Replay
        var store = new InMemoryStore(NullLogger<InMemoryStore>.Instance);
        var replayService = new AggregateReplayService(
            store,
            NullLogger<AggregateReplayService>.Instance,
            Options.Create(options));

        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(30));
        var replayTask = replayService.StartAsync(cts.Token);

        // Await the ready signal — no polling required
        await replayService.ReadyAsync.WaitAsync(cts.Token);

        var team = store.GetTeam(teamId);
        Assert.NotNull(team);
        Assert.Equal("Tigers", team.Name);
        Assert.Equal(4, team.Players.Count);

        cts.Cancel();
        try { await replayTask; } catch (OperationCanceledException) { }
    }
}
