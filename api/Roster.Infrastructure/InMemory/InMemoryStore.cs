namespace Roster.Infrastructure.InMemory;

using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;
using Roster.Application.Interfaces;
using Roster.Domain.Aggregates;
using Roster.Domain.Events;
using Roster.Domain.Interfaces;

public class InMemoryStore : ITeamRepository, IInMemoryStore
{
    private readonly ConcurrentDictionary<Guid, TeamAggregate> _teams = new();
    private readonly ConcurrentDictionary<Guid, GameAggregate> _games = new();
    private readonly ConcurrentDictionary<string, Guid> _secrets = new();
    private readonly ILogger<InMemoryStore> _logger;

    public InMemoryStore(ILogger<InMemoryStore> logger)
    {
        _logger = logger;
    }

    // ITeamRepository
    public TeamAggregate? GetById(Guid teamId) =>
        _teams.TryGetValue(teamId, out var team) ? team : null;

    public TeamAggregate? GetBySecretHash(string secretHash) =>
        _secrets.TryGetValue(secretHash, out var teamId) ? GetById(teamId) : null;

    void ITeamRepository.Apply(DomainEvent e) => Apply(e);

    // IInMemoryStore
    public TeamAggregate? GetTeam(Guid teamId) => GetById(teamId);

    public GameAggregate? GetGame(Guid gameId) =>
        _games.TryGetValue(gameId, out var game) ? game : null;

    public IReadOnlyList<GameAggregate> GetGamesForTeam(Guid teamId) =>
        _games.Values.Where(g => g.TeamId == teamId).ToList();

    // Route events to correct aggregate
    public void Apply(DomainEvent @event)
    {
        switch (@event)
        {
            case TeamCreated e:
                var team = _teams.GetOrAdd(e.TeamId, _ => new TeamAggregate());
                team.Apply(e);
                _secrets[e.AccessSecretHash] = e.TeamId;
                _logger.LogDebug("Applied {EventType} for team {TeamId}", e.EventType, e.TeamId);
                break;

            case PlayerAdded or PlayerSkillRated or PlayerDeactivated:
                if (_teams.TryGetValue(@event.TeamId, out var t))
                    t.Apply(@event);
                break;

            case GameCreated gc:
                var game = _games.GetOrAdd(gc.GameId, _ => new GameAggregate());
                game.Apply(gc);
                _logger.LogDebug("Applied {EventType} for game {GameId}", gc.EventType, gc.GameId);
                break;

            case PlayerMarkedAbsent or PlayerAbsenceRevoked or BattingOrderSet
                 or InningFieldingAssigned or GameLocked:
                var gameId = @event switch
                {
                    PlayerMarkedAbsent e => e.GameId,
                    PlayerAbsenceRevoked e => e.GameId,
                    BattingOrderSet e => e.GameId,
                    InningFieldingAssigned e => e.GameId,
                    GameLocked e => e.GameId,
                    _ => Guid.Empty
                };
                if (gameId != Guid.Empty && _games.TryGetValue(gameId, out var g))
                    g.Apply(@event);
                break;
        }
    }
}
