namespace Roster.Domain.Events;
public record TeamCreated : DomainEvent
{
    public override string EventType { get; init; } = nameof(TeamCreated);
    public required string Name { get; init; }
    public required string SportName { get; init; }
    public required string AccessSecretHash { get; init; }
}
