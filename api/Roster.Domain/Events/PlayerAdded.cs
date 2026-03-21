namespace Roster.Domain.Events;
public record PlayerAdded : DomainEvent
{
    public override string EventType { get; init; } = nameof(PlayerAdded);
    public required Guid PlayerId { get; init; }
    public required string Name { get; init; }
}
