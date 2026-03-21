namespace Roster.Domain.Events;
public record PlayerAbsenceRevoked : DomainEvent
{
    public override string EventType { get; init; } = nameof(PlayerAbsenceRevoked);
    public required Guid GameId { get; init; }
    public required Guid PlayerId { get; init; }
}
