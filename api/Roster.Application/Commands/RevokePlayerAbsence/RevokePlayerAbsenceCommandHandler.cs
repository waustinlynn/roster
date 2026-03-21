namespace Roster.Application.Commands.RevokePlayerAbsence;

using MediatR;
using Roster.Application.Interfaces;
using Roster.Domain.Events;
using Roster.Domain.Exceptions;
using Roster.Domain.Interfaces;

public class RevokePlayerAbsenceCommandHandler : IRequestHandler<RevokePlayerAbsenceCommand>
{
    private readonly IEventStore _eventStore;
    private readonly IInMemoryStore _store;

    public RevokePlayerAbsenceCommandHandler(IEventStore eventStore, IInMemoryStore store)
    {
        _eventStore = eventStore;
        _store = store;
    }

    public async Task Handle(RevokePlayerAbsenceCommand request, CancellationToken cancellationToken)
    {
        var game = _store.GetGame(request.GameId)
            ?? throw new DomainException($"Game {request.GameId} not found.");

        if (game.IsLocked)
            throw new DomainException("This game is locked and cannot be modified.");

        if (!game.AbsentPlayerIds.Contains(request.PlayerId))
            throw new DomainException("Player is not marked absent for this game.");

        await _eventStore.AppendAsync([new PlayerAbsenceRevoked
        {
            TeamId = request.TeamId, GameId = request.GameId, PlayerId = request.PlayerId
        }], cancellationToken);
    }
}
