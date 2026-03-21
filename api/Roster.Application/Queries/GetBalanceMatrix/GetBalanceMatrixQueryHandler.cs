namespace Roster.Application.Queries.GetBalanceMatrix;

using MediatR;
using Roster.Application.Interfaces;
using Roster.Domain.Exceptions;

public class GetBalanceMatrixQueryHandler : IRequestHandler<GetBalanceMatrixQuery, BalanceMatrixDto>
{
    private readonly IInMemoryStore _store;
    public GetBalanceMatrixQueryHandler(IInMemoryStore store) => _store = store;

    public Task<BalanceMatrixDto> Handle(GetBalanceMatrixQuery request, CancellationToken cancellationToken)
    {
        var team = _store.GetTeam(request.TeamId)
            ?? throw new DomainException($"Team {request.TeamId} not found.");

        var allPositions = team.Sport!.Positions.Concat(["Bench"]).ToList();
        var games = _store.GetGamesForTeam(request.TeamId);

        // Initialise counts to 0 for every player × position
        var counts = team.Players.Values
            .ToDictionary(
                p => p.PlayerId,
                _ => allPositions.ToDictionary(pos => pos, _ => 0));

        // Accumulate from all game inning assignments
        foreach (var game in games)
        {
            foreach (var (_, assignments) in game.InningAssignments)
            {
                foreach (var a in assignments)
                {
                    if (counts.TryGetValue(a.PlayerId, out var playerCounts) &&
                        playerCounts.ContainsKey(a.Position))
                    {
                        playerCounts[a.Position]++;
                    }
                }
            }
        }

        var rows = team.Players.Values
            .Select(p => new PlayerBalanceRow(
                p.PlayerId,
                p.Name,
                p.IsActive,
                counts[p.PlayerId]))
            .ToList();

        return Task.FromResult(new BalanceMatrixDto(allPositions, rows));
    }
}
