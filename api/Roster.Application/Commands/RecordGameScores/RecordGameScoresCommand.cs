namespace Roster.Application.Commands.RecordGameScores;

using MediatR;

public record InningScoreEntry(int HomeScore, int AwayScore);

public record RecordGameScoresCommand(
    Guid TeamId,
    Guid GameId,
    IReadOnlyDictionary<int, InningScoreEntry> InningScores) : IRequest;
