namespace Roster.Application.Commands.RecordInningScore;

using MediatR;

public record RecordInningScoreCommand(
    Guid TeamId,
    Guid GameId,
    int InningNumber,
    int HomeScore,
    int AwayScore) : IRequest;
