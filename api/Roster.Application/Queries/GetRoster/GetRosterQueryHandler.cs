namespace Roster.Application.Queries.GetRoster;

using MediatR;
using Roster.Application.Interfaces;
using Roster.Domain.Exceptions;

public class GetRosterQueryHandler : IRequestHandler<GetRosterQuery, IReadOnlyList<PlayerDto>>
{
    private readonly IInMemoryStore _store;
    public GetRosterQueryHandler(IInMemoryStore store) => _store = store;

    public Task<IReadOnlyList<PlayerDto>> Handle(GetRosterQuery request, CancellationToken cancellationToken)
    {
        var team = _store.GetTeam(request.TeamId)
            ?? throw new DomainException($"Team {request.TeamId} not found.");

        var players = team.Players.Values
            .Select(p => new PlayerDto(
                p.PlayerId,
                p.Name,
                p.IsActive,
                p.Skills.AsReadOnly()))
            .ToList();

        return Task.FromResult<IReadOnlyList<PlayerDto>>(players);
    }
}
