namespace Roster.Application.Queries.GetTeam;

using MediatR;

public record GetTeamQuery(Guid TeamId) : IRequest<GetTeamResult?>;

public record GetTeamResult(
    Guid TeamId,
    string Name,
    string SportName,
    SportDto Sport);

public record SportDto(string Name, IReadOnlyList<string> Skills, IReadOnlyList<string> Positions);
