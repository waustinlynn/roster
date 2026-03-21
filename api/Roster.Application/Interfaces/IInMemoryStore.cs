namespace Roster.Application.Interfaces;
using Roster.Domain.Aggregates;

public interface IInMemoryStore
{
    TeamAggregate? GetTeam(Guid teamId);
    GameAggregate? GetGame(Guid gameId);
    IReadOnlyList<GameAggregate> GetGamesForTeam(Guid teamId);
}
