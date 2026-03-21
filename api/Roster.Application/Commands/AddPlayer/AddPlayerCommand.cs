namespace Roster.Application.Commands.AddPlayer;
using MediatR;
public record AddPlayerCommand(Guid TeamId, string Name) : IRequest<AddPlayerResult>;
public record AddPlayerResult(Guid PlayerId);
