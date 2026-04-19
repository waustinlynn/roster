namespace Roster.Application.Queries.GetGame;

using MediatR;
using Roster.Application.Commands.AssignInningFielding;

public record GetGameQuery(Guid GameId) : IRequest<GameDto?>;
public record GetGamesQuery(Guid TeamId) : IRequest<IReadOnlyList<GameSummaryDto>>;

public record InningScoreDto(int HomeScore, int AwayScore);

public record GameDto(
    Guid GameId,
    string Date,
    string? Opponent,
    int InningCount,
    bool IsLocked,
    IReadOnlyList<Guid> AbsentPlayerIds,
    IReadOnlyList<Guid> BattingOrder,
    IReadOnlyDictionary<int, IReadOnlyList<FieldingAssignmentDto>> InningAssignments,
    IReadOnlyDictionary<int, InningScoreDto> InningScores);

public record GameSummaryDto(
    Guid GameId,
    string Date,
    string? Opponent,
    int InningCount,
    bool IsLocked,
    IReadOnlyList<Guid> AbsentPlayerIds);
