namespace Roster.Domain.Aggregates;

using Roster.Domain.Events;
using Roster.Domain.Exceptions;
using Roster.Domain.ValueObjects;

public class TeamAggregate
{
    public Guid TeamId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public Sport? Sport { get; private set; }
    public string AccessSecretHash { get; private set; } = string.Empty;
    public int Version { get; private set; }

    // Players dictionary: PlayerId -> PlayerState
    private readonly Dictionary<Guid, PlayerState> _players = new();
    public IReadOnlyDictionary<Guid, PlayerState> Players => _players;

    public void Apply(DomainEvent @event)
    {
        switch (@event)
        {
            case TeamCreated e: Apply(e); break;
            case PlayerAdded e: Apply(e); break;
            case PlayerSkillRated e: Apply(e); break;
            case PlayerDeactivated e: Apply(e); break;
        }
        Version++;
    }

    private void Apply(TeamCreated e)
    {
        if (TeamId != Guid.Empty)
            throw new DomainException("Team has already been created.");

        TeamId = e.TeamId;
        Name = e.Name;
        Sport = ValueObjects.Sport.FindByName(e.SportName)
            ?? throw new DomainException($"Unknown sport: '{e.SportName}'.");
        AccessSecretHash = e.AccessSecretHash;
    }
    private void Apply(PlayerAdded e)
    {
        _players[e.PlayerId] = new PlayerState
        {
            PlayerId = e.PlayerId,
            Name = e.Name,
            IsActive = true,
            Skills = new Dictionary<string, int>(),
        };
    }

    private void Apply(PlayerSkillRated e)
    {
        if (!_players.TryGetValue(e.PlayerId, out var player))
            throw new DomainException($"Player {e.PlayerId} not found.");
        if (!player.IsActive)
            throw new DomainException($"Cannot rate skill for inactive player '{player.Name}'.");
        player.Skills[e.SkillName] = e.Rating;
    }

    private void Apply(PlayerDeactivated e)
    {
        if (!_players.TryGetValue(e.PlayerId, out var player))
            throw new DomainException($"Player {e.PlayerId} not found.");
        player.IsActive = false;
    }
}

public class PlayerState
{
    public Guid PlayerId { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public Dictionary<string, int> Skills { get; set; } = new();
}
