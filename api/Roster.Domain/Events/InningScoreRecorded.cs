namespace Roster.Domain.Events;

public record InningScoreRecorded : DomainEvent
{
    public override string EventType { get; init; } = nameof(InningScoreRecorded);
    public required Guid GameId { get; init; }
    public required int InningNumber { get; init; }
    public required int HomeScore { get; init; }
    public required int AwayScore { get; init; }
}
