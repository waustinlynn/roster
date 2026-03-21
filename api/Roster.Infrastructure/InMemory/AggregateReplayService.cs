namespace Roster.Infrastructure.InMemory;

using Confluent.Kafka;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Roster.Infrastructure.EventStore;
using System.Text.Json;

public class AggregateReplayService : BackgroundService
{
    private readonly TaskCompletionSource _readyTcs = new(TaskCreationOptions.RunContinuationsAsynchronously);

    /// <summary>Completes when the initial replay has finished and the service is live.</summary>
    public Task ReadyAsync => _readyTcs.Task;

    public bool IsReady => _readyTcs.Task.IsCompletedSuccessfully;

    /// <summary>Signals the service as ready. Available to test subclasses.</summary>
    protected void MarkReady() => _readyTcs.TrySetResult();

    private readonly InMemoryStore _store;
    private readonly ILogger<AggregateReplayService> _logger;
    private readonly RedpandaOptions _options;

    public AggregateReplayService(
        InMemoryStore store,
        ILogger<AggregateReplayService> logger,
        IOptions<RedpandaOptions> options)
    {
        _store = store;
        _logger = logger;
        _options = options.Value;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Yield immediately so host startup is never blocked by Kafka I/O
        await Task.Yield();

        _logger.LogInformation("AggregateReplayService starting replay from {Bootstrap}", _options.BootstrapServers);

        var instanceId = Guid.NewGuid().ToString("N")[..8];
        var replayGroupId = $"replay-{instanceId}";

        var config = new ConsumerConfig
        {
            BootstrapServers = _options.BootstrapServers,
            GroupId = replayGroupId,
            AutoOffsetReset = AutoOffsetReset.Earliest,
            EnableAutoCommit = false,
        };

        using var consumer = new ConsumerBuilder<string, string>(config).Build();

        try
        {
            // Get all partitions via AdminClient (GetMetadata moved off IConsumer in Confluent.Kafka 2.x)
            var adminConfig = new AdminClientConfig { BootstrapServers = _options.BootstrapServers };
            using var adminClient = new AdminClientBuilder(adminConfig).Build();
            var metadata = adminClient.GetMetadata(_options.Topic, TimeSpan.FromSeconds(10));
            var partitions = metadata.Topics[0].Partitions
                .Select(p => new TopicPartition(_options.Topic, p.PartitionId))
                .ToList();

            consumer.Assign(partitions);

            // Seek all to beginning
            foreach (var tp in partitions)
                consumer.Seek(new TopicPartitionOffset(tp, Offset.Beginning));

            // Sample high watermarks now — we replay up to these offsets
            var watermarks = partitions.ToDictionary(
                tp => tp,
                tp => consumer.QueryWatermarkOffsets(tp, TimeSpan.FromSeconds(5)).High);

            long replayCount = 0;

            // Replay phase: consume up to the watermarks
            bool replayComplete = partitions.All(tp => watermarks[tp].Value <= 0);

            while (!replayComplete && !stoppingToken.IsCancellationRequested)
            {
                var result = consumer.Consume(TimeSpan.FromMilliseconds(500));
                if (result is null) continue;

                var @event = EventSerializer.Deserialize(result.Message.Value);
                if (@event is not null)
                {
                    _store.Apply(@event);
                    replayCount++;
                }

                // Check if we've caught up on all partitions
                replayComplete = partitions.All(tp =>
                {
                    var pos = consumer.Position(tp);
                    return pos == Offset.Unset || pos.Value >= watermarks[tp].Value;
                });
            }

            _logger.LogInformation("Replay complete. Applied {Count} events. Switching to live consumption.", replayCount);
            _readyTcs.TrySetResult();

            // Live consumption phase
            while (!stoppingToken.IsCancellationRequested)
            {
                var result = consumer.Consume(TimeSpan.FromMilliseconds(500));
                if (result is null) continue;

                var @event = EventSerializer.Deserialize(result.Message.Value);
                if (@event is not null)
                    _store.Apply(@event);
            }
        }
        catch (OperationCanceledException)
        {
            // Normal shutdown — if we never became ready, signal cancellation so awaiters unblock
            _readyTcs.TrySetCanceled(stoppingToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AggregateReplayService encountered a fatal error; service will remain unhealthy");
            _readyTcs.TrySetException(ex);
        }
        finally
        {
            consumer.Close();
        }
    }
}
