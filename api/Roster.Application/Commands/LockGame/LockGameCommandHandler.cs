namespace Roster.Application.Commands.LockGame;

using MediatR;
using Roster.Application.Interfaces;
using Roster.Domain.Events;
using Roster.Domain.Exceptions;
using Roster.Domain.Interfaces;

public class LockGameCommandHandler : IRequestHandler<LockGameCommand>
{
    private readonly IEventStore _eventStore;
    private readonly IInMemoryStore _store;

    public LockGameCommandHandler(IEventStore eventStore, IInMemoryStore store)
    {
        _eventStore = eventStore;
        _store = store;
    }

    public async Task Handle(LockGameCommand request, CancellationToken cancellationToken)
    {
        var game = _store.GetGame(request.GameId)
            ?? throw new DomainException($"Game {request.GameId} not found.");

        if (game.IsLocked)
            throw new DomainException("This game is already locked.");

        await _eventStore.AppendAsync([new GameLocked
        {
            TeamId = request.TeamId, GameId = request.GameId
        }], cancellationToken);
    }
}
