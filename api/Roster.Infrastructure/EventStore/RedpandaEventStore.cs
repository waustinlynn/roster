namespace Roster.Infrastructure.EventStore;

using Confluent.Kafka;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Roster.Domain.Events;
using Roster.Domain.Exceptions;
using Roster.Domain.Interfaces;
using Roster.Infrastructure.InMemory;

public class RedpandaEventStore : IEventStore, IDisposable
{
    private readonly IProducer<string, string> _producer;
    private readonly RedpandaOptions _options;
    private readonly ILogger<RedpandaEventStore> _logger;
    private readonly InMemoryStore _store;

    public RedpandaEventStore(
        IOptions<RedpandaOptions> options,
        ILogger<RedpandaEventStore> logger,
        InMemoryStore store)
    {
        _options = options.Value;
        _logger = logger;
        _store = store;

        var config = new ProducerConfig
        {
            BootstrapServers = _options.BootstrapServers,
            Acks = Acks.All,
            MessageTimeoutMs = 4000, // part of the <5s total budget
        };

        _producer = new ProducerBuilder<string, string>(config).Build();
    }

    public async Task AppendAsync(IReadOnlyList<DomainEvent> events, CancellationToken ct = default)
    {
        const int maxRetries = 3;
        var deadline = DateTime.UtcNow.AddSeconds(5);

        foreach (var @event in events)
        {
            var json = EventSerializer.Serialize(@event);
            var message = new Message<string, string>
            {
                Key = @event.TeamId.ToString(),
                Value = json,
            };

            Exception? lastEx = null;
            for (int attempt = 1; attempt <= maxRetries; attempt++)
            {
                if (DateTime.UtcNow > deadline)
                    throw new EventStoreUnavailableException(
                        "Redpanda write deadline exceeded (5s).", lastEx!);

                try
                {
                    await _producer.ProduceAsync(_options.Topic, message, ct);
                    _store.Apply(@event);
                    _logger.LogDebug(
                        "Published {EventType} for team {TeamId} (attempt {Attempt})",
                        @event.EventType, @event.TeamId, attempt);
                    lastEx = null;
                    break;
                }
                catch (ProduceException<string, string> ex)
                {
                    lastEx = ex;
                    _logger.LogWarning(
                        "Redpanda produce attempt {Attempt}/{Max} failed: {Error}",
                        attempt, maxRetries, ex.Error.Reason);

                    if (attempt < maxRetries && DateTime.UtcNow < deadline)
                        await Task.Delay(TimeSpan.FromMilliseconds(500 * attempt), ct);
                }
            }

            if (lastEx is not null)
                throw new EventStoreUnavailableException(
                    $"Failed to publish {{{@event.EventType}}} after {maxRetries} attempts.", lastEx);
        }
    }

    public void Dispose() => _producer?.Dispose();
}
