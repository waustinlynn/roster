namespace Roster.Domain.Events;
public record PlayerMarkedAbsent : DomainEvent
{
    public override string EventType { get; init; } = nameof(PlayerMarkedAbsent);
    public required Guid GameId { get; init; }
    public required Guid PlayerId { get; init; }
}
