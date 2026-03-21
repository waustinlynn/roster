namespace Roster.Application.Commands.DeactivatePlayer;
using MediatR;
public record DeactivatePlayerCommand(Guid TeamId, Guid PlayerId) : IRequest;
