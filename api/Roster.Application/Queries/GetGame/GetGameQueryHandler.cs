namespace Roster.Application.Queries.GetGame;

using MediatR;
using Roster.Application.Commands.AssignInningFielding;
using Roster.Application.Interfaces;
using Roster.Domain.Exceptions;

public class GetGameQueryHandler :
    IRequestHandler<GetGameQuery, GameDto?>,
    IRequestHandler<GetGamesQuery, IReadOnlyList<GameSummaryDto>>
{
    private readonly IInMemoryStore _store;
    public GetGameQueryHandler(IInMemoryStore store) => _store = store;

    public Task<GameDto?> Handle(GetGameQuery request, CancellationToken cancellationToken)
    {
        var game = _store.GetGame(request.GameId);
        if (game is null) return Task.FromResult<GameDto?>(null);

        var dto = new GameDto(
            game.GameId,
            game.Date.ToString("yyyy-MM-dd"),
            game.Opponent,
            game.InningCount,
            game.IsLocked,
            game.AbsentPlayerIds.ToList(),
            game.BattingOrder.ToList(),
            game.InningAssignments.ToDictionary(
                kvp => kvp.Key,
                kvp => (IReadOnlyList<FieldingAssignmentDto>)kvp.Value
                    .Select(a => new FieldingAssignmentDto(a.PlayerId, a.Position))
                    .ToList()),
            game.InningScores.ToDictionary(
                kvp => kvp.Key,
                kvp => new InningScoreDto(kvp.Value.HomeScore, kvp.Value.AwayScore)),
            game.Remarks);

        return Task.FromResult<GameDto?>(dto);
    }

    public Task<IReadOnlyList<GameSummaryDto>> Handle(GetGamesQuery request, CancellationToken cancellationToken)
    {
        var games = _store.GetGamesForTeam(request.TeamId)
            .Select(g => new GameSummaryDto(
                g.GameId,
                g.Date.ToString("yyyy-MM-dd"),
                g.Opponent,
                g.InningCount,
                g.IsLocked,
                g.AbsentPlayerIds.ToList()))
            .ToList();

        return Task.FromResult<IReadOnlyList<GameSummaryDto>>(games);
    }
}
