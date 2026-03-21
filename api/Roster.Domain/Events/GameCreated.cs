namespace Roster.Domain.Events;
public record GameCreated : DomainEvent
{
    public override string EventType { get; init; } = nameof(GameCreated);
    public required Guid GameId { get; init; }
    public required DateOnly Date { get; init; }
    public string? Opponent { get; init; }
    public required int InningCount { get; init; }
}
