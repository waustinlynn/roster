namespace Roster.Application.Commands.CreateGame;
using MediatR;
public record CreateGameCommand(Guid TeamId, string Date, string? Opponent, int InningCount) : IRequest<CreateGameResult>;
public record CreateGameResult(Guid GameId);
