namespace Roster.Domain.Events;

public record GameRemarkRecorded : DomainEvent
{
    public override string EventType { get; init; } = nameof(GameRemarkRecorded);
    public required Guid GameId { get; init; }
    public required string Remark { get; init; }
}
