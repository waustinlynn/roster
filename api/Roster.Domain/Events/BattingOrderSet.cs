namespace Roster.Domain.Events;
public record BattingOrderSet : DomainEvent
{
    public override string EventType { get; init; } = nameof(BattingOrderSet);
    public required Guid GameId { get; init; }
    public required IReadOnlyList<Guid> OrderedPlayerIds { get; init; }
}
