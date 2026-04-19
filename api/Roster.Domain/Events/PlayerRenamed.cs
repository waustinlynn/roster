namespace Roster.Domain.Events;
public record PlayerRenamed : DomainEvent
{
    public override string EventType { get; init; } = nameof(PlayerRenamed);
    public required Guid PlayerId { get; init; }
    public required string NewName { get; init; }
}
