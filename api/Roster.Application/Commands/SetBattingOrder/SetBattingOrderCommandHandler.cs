namespace Roster.Application.Commands.SetBattingOrder;

using MediatR;
using Roster.Application.Interfaces;
using Roster.Domain.Events;
using Roster.Domain.Exceptions;
using Roster.Domain.Interfaces;

public class SetBattingOrderCommandHandler : IRequestHandler<SetBattingOrderCommand>
{
    private readonly IEventStore _eventStore;
    private readonly IInMemoryStore _store;

    public SetBattingOrderCommandHandler(IEventStore eventStore, IInMemoryStore store)
    {
        _eventStore = eventStore;
        _store = store;
    }

    public async Task Handle(SetBattingOrderCommand request, CancellationToken cancellationToken)
    {
        var team = _store.GetTeam(request.TeamId)
            ?? throw new DomainException($"Team {request.TeamId} not found.");

        var game = _store.GetGame(request.GameId)
            ?? throw new DomainException($"Game {request.GameId} not found.");

        if (game.IsLocked)
            throw new DomainException("This game is locked and cannot be modified.");

        if (!request.OrderedPlayerIds.Any())
            throw new DomainException("Batting order must include at least one player.");

        if (request.OrderedPlayerIds.Distinct().Count() != request.OrderedPlayerIds.Count)
            throw new DomainException("Batting order contains duplicate player IDs.");

        foreach (var playerId in request.OrderedPlayerIds)
        {
            if (!team.Players.TryGetValue(playerId, out var player))
                throw new DomainException($"Player {playerId} not found on this team.");
            if (!player.IsActive)
                throw new DomainException($"Player '{player.Name}' is not active.");
            if (game.AbsentPlayerIds.Contains(playerId))
                throw new DomainException($"Player '{player.Name}' is marked absent for this game.");
        }

        await _eventStore.AppendAsync([new BattingOrderSet
        {
            TeamId = request.TeamId,
            GameId = request.GameId,
            OrderedPlayerIds = request.OrderedPlayerIds,
        }], cancellationToken);
    }
}
