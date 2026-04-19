namespace Roster.Domain.Events;

public record GameScoresRecorded : DomainEvent
{
    public override string EventType { get; init; } = nameof(GameScoresRecorded);
    public required Guid GameId { get; init; }
    public required IReadOnlyDictionary<int, GameInningScore> InningScores { get; init; }
}

public record GameInningScore(int HomeScore, int AwayScore);
