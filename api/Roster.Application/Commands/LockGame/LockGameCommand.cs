namespace Roster.Application.Commands.LockGame;
using MediatR;
public record LockGameCommand(Guid TeamId, Guid GameId) : IRequest;
