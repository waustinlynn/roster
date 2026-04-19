namespace Roster.Application.Commands.RenamePlayer;

using MediatR;

public record RenamePlayerCommand(Guid TeamId, Guid PlayerId, string NewName) : IRequest;
