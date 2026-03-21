namespace Roster.Domain.Events;
public record PlayerDeactivated : DomainEvent
{
    public override string EventType { get; init; } = nameof(PlayerDeactivated);
    public required Guid PlayerId { get; init; }
}
