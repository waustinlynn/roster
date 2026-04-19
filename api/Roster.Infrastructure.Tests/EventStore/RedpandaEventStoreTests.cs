namespace Roster.Infrastructure.Tests.EventStore;

using Confluent.Kafka;
using Confluent.Kafka.Admin;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Roster.Domain.Events;
using Roster.Domain.Exceptions;
using Roster.Infrastructure.EventStore;
using Roster.Infrastructure.InMemory;
using Testcontainers.Redpanda;

[Trait("Category", "Integration")]
public class RedpandaEventStoreTests : IAsyncLifetime
{
    private readonly RedpandaContainer _container = new RedpandaBuilder().Build();

    public Task InitializeAsync() => _container.StartAsync();
    public Task DisposeAsync() => _container.DisposeAsync().AsTask();

    [Fact]
    public async Task AppendAsync_WithRunningRedpanda_PublishesEvents()
    {
        var bootstrapServers = _container.GetBootstrapAddress();
        var topic = "roster-events-test-publish";

        using var adminClient = new AdminClientBuilder(
            new AdminClientConfig { BootstrapServers = bootstrapServers }).Build();
        await adminClient.CreateTopicsAsync([new TopicSpecification
            { Name = topic, NumPartitions = 1, ReplicationFactor = 1 }]);

        var options = new RedpandaOptions { BootstrapServers = bootstrapServers, Topic = topic };
        var store = new RedpandaEventStore(
            Options.Create(options),
            NullLogger<RedpandaEventStore>.Instance,
            new InMemoryStore(NullLogger<InMemoryStore>.Instance));

        var teamId = Guid.NewGuid();
        await store.AppendAsync([
            new TeamCreated { TeamId = teamId, Name = "Test", SportName = "Softball", AccessSecretHash = "hash" }
        ]);

        // Verify by consuming
        var config = new ConsumerConfig
        {
            BootstrapServers = bootstrapServers,
            GroupId = "test-verify",
            AutoOffsetReset = AutoOffsetReset.Earliest,
        };
        using var consumer = new ConsumerBuilder<string, string>(config).Build();
        consumer.Subscribe(topic);
        var msg = consumer.Consume(TimeSpan.FromSeconds(10));

        Assert.NotNull(msg);
        Assert.Contains("TeamCreated", msg.Message.Value);
        consumer.Close();
    }
}
