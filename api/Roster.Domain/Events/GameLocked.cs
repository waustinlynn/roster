namespace Roster.Domain.Events;
public record GameLocked : DomainEvent
{
    public override string EventType { get; init; } = nameof(GameLocked);
    public required Guid GameId { get; init; }
}
