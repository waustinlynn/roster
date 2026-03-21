namespace Roster.Application.Commands.CreateTeam;

using MediatR;

public record CreateTeamCommand(string Name, string SportName) : IRequest<CreateTeamResult>;

public record CreateTeamResult(Guid TeamId, string AccessSecret);
