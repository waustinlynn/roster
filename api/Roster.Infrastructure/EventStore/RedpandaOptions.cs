namespace Roster.Infrastructure.EventStore;

public class RedpandaOptions
{
    public string BootstrapServers { get; set; } = "localhost:9092";
    public string Topic { get; set; } = "roster-events";
}
