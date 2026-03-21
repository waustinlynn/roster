namespace Roster.Application.Commands.MarkPlayerAbsent;

using MediatR;
using Roster.Application.Interfaces;
using Roster.Domain.Events;
using Roster.Domain.Exceptions;
using Roster.Domain.Interfaces;

public class MarkPlayerAbsentCommandHandler : IRequestHandler<MarkPlayerAbsentCommand>
{
    private readonly IEventStore _eventStore;
    private readonly IInMemoryStore _store;

    public MarkPlayerAbsentCommandHandler(IEventStore eventStore, IInMemoryStore store)
    {
        _eventStore = eventStore;
        _store = store;
    }

    public async Task Handle(MarkPlayerAbsentCommand request, CancellationToken cancellationToken)
    {
        var team = _store.GetTeam(request.TeamId)
            ?? throw new DomainException($"Team {request.TeamId} not found.");

        var game = _store.GetGame(request.GameId)
            ?? throw new DomainException($"Game {request.GameId} not found.");

        if (game.IsLocked)
            throw new DomainException("This game is locked and cannot be modified.");

        if (!team.Players.ContainsKey(request.PlayerId))
            throw new DomainException($"Player {request.PlayerId} is not on this team.");

        if (game.AbsentPlayerIds.Contains(request.PlayerId))
            throw new DomainException("Player is already marked absent for this game.");

        await _eventStore.AppendAsync([new PlayerMarkedAbsent
        {
            TeamId = request.TeamId, GameId = request.GameId, PlayerId = request.PlayerId
        }], cancellationToken);
    }
}
