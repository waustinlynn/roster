namespace Roster.Application.Queries.GetTeam;

using MediatR;
using Roster.Application.Interfaces;

public class GetTeamQueryHandler : IRequestHandler<GetTeamQuery, GetTeamResult?>
{
    private readonly IInMemoryStore _store;

    public GetTeamQueryHandler(IInMemoryStore store) => _store = store;

    public Task<GetTeamResult?> Handle(GetTeamQuery request, CancellationToken cancellationToken)
    {
        var team = _store.GetTeam(request.TeamId);
        if (team is null) return Task.FromResult<GetTeamResult?>(null);

        var result = new GetTeamResult(
            TeamId: team.TeamId,
            Name: team.Name,
            SportName: team.Sport!.Name,
            Sport: new SportDto(
                team.Sport.Name,
                team.Sport.Skills,
                team.Sport.Positions));

        return Task.FromResult<GetTeamResult?>(result);
    }
}
